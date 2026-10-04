// BasePage — helper bersama untuk semua halaman CBS (credis-v1).
//
// Sumber markup: repo cazh-core-banking-konvensional-v1 (branch develop =
// yang ter-deploy di staging-cbs). Laravel 5.8 + Metronic layout4 (Bootstrap 3)
// + jQuery DataTables (server-side, ajax GET) + partial `notifications.blade.php`
// untuk flash message (div.alert.alert-success / alert-danger / alert-warning /
// alert-info).
//
// Page object modul meng-extend class ini lalu di-export sebagai singleton:
//   class CifListPage extends BasePage { ... }
//   export default new CifListPage();

import LoginPage from './LoginPage';

export default class BasePage {
  common = {
    breadcrumb: () => cy.get('ul.page-breadcrumb'),
    breadcrumbActive: () => cy.get('ul.page-breadcrumb span.active'),
    portlet: () => cy.get('.portlet'),
    // Flash message dari partial notifications.blade.php.
    alertSuccess: () => cy.get('.alert.alert-success'),
    alertDanger: () => cy.get('.alert.alert-danger'),
    alertWarning: () => cy.get('.alert.alert-warning'),
    alertInfo: () => cy.get('.alert.alert-info'),
    // Pesan validasi Laravel di dalam alert-danger (<ul><li>...</li></ul>).
    validationItems: () => cy.get('.alert.alert-danger li'),
    // Error bawaan Bootstrap per-field (dipakai beberapa form).
    helpBlocks: () => cy.get('.help-block'),
  };

  /** Login (cy.session) lalu buka path secara langsung — tidak lewat sidebar. */
  open(path, opts = {}) {
    LoginPage.loginViaSession();
    cy.visit(path, { failOnStatusCode: false, ...opts });
    return this;
  }

  assertUrl(path) {
    cy.location('pathname').should('include', path);
    return this;
  }

  assertNotRedirectedToLogin() {
    cy.location('pathname').should('not.include', '/login');
    return this;
  }

  assertBreadcrumb(text) {
    this.common.breadcrumbActive().should('contain.text', text);
    return this;
  }

  assertDocumentTitle(text) {
    cy.title().should('include', text);
    return this;
  }

  assertSuccess(text) {
    const a = this.common.alertSuccess().should('be.visible');
    if (text) a.and('contain.text', text);
    return this;
  }

  assertError(text) {
    const a = this.common.alertDanger().should('be.visible');
    if (text) a.and('contain.text', text);
    return this;
  }

  assertNoErrorAlert() {
    cy.get('.alert.alert-danger').should('not.exist');
    return this;
  }

  // ---------------------------------------------------------------------
  // DataTables (server-side). Pola markup:
  //   <table id="data-table"> … <div id="data-table_processing"> … <td class="dataTables_empty">
  // ---------------------------------------------------------------------

  /** Tunggu DataTables selesai memuat: indikator processing tersembunyi DAN tbody berisi baris data atau empty-state. */
  waitTable(tableSel = '#data-table', timeout = 30000) {
    const id = tableSel.startsWith('#') ? tableSel.slice(1) : null;
    if (id) {
      cy.get(`#${id}_processing`, { timeout }).should(($p) => {
        // Bisa tidak ada sama sekali (DataTables client-side) atau display:none.
        if ($p.length) expect($p.css('display')).to.eq('none');
      });
    }
    cy.get(`${tableSel} tbody`, { timeout }).should(($tb) => {
      const rows = $tb.find('tr');
      expect(rows.length, 'tbody punya baris (data / empty-state)').to.be.greaterThan(0);
    });
    return this;
  }

  /** Baris data (tanpa empty-state). Panggil waitTable() dulu. */
  dataRows(tableSel = '#data-table') {
    return cy.get(`${tableSel} tbody tr`).not(':has(td.dataTables_empty)');
  }

  emptyState(tableSel = '#data-table') {
    return cy.get(`${tableSel} tbody td.dataTables_empty`);
  }

  tableHeaders(tableSel = '#data-table') {
    return cy.get(`${tableSel} thead th`);
  }

  /** Assert header kolom tabel sama persis (urutan & teks, trim). */
  assertHeaders(expected, tableSel = '#data-table') {
    this.tableHeaders(tableSel).should(($th) => {
      const actual = Cypress.$.makeArray($th).map((th) => th.innerText.replace(/\s+/g, ' ').trim());
      expect(actual).to.deep.eq(expected);
    });
    return this;
  }

  /** Kotak pencarian bawaan DataTables. */
  tableSearch(tableSel = '#data-table') {
    const id = tableSel.startsWith('#') ? tableSel.slice(1) : '';
    return cy.get(id ? `#${id}_filter input` : '.dataTables_filter input');
  }

  tableInfo(tableSel = '#data-table') {
    const id = tableSel.startsWith('#') ? tableSel.slice(1) : '';
    return cy.get(id ? `#${id}_info` : '.dataTables_info');
  }

  /**
   * Assert SETIAP baris data memenuhi predicate pada kolom tertentu (index 0-based).
   * Pakai .should(callback) + Cypress.$ agar ter-retry dan tidak flaky.
   */
  assertEveryRowColumn(colIdx, predicate, msg, tableSel = '#data-table') {
    cy.get(`${tableSel} tbody tr`).should(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
      data.forEach((r) => {
        const txt = Cypress.$(r).find('td').eq(colIdx).text().replace(/\s+/g, ' ').trim();
        expect(predicate(txt), `${msg || 'kolom'} [${txt}]`).to.eq(true);
      });
    });
    return this;
  }

  // ---------------------------------------------------------------------
  // select2 (dipakai luas di CBS: class select2me)
  // ---------------------------------------------------------------------

  /** Pilih opsi select2 berdasarkan teks — scroll dulu baru klik (opsi panjang). */
  select2(selectSel, optionText) {
    cy.get(selectSel).siblings('.select2-container').first().click();
    cy.get('.select2-results__option')
      .contains(optionText)
      .scrollIntoView()
      .should('be.visible')
      .click();
    return this;
  }

  /** Untuk <select> biasa (non-select2), atau select2 yang cukup di-set value + trigger change. */
  selectNative(selectSel, valueOrText) {
    cy.get(selectSel).select(valueOrText, { force: true });
    return this;
  }
}
