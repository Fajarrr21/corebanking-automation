// KantorPage — halaman Kantor (/office), khusus super-admin.
//
// Source develop: OfficeController@index (GET), @officeEdit (POST /office/edit →
// Office::renameTo — ganti nama kantor ASLI + akun GL), @officeStatus
// (POST /office/status — buka/tutup operasional kantor ASLI).
// View: resources/views/office/index.blade.php — DataTables CLIENT-side.
//
// ⚠️ Markup develop berisi blok duplikat (baris ~170-286): di dalam modal
// #editOffice ada lagi toolbar, form-nonactive-office, table#table-office, dan
// modal #editOffice kedua. Karena itu:
//   - tabel utama selalu di-scope lewat wrapper DataTables (#table-office_wrapper),
//   - modal & tombol status diambil .first().
// ⚠️ offices.branch = NAMA kantor induk (bukan id) — kolom "Wilayah".

import BasePage from '../BasePage';
import LoginPage from '../LoginPage';

const TABLE = '#table-office_wrapper table#table-office';

class KantorPage extends BasePage {
  path = '/office';
  table = TABLE;

  elements = {
    infoNote: () => cy.get('.page-content .note.note-info'),
    table: () => cy.get(TABLE),
    rows: () => cy.get(`${TABLE} tbody tr`),
    headers: () => cy.get(`${TABLE} thead th`),
    lengthSelect: () => cy.get('select[name="table-office_length"]'),
    searchInput: () => cy.get('#table-office_filter input'),
    roleFilter: () => cy.get('#filter-office-role'),
    openOperationBtn: () => cy.get('#form-active-office button[type="submit"]').first(),
    closedOperationBtn: () => cy.get('#form-nonactive-office button[type="submit"]').first(),
    editBtnInFirstRow: () => cy.get(`${TABLE} tbody tr`).first().find('a[data-target="#editOffice"]'),
    editModal: () => cy.get('div.modal#editOffice').first(),
    officeNameInput: () => cy.get('#office-name'),
    officeAddressInput: () => cy.get('#office-address'),
    officePicInput: () => cy.get('#office-pic'),
    officeRoleSelect: () => cy.get('select[name="office-role"]'),
    sidebarTitles: () => cy.get('ul.page-sidebar-menu span.title'),
  };

  /** Login → guard tulis → visit /office. */
  openGuarded({ allow = [] } = {}) {
    LoginPage.loginViaSession();
    cy.guardWrites({ allow });
    cy.visit(this.path);
    return this;
  }

  /** Precondition: akun test super-admin (menu Kantor hanya untuk super-admin). */
  assertSuperAdmin(menuTitle) {
    this.elements.sidebarTitles().should(($t) => {
      const titles = Cypress.$.makeArray($t).map((el) => el.textContent.trim());
      expect(titles, 'precondition: akun test super-admin (menu Kantor tampil) — butuh akun super-admin').to.include(menuTitle);
    });
    return this;
  }

  waitLoaded() {
    this.elements.table().should('have.class', 'dataTable');
    this.elements.rows().should('have.length.greaterThan', 0);
    return this;
  }

  /** Tampilkan semua baris (opsi "All" = -1). */
  showAll(value = '-1') {
    this.elements.lengthSelect().select(value);
    return this;
  }

  filterRole(value) {
    this.elements.roleFilter().select(value);
    return this;
  }

  /** Yield array baris data: [{cells:[...teks kolom]}]; baris empty-state dibuang. */
  rowData() {
    return this.elements.rows().then(($rows) => {
      const data = Cypress.$.makeArray($rows)
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .map((r) => Cypress.$(r).find('td').toArray().map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
      return cy.then(() => data);
    });
  }

  /** Teks label UI (bukan data) di halaman: breadcrumb, note, header, opsi filter, tombol toolbar. */
  uiLabelText() {
    return cy.document().then((doc) => {
      const $ = Cypress.$;
      const parts = [
        ...$('.page-breadcrumb', doc).toArray(),
        ...$('.page-content .note', doc).toArray(),
        ...$(`${TABLE} thead th`, doc).toArray(),
        ...$('#filter-office-role option', doc).toArray(),
        ...$('#table-office_wrapper .dataTables_length, #table-office_wrapper .dataTables_filter, #table-office_wrapper .dataTables_info', doc).toArray(),
        ...$('.table-toolbar button', doc).first().closest('.table-toolbar').find('button').toArray(),
      ].map((el) => el.innerText || el.textContent || '');
      return cy.then(() => parts.join(' | '));
    });
  }
}

export default new KantorPage();
