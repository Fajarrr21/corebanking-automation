/// <reference types="cypress" />
// Karyawan — form Tambah (/user/create): tampilan + validasi NEGATIF.
// Tidak ada user yang tercipta di spec ini:
//   - Validasi HTML5 (TC-003): guard memblok semua POST.
//   - Validasi server (TC-004..006): POST /user/create di-allow, tapi data
//     SELALU gagal CreateUserRequest (no HP "12345" ditolak PhoneNumberRule di
//     ketiga TC sebagai pengaman ganda) → tidak ada INSERT & tidak ada email.
//     Setelahnya dicek email QA tidak muncul di daftar.
// TC sheet: docs/test-cases/src/TC_Karyawan_Create.json
import KaryawanFormPage from '../../../support/pageobjects/Karyawan/KaryawanFormPage';
import KaryawanListPage from '../../../support/pageobjects/Karyawan/KaryawanListPage';

describe('Karyawan - Tambah Karyawan', () => {
  let fx;

  before(() => {
    cy.fixture('karyawan/karyawan').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openForm = (allowServerValidation = false) => {
    KaryawanFormPage.openGuarded(fx.urls.create, {
      allow: allowServerValidation ? [new RegExp(fx.urls.createPostPath)] : [],
    });
    KaryawanFormPage.assertUrl(fx.urls.create).assertBreadcrumb(fx.labels.breadcrumbCreate);
  };

  const assertEmailNotRegistered = (email) => {
    cy.visit(fx.urls.list);
    KaryawanListPage.waitLoaded().search(email);
    KaryawanListPage.rowByEmail(email, fx.columns.email).should('have.length', 0);
  };

  describe('Tampilan form', () => {
    it('TC-KRY-CREATE-001 | Happy | Form Tambah Karyawan menampilkan field wajib dan catatan', () => {
      openForm();
      KaryawanFormPage.elements.note().should('contain.text', fx.labels.createNote);
      KaryawanFormPage.elements.formLabels().should(($l) => {
        const labels = Cypress.$.makeArray($l).map((l) => l.innerText.replace('*', '').replace(/\s+/g, ' ').trim());
        expect(labels).to.deep.eq(fx.labels.createFormLabels);
      });
      ['nameInput', 'emailInput', 'phoneInput', 'officeSelect'].forEach((el) => {
        KaryawanFormPage.elements[el]().should('have.attr', 'required');
      });
      KaryawanFormPage.elements.submitBtn().should('have.text', fx.labels.submitButton);
    });

    it('TC-KRY-CREATE-002 | Positif | Pilihan Hak Akses sesuai dan tidak menawarkan super-admin', () => {
      openForm();
      KaryawanFormPage.elements.roleCheckboxes().should(($cb) => {
        const values = Cypress.$.makeArray($cb).map((c) => c.value);
        expect(values).to.deep.eq(fx.labels.roleOptions.map((r) => r.value));
        expect(values).not.to.include('super-admin');
      });
      fx.labels.roleOptions.forEach((r) => {
        KaryawanFormPage.elements.roleCheckbox(r.value).parent('label').should('contain.text', r.label);
      });
      KaryawanFormPage.elements.officeSelect().find('option').first().should('have.text', fx.labels.noOfficeOption);
    });
  });

  describe('Validasi', () => {
    it('TC-KRY-CREATE-003 | Negatif | Submit form kosong dicegah validasi wajib isi browser', () => {
      openForm();
      KaryawanFormPage.submit();
      KaryawanFormPage.elements.nameInput().then(($i) => {
        expect($i[0].validity.valueMissing, 'Nama Lengkap kosong ditandai invalid').to.eq(true);
      });
      KaryawanFormPage.assertUrl(fx.urls.create);
      cy.blockedWrites().should('deep.eq', []);
    });

    it('TC-KRY-CREATE-004 | Negatif | Nomor handphone tidak diawali 08/62 ditolak server', () => {
      openForm(true);
      cy.qaName().then((name) => {
        cy.qaEmail().then((email) => {
          KaryawanFormPage.fill({ name, email, phone: fx.testData.invalidPhone, office: fx.testData.officeValue, roles: [fx.testData.role] }).submit();
          KaryawanFormPage.assertUrl(fx.urls.create);
          KaryawanFormPage.common.validationItems().should('contain.text', fx.messages.invalidPhone);
          assertEmailNotRegistered(email);
        });
      });
    });

    it('TC-KRY-CREATE-005 | Negatif | Tanpa Hak Akses ditolak server', () => {
      openForm(true);
      cy.qaName().then((name) => {
        cy.qaEmail().then((email) => {
          KaryawanFormPage.fill({ name, email, phone: fx.testData.invalidPhone, office: fx.testData.officeValue }).submit();
          KaryawanFormPage.common.validationItems().should('contain.text', fx.messages.rolesRequired);
          assertEmailNotRegistered(email);
        });
      });
    });

    it('TC-KRY-CREATE-006 | Negatif | Email yang sudah terdaftar ditolak server', () => {
      KaryawanListPage.openGuarded({ allow: [new RegExp(fx.urls.createPostPath)] });
      KaryawanListPage.waitLoaded().rowData().then((rows) => {
        const existing = rows[0][fx.columns.email];
        cy.visit(fx.urls.create);
        cy.qaName().then((name) => {
          KaryawanFormPage.fill({ name, email: existing, phone: fx.testData.invalidPhone, office: fx.testData.officeValue, roles: [fx.testData.role] }).submit();
          KaryawanFormPage.common.validationItems().should('contain.text', fx.messages.emailTaken);
          cy.visit(fx.urls.list);
          KaryawanListPage.waitLoaded().search(existing);
          KaryawanListPage.rowByEmail(existing, fx.columns.email).should('have.length', 1);
        });
      });
    });
  });
});
