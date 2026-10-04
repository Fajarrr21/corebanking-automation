// CIF Nasabah — form Buat CIF (/cif/create): tampilan + validasi (TANPA membuat data).
// Pembuatan CIF sungguhan ada di cif-create.irreversible.cy.js (flag allowCreateCif).
// TC sumber: docs/test-cases/src/TC_CIF_Create.json
//
// Semua test memasang write-guard. Satu-satunya POST yang diizinkan lewat adalah
// TC-CIF-CREATE-015 (validasi SERVER) yang memakai NIK yang SUDAH terdaftar + nomor HP
// tidak valid → pasti ditolak 2 aturan sekaligus sehingga tidak ada data tercipta.
// assertNoWritesLeaked dipanggil di akhir tiap test (bukan afterEach) supaya kebocoran
// write di satu test tidak membuat test lain ikut ter-skip.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifFormPage from '../../../../support/pageobjects/Nasabah/CifFormPage';

describe('Nasabah - CIF - Form Buat CIF (/cif/create)', () => {
  let fx;
  let existing; // CIF yang sudah ada (untuk uji NIK duplikat)

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      fx = d;
    });
  });

  const baseData = (overrides = {}) => ({
    nik: CifFormPage.generateNik(fx.testData.nikPrefix),
    name: 'QA',
    placeOfBirth: fx.testData.placeOfBirth,
    dateOfBirth: fx.testData.dateOfBirth,
    gender: fx.testData.gender,
    address: fx.testData.address,
    provinceText: fx.testData.provinceText,
    occupation: fx.testData.occupation,
    annualIncome: fx.testData.annualIncome,
    marital: fx.testData.maritalSingle,
    motherName: fx.testData.motherName,
    phone: fx.testData.validPhone,
    ...overrides,
  });

  const loadExistingCif = () => {
    if (existing) return;
    CifListPage.visitList(fx.paths.list, fx.timeout);
    CifListPage.firstRowData(fx.list.col).then((row) => {
      expect(row.nik, 'precondition: CIF pertama punya NIK 16 digit').to.match(/^\d{16}$/);
      existing = row;
    });
  };

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
  });

  describe('Tampilan form', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-CIF-CREATE-001 | Happy | Form Buat CIF terbuka dengan tombol Proses', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.assertUrl(fx.paths.create).assertNotRedirectedToLogin().assertBreadcrumb(fx.breadcrumb.create);
      CifFormPage.elements.submitBtn().should('be.visible').and('contain.text', fx.form.submitCreate);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-002 | Positif | Field wajib ditandai bintang (*)', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.requiredLabels().then((req) => {
        fx.form.requiredLabels.forEach((l) => expect(req, `"${l}" bertanda *`).to.include(l));
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-003 | Positif | Nomor Handphone wajib diisi (bertanda * dan required)', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.requiredLabels().should('include', fx.form.phoneLabel);
      CifFormPage.elements.input('phone').should('have.attr', 'required');
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-004 | Positif | Form memuat field Jenis Nasabah dan Cabang sesuai PRD', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.labels().then((labels) => {
        fx.form.prdExtraFields.forEach((l) => expect(labels, `field PRD "${l}"`).to.include(l));
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-005 | Positif | Status Perkawinan Kawin menampilkan data Suami/Istri, selain itu disembunyikan', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      fx.form.spouseGroups.forEach((s) => cy.get(s).should('not.be.visible'));
      CifFormPage.selectNative('#marital_status', fx.testData.maritalMarried);
      fx.form.spouseGroups.forEach((s) => cy.get(s).should('be.visible'));
      CifFormPage.selectNative('#marital_status', fx.testData.maritalSingle);
      fx.form.spouseGroups.forEach((s) => cy.get(s).should('not.be.visible'));
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-006 | Positif | Pilih Provinsi memuat daftar Kabupaten/Kota secara berantai', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      cy.get('#province').select(fx.testData.provinceText, { force: true });
      cy.wait('@cities', { timeout: fx.timeout }).its('response.statusCode').should('eq', 200);
      cy.get('#city option:not([disabled])').should('have.length.greaterThan', 0);
      cy.get('#district option:not([disabled])').should('have.length', 0);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Validasi NIK (client & cek real-time)', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-CIF-CREATE-007 | Negatif | NIK hanya menerima angka', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.elements.nik().type(fx.testData.nikWithLetters, { delay: 0 });
      CifFormPage.elements.nik().should('have.value', fx.testData.nikWithLettersDigitsOnly);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-008 | Negatif | NIK kurang dari 16 digit menampilkan pesan format', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.elements.nik().type(fx.testData.nikShort, { delay: 0 }).blur();
      CifFormPage.elements.nikFeedback().should('be.visible').and('contain.text', fx.form.nikFeedback.format);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-009 | Negatif | NIK yang sudah terdaftar ditolak dan menampilkan nama pemiliknya', () => {
      loadExistingCif();
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      cy.intercept({ method: 'GET', pathname: fx.paths.checkNik }).as('checkNik');
      cy.then(() => {
        CifFormPage.elements.nik().type(existing.nik, { delay: 0 }).blur();
        cy.wait('@checkNik').its('response.body.exists').should('eq', true);
        CifFormPage.elements.nikFeedback()
          .should('be.visible')
          .and('contain.text', fx.form.nikFeedback.exists)
          .and('contain.text', existing.name);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-010 | Positif | NIK 16 digit yang belum terdaftar dinyatakan tersedia', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      cy.intercept({ method: 'GET', pathname: fx.paths.checkNik }).as('checkNik');
      CifFormPage.elements.nik().type(CifFormPage.generateNik(fx.testData.nikPrefix), { delay: 0 }).blur();
      cy.wait('@checkNik').its('response.body.exists').should('eq', false);
      CifFormPage.elements.nikFeedback().should('be.visible').and('contain.text', fx.form.nikFeedback.available);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Validasi submit (client-side, tanpa request tulis)', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-CIF-CREATE-011 | Negatif | Submit form kosong diblok dan tidak mengirim data', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.submit();
      cy.location('pathname').should('eq', fx.paths.create);
      CifFormPage.isValid('nik').should('eq', false);
      CifFormPage.formIsValid().should('eq', false);
      cy.blockedWrites().should('deep.eq', []);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-012 | Negatif | Format email salah diblok sebelum dikirim', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      cy.qaName().then((name) => {
        CifFormPage.fillValid(baseData({ name, email: fx.testData.invalidEmail }));
      });
      CifFormPage.submit();
      cy.location('pathname').should('eq', fx.paths.create);
      CifFormPage.isValid('email').should('eq', false);
      cy.blockedWrites().should('deep.eq', []);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-CREATE-013 | Negatif | Tanggal Lahir di masa depan ditolak', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      cy.qaName().then((name) => {
        CifFormPage.fillValid(baseData({ name, dateOfBirth: fx.testData.futureDateOfBirth }));
      });
      CifFormPage.submit();
      // Perilaku benar (PRD): form menolak sebelum data dikirim. Bila form tetap
      // mengirim POST, write-guard memblokirnya (data TIDAK sampai server) dan test gagal.
      cy.blockedWrites().should('deep.eq', []);
      cy.location('pathname').should('eq', fx.paths.create);
    });

    it('TC-CIF-CREATE-014 | Positif | Tombol Batal kembali ke list CIF tanpa menyimpan', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.elements.actionButtons().should(($b) => {
        const labels = Cypress.$.makeArray($b).map((el) => el.innerText.trim());
        expect(labels.some((l) => fx.form.cancelLabels.includes(l)), `ada tombol ${fx.form.cancelLabels.join('/')}`).to.eq(true);
      });
      CifFormPage.elements.actionButtons()
        .filter((i, el) => fx.form.cancelLabels.includes(el.innerText.trim()))
        .first()
        .click();
      cy.location('pathname').should('eq', fx.paths.list);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Validasi server (submit sungguhan, pasti ditolak)', () => {
    it('TC-CIF-CREATE-015 | Negatif | Server menolak NIK terdaftar dan nomor HP tidak valid', () => {
      loadExistingCif();
      // Hanya POST /cif/create yang boleh lewat; input dijamin gagal validasi (nik.unique + phone).
      cy.guardWrites({ allow: [/^\/cif\/create$/] });
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      cy.qaName().then((name) => {
        cy.then(() => {
          CifFormPage.fillValid(baseData({ name, nik: existing.nik, phone: fx.testData.invalidPhone }));
        });
        CifFormPage.submit();
        cy.location('pathname').should('eq', fx.paths.create);
        CifFormPage.elements.fieldError('nik').should('contain.text', fx.form.messages.nikUniqueServer);
        CifFormPage.elements.fieldError('phone').should('contain.text', fx.form.messages.phoneInvalidServer);
        // Bukti tidak ada data tercipta: nama QA unik tidak ditemukan di list.
        CifListPage.visitList(fx.paths.list, fx.timeout);
        CifListPage.search(name, fx.timeout);
        CifListPage.dataRows(CifListPage.table).should('have.length', 0);
      });
      cy.assertNoWritesLeaked();
    });
  });
});
