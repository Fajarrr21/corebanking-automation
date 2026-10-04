// LaporanSubPage — halaman sub-laporan generik (pola sama: breadcrumb, filter,
// DataTables server-side + tombol CSV/Excel). Dipakai untuk laporan yang belum
// punya PRD (smoke + struktur kolom dari source).
//
// Definisi tiap laporan (path, breadcrumb, table, dataPath, headers) ada di
// cypress/fixtures/laporan/laporan.json → `reports`.

import ReportBasePage from './ReportBasePage';

class LaporanSubPage extends ReportBasePage {
  elements = {
    table: (sel) => cy.get(sel),
  };

  visit(report) {
    this.interceptGet(report.dataPath, 'reportData');
    return this.open(report.path);
  }

  /**
   * Pemeriksaan standar laporan: tidak dilempar ke login, breadcrumb, header
   * kolom (urutan & teks persis dari source), request data 200, tabel selesai
   * dimuat (baris data / empty-state), tombol export CSV & Excel tampil.
   */
  assertStandardReport(report, timeout) {
    this.assertNotRedirectedToLogin();
    this.assertUrl(report.path);
    this.assertBreadcrumb(report.breadcrumb);
    this.assertHeaders(report.headers, report.table);
    cy.wait('@reportData', { timeout }).then((i) => this.expectDataTablesOk(i));
    this.waitTable(report.table, timeout);
    this.exportButton('csv').should('be.visible');
    this.exportButton('excel').should('be.visible');
    return this;
  }
}

export default new LaporanSubPage();
