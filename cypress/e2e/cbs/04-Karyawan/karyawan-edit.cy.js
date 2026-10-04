/// <reference types="cypress" />
// Karyawan — halaman Edit (/user/{id}). READ-ONLY: form TIDAK disubmit
// (mengubah user asli staging dilarang). Target = karyawan pertama yang
// BUKAN akun login test. Semua POST diblok cy.guardWrites.
// TC sheet: docs/test-cases/src/TC_Karyawan_Edit.json
import KaryawanListPage, { KaryawanListPage as ListClass } from '../../../support/pageobjects/Karyawan/KaryawanListPage';
import KaryawanFormPage from '../../../support/pageobjects/Karyawan/KaryawanFormPage';

describe('Karyawan - Edit (tanpa submit)', () => {
  let fx;
  let target; // { cells, href }

  before(() => {
    cy.fixture('karyawan/karyawan').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    KaryawanListPage.openGuarded();
    KaryawanListPage.assertSuperAdmin(fx.labels.superAdminMenu).waitLoaded();
    const loginEmail = Cypress.env('appEmail');
    KaryawanListPage.elements.rows().then(($rows) => {
      const row = Cypress.$.makeArray($rows).find((r) => {
        const email = Cypress.$(r).find('td').eq(fx.columns.email).text().trim();
        return email && email !== loginEmail;
      });
      expect(row, 'precondition: ada karyawan selain akun login di halaman pertama').to.exist;
      target = {
        cells: Cypress.$(row).find('td').toArray().map((td) => td.innerText.replace(/\s+/g, ' ').trim()),
        href: Cypress.$(row).find(`a[href*="${fx.urls.editPrefix}"]`).filter((_, a) => a.textContent.trim() === 'Edit').attr('href'),
      };
      expect(target.href, 'tautan Edit pada baris').to.match(/\/user\/\d+$/);
    });
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-KRY-EDIT-001 | Happy | Halaman Edit menampilkan data karyawan yang dipilih', () => {
    cy.then(() => cy.visit(target.href));
    KaryawanFormPage.assertBreadcrumb(fx.labels.breadcrumbEdit);
    KaryawanFormPage.elements.nameInput().should(($i) => expect($i.val().trim()).to.eq(target.cells[fx.columns.name]));
    KaryawanFormPage.elements.emailInput().should('have.attr', 'readonly');
    KaryawanFormPage.elements.emailInput().should(($i) => expect($i.val()).to.eq(target.cells[fx.columns.email]));
    KaryawanFormPage.elements.phoneInput().should(($i) => expect($i.val().trim()).to.eq(target.cells[fx.columns.phone]));
  });

  it('TC-KRY-EDIT-002 | Positif | Status dan Hak Akses terisi sesuai data di daftar', () => {
    cy.then(() => cy.visit(target.href));
    const expectedStatus = fx.labels.statusOptionByLabel[target.cells[fx.columns.status]];
    KaryawanFormPage.elements.statusSelect().should('have.value', expectedStatus);
    const listRoles = ListClass.parseRoles(target.cells[fx.columns.role]);
    const editable = fx.labels.roleOptions.map((r) => r.value);
    KaryawanFormPage.checkedRoles().then((checked) => {
      expect(checked.sort(), 'checkbox Hak Akses = role di daftar (yang tersedia di form)')
        .to.deep.eq(listRoles.filter((r) => editable.includes(r)).sort());
    });
  });

  it('TC-KRY-EDIT-003 | Positif | Kantor Cabang terpilih sesuai kolom Kantor di daftar', () => {
    cy.then(() => cy.visit(target.href));
    KaryawanFormPage.elements.officeSelect().find('option:selected').invoke('text').then((t) => {
      const expected = target.cells[fx.columns.office] || fx.labels.noOfficeOption;
      expect(t.trim()).to.eq(expected);
    });
  });

  it('TC-KRY-EDIT-004 | Negatif | Cancel kembali ke daftar tanpa menyimpan', () => {
    cy.then(() => cy.visit(target.href));
    KaryawanFormPage.elements.nameInput().clear().type('QA-TIDAK-DISIMPAN', { delay: 0 });
    KaryawanFormPage.elements.cancelBtn().click();
    KaryawanListPage.assertUrl(fx.urls.list);
    cy.location('pathname').should('eq', fx.urls.list);
    cy.blockedWrites().should('deep.eq', []);
    KaryawanListPage.waitLoaded().search(target.cells[fx.columns.email]);
    KaryawanListPage.rowByEmail(target.cells[fx.columns.email], fx.columns.email)
      .find('td').eq(fx.columns.name).should('have.text', target.cells[fx.columns.name]);
  });

  it('TC-KRY-EDIT-005 | Negatif | ID karyawan tidak ada dialihkan ke daftar dengan pesan error', () => {
    cy.visit(`${fx.urls.editPrefix}${fx.urls.invalidUserId}`);
    cy.location('pathname').should('eq', fx.urls.list);
    KaryawanListPage.assertError(fx.messages.notFound);
  });
});
