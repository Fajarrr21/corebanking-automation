// CollateralListPage — /collateral "Daftar Agunan" (CollateralController, tanpa cek role).
// View: resources/views/collateral/index.blade.php
//   tabel #data-table-collateral (DataTables server-side GET /collateral/data)
//   kolom Nomor Dokumen & Jenis Agunan dirender client-side dari row.type
//   aksi "Lihat" -> /loan/{refId}?menu=collateral (target=_blank)
import BasePage from '../BasePage';

class CollateralListPage extends BasePage {
  elements = {
    sidebarMenu: (title) =>
      cy
        .get('ul.page-sidebar-menu > li > a > span.title')
        .filter((_, el) => el.innerText.trim() === title),
    jenisFilter: () => cy.get('select').filter('[name*="type"], [id*="type"], [id*="jenis"], [name*="jenis"]'),
  };

  /** Baris data (array elemen) tanpa empty-state. */
  dataRowEls(tableSel) {
    return cy.get(`${tableSel} tbody tr`).then(($tr) =>
      Cypress.$.makeArray($tr).filter((tr) => !Cypress.$(tr).find('td.dataTables_empty').length),
    );
  }

  /** Teks sel kolom col. */
  static cell(tr, col) {
    return Cypress.$(tr).find('td').eq(col).text().replace(/\s+/g, ' ').trim();
  }

  /** Ketik di search DataTables lalu tunggu ajax alias. */
  search(tableSel, text, alias) {
    this.tableSearch(tableSel).clear().type(text);
    cy.wait(alias);
    this.waitTable(tableSel);
    return this;
  }
}

export const cell = CollateralListPage.cell;
export default new CollateralListPage();
