// PinjamanAktifExportPage — hanya bagian EXPORT di halaman Nasabah > Pinjaman Aktif (/loan),
// dipakai alur PRD "BKDP - Laporan Nominatif" & "Download Pinjaman Aktif":
// klik "Export Excel" → GET /export/loan?office=..&product=..&status=.. →
// DownloadController@exportloan membuat baris Download (SCHEDULED) + dispatch
// DownloadJob → redirect ke /loan dengan flash sukses.
//
// Sumber: resources/views/loan/index.blade.php (exportLoan()), DownloadController.
// Halaman /loan selebihnya milik modul Nasabah — tidak dimodelkan di sini.

import BasePage from '../BasePage';

class PinjamanAktifExportPage extends BasePage {
  elements = {
    exportBtn: (fx) => cy.get(fx.exportBtn),
  };

  visit(fx) {
    return this.open(fx.loanPath);
  }

  clickExport(fx) {
    cy.intercept({ method: 'GET', url: new RegExp(`${fx.exportPathPrefix}\\?`) }).as('exportLoan');
    this.elements
      .exportBtn(fx)
      .should('be.visible')
      .and(($a) => expect($a.text().replace(/\s+/g, ' ').trim()).to.eq(fx.exportBtnLabel))
      .click();
    return this;
  }
}

export default new PinjamanAktifExportPage();
