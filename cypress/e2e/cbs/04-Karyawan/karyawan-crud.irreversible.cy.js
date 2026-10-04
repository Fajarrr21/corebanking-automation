/// <reference types="cypress" />
// Karyawan — siklus Tambah → Ubah → Hapus user milik test.
//
// ⚠️ IRREVERSIBLE: createPost mengirim email kredensial (VerificationNotification)
// ke alamat user baru. Walau alamatnya qa+<ts>@example.invalid (tidak terkirim)
// dan user dihapus di akhir (hard delete), pengiriman email tidak bisa
// dibatalkan → di-gate flag. Jalankan hanya dengan:
//   npx cypress run --spec "cypress/e2e/cbs/04-Karyawan/karyawan-crud.irreversible.cy.js" --env allowUserCreate=true
//
// Data uji: Nama QA<ts><seq>, email qa+<ts>@example.invalid, kantor = kantor nyata
// pertama di dropdown (BUKAN "Tanpa Kantor": user office_id 0 gagal divalidasi saat edit),
// role auditor. Cleanup (after): hapus baris yang EMAIL-nya persis email test
// DAN kolom Nama diawali "QA". Akun login test tidak pernah disentuh.
// Test berurutan (001 → 002 → 003) dan saling bergantung.
// TC sheet: docs/test-cases/src/TC_Karyawan_Crud.json
import { describeIfFlag } from '../../../support/utils/flags';
import KaryawanListPage from '../../../support/pageobjects/Karyawan/KaryawanListPage';
import KaryawanFormPage from '../../../support/pageobjects/Karyawan/KaryawanFormPage';
import LoginPage from '../../../support/pageobjects/LoginPage';

describeIfFlag('allowUserCreate', 'Karyawan - Siklus Tambah, Ubah, Hapus user QA', () => {
  let fx;
  let qa; // { name, email, editedName }

  before(() => {
    cy.fixture('karyawan/karyawan').then((d) => (fx = d));
    cy.qaName().then((name) => {
      cy.qaEmail().then((email) => {
        qa = { name, email, editedName: null };
      });
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  after(() => {
    // Cleanup column-scoped: hanya baris dengan email test & Nama diawali QA.
    if (!qa || !fx) return;
    LoginPage.loginViaSession();
    cy.visit(fx.urls.list);
    KaryawanListPage.waitLoaded().search(qa.email);
    KaryawanListPage.elements.rows().then(($rows) => {
      const match = Cypress.$.makeArray($rows).filter((r) => {
        const tds = Cypress.$(r).find('td');
        return tds.eq(fx.columns.email).text().trim() === qa.email && /^QA/.test(tds.eq(fx.columns.name).text().trim());
      });
      if (match.length) {
        KaryawanListPage.deleteQaUser(qa.email, fx.columns);
        KaryawanListPage.assertSuccess(fx.messages.deleted);
      }
    });
  });

  it('TC-KRY-CRUD-001 | Happy | Tambah karyawan QA berhasil dan muncul di daftar', () => {
    KaryawanFormPage.openUnguarded(fx.urls.create);
    KaryawanFormPage.fill({
      name: qa.name, email: qa.email, phone: fx.testData.validPhone, roles: [fx.testData.role],
    }).selectFirstRealOffice().submit();
    cy.location('pathname').should('eq', fx.urls.list);
    KaryawanListPage.assertSuccess(fx.messages.created).waitLoaded().search(qa.email);
    KaryawanListPage.rowByEmail(qa.email, fx.columns.email).should('have.length', 1).within(() => {
      cy.get('td').eq(fx.columns.name).should('have.text', qa.name);
      cy.get('td').eq(fx.columns.status).should('contain.text', fx.labels.statusValues[0]);
      cy.get('td').eq(fx.columns.role).invoke('text').then((t) => {
        expect(KaryawanListPage.constructor.parseRoles(t)).to.deep.eq([fx.testData.role]);
      });
    });
  });

  it('TC-KRY-CRUD-002 | Positif | Ubah nama & status karyawan QA menjadi Non Aktif tersimpan', () => {
    qa.editedName = `${qa.name} ${fx.testData.editedNameSuffix}`;
    KaryawanListPage.openUnguarded();
    KaryawanListPage.waitLoaded().search(qa.email);
    KaryawanListPage.rowByEmail(qa.email, fx.columns.email).should('have.length', 1)
      .find('a').filter((_, a) => a.textContent.trim() === 'Edit').click();
    KaryawanFormPage.assertBreadcrumb(fx.labels.breadcrumbEdit);
    KaryawanFormPage.elements.emailInput().should('have.value', qa.email);
    KaryawanFormPage.fill({ name: qa.editedName });
    KaryawanFormPage.selectNative('.page-content select[name="status"]', fx.testData.editedStatus);
    KaryawanFormPage.submit();
    cy.location('pathname').should('eq', fx.urls.list);
    KaryawanListPage.assertSuccess(fx.messages.updated).waitLoaded().search(qa.email);
    KaryawanListPage.rowByEmail(qa.email, fx.columns.email).within(() => {
      cy.get('td').eq(fx.columns.name).should('have.text', qa.editedName);
      cy.get('td').eq(fx.columns.status).should('contain.text', fx.testData.editedStatusLabel);
    });
  });

  it('TC-KRY-CRUD-003 | Positif | Hapus karyawan QA menghilangkan baris dari daftar', () => {
    KaryawanListPage.openUnguarded();
    KaryawanListPage.waitLoaded().deleteQaUser(qa.email, fx.columns);
    cy.location('pathname').should('eq', fx.urls.list);
    KaryawanListPage.assertSuccess(fx.messages.deleted).waitLoaded().search(qa.email);
    KaryawanListPage.rowByEmail(qa.email, fx.columns.email).should('have.length', 0);
  });
});
