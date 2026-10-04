// KaryawanListPage — daftar karyawan (/user), menu khusus super-admin.
//
// Source develop: UserController@index (super-admin: semua user non-bot),
// @delete (POST /user/delete, HARD delete — model User tanpa SoftDeletes).
// View user/index.blade.php: table#sample_1 (DataTables client-side via
// Metronic table-datatables-managed), modal #delete (form → user.delete).
//
// ⚠️ Akun login test (Cypress.env('appEmail')) TIDAK BOLEH diedit/dihapus:
// method di sini selalu memilih baris berdasarkan email & memvalidasi
// kolom Nama berawalan "QA" sebelum aksi destruktif.

import BasePage from '../BasePage';
import LoginPage from '../LoginPage';

const TABLE = '#sample_1';

class KaryawanListPage extends BasePage {
  path = '/user';
  table = TABLE;

  elements = {
    addButton: () => cy.contains('a.btn', 'Tambah'),
    table: () => cy.get(TABLE),
    headers: () => cy.get(`${TABLE} thead th`),
    rows: () => cy.get(`${TABLE} tbody tr`),
    lengthSelect: () => cy.get(`select[name="${TABLE.slice(1)}_length"]`),
    searchInput: () => cy.get(`${TABLE}_filter input`),
    deleteModal: () => cy.get('#delete'),
    deleteName: () => cy.get('#deleteName'),
    deleteId: () => cy.get('#deleteId'),
    deleteSubmit: () => cy.get('#SubmitDeleteProductForm'),
    deleteClose: () => cy.get('#delete .modal-footer button[data-dismiss="modal"]'),
    sidebarTitles: () => cy.get('ul.page-sidebar-menu span.title'),
  };

  openGuarded({ allow = [] } = {}) {
    LoginPage.loginViaSession();
    cy.guardWrites({ allow });
    cy.visit(this.path);
    return this;
  }

  /** Tanpa guard — HANYA untuk spec irreversible yang di-gate flag. */
  openUnguarded() {
    LoginPage.loginViaSession();
    cy.visit(this.path);
    return this;
  }

  assertSuperAdmin(menuTitle) {
    this.elements.sidebarTitles().should(($t) => {
      const titles = Cypress.$.makeArray($t).map((el) => el.textContent.trim());
      expect(titles, 'precondition: akun test super-admin (menu Karyawan tampil) — butuh akun super-admin').to.include(menuTitle);
    });
    return this;
  }

  waitLoaded() {
    this.elements.table().should('have.class', 'dataTable');
    this.elements.rows().should('have.length.greaterThan', 0);
    return this;
  }

  /** Pilih opsi terakhir dropdown jumlah baris (Metronic: "All"). */
  showAll() {
    this.elements.lengthSelect().find('option').last().then(($o) => {
      this.elements.lengthSelect().select($o.val());
    });
    return this;
  }

  search(text) {
    this.elements.searchInput().clear().type(text, { delay: 0 });
    return this;
  }

  /** Yield array baris data → array teks kolom (empty-state dibuang). */
  rowData() {
    return this.elements.rows().then(($rows) => {
      const data = Cypress.$.makeArray($rows)
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .map((r) => Cypress.$(r).find('td').toArray().map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
      return cy.then(() => data);
    });
  }

  /** Baris (jQuery) yang kolom Email-nya persis `email`. */
  rowByEmail(email, emailCol) {
    return this.elements.rows().filter((_, r) => Cypress.$(r).find('td').eq(emailCol).text().trim() === email);
  }

  /** Normalisasi kolom Role "a, b" → ['a','b']. */
  static parseRoles(text) {
    return text.replace(/\s+/g, '').split(',').filter(Boolean);
  }

  /**
   * Hapus user milik test: cari via email, pastikan kolom Nama diawali "QA"
   * dan email BUKAN akun login, lalu konfirmasi modal Hapus.
   */
  deleteQaUser(email, cols) {
    const loginEmail = Cypress.env('appEmail');
    expect(email, 'tidak boleh menghapus akun login test').not.to.eq(loginEmail);
    this.search(email);
    this.rowByEmail(email, cols.email).should('have.length', 1).then(($row) => {
      const nama = $row.find('td').eq(cols.name).text().trim();
      expect(nama, 'hanya hapus user milik test (Nama diawali QA)').to.match(/^QA/);
      cy.wrap($row).find('a[data-target="#delete"]').click();
      this.elements.deleteModal().should('be.visible');
      this.elements.deleteName().should('have.text', nama);
      this.elements.deleteSubmit().click();
    });
    return this;
  }
}

export { KaryawanListPage };
export default new KaryawanListPage();
