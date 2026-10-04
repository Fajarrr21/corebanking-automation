// RkaReportPage — Laporan RKA Account Officer (/report/rka-officer) dan
// Laporan RKA Unit (/report/rka-unit). Diakses dari Laporan > Umum
// (/report/general, kartu "Lap RKA Unit" / "Lap RKA Account Officer").
//
// Sumber (origin/develop):
//   view  : resources/views/report/rka-officer/index.blade.php
//           resources/views/report/rka-unit/index.blade.php
//   ctrl  : app/Http/Controllers/RkaReportController.php
//   route : report.rkaofficer.* & report.rkaunit.* (routes/web.php:545-554)
//
// Struktur tabel #reportTable (setelah Tampilkan):
//   0 No | 1 Indikator | 2 Realisasi Tahun Lalu | 3 Target Tahun Ini |
//   4..15 Target per Bulan (Jan..Des, kumulatif) | 16 Realisasi | 17 Pencapaian |
//   18 Bobot | 19 Score.  Baris judul grup = tr.group-header.

import BasePage from '../BasePage';

class RkaReportPage extends BasePage {
  officerPath = '/report/rka-officer';

  unitPath = '/report/rka-unit';

  elements = {
    officerFilter: () => cy.get('#filter_officer'),
    branchFilter: () => cy.get('#filter_branch'),
    unitFilter: () => cy.get('#filter_unit'),
    unitGroup: () => cy.get('#filter_unit').closest('.col-md-4'),
    yearFilter: () => cy.get('#filter_year'),
    monthFilter: () => cy.get('#filter_month'),
    filterLabels: () => cy.get('.filter-card label'),
    btnFilter: () => cy.get('#btnFilter'),
    btnExport: () => cy.get('#btnExport'),
    reportSection: () => cy.get('#reportSection'),
    tableHead: () => cy.get('#reportTable thead'),
    body: () => cy.get('#reportTableBody'),
    dataRows: () => cy.get('#reportTableBody tr').not('.group-header'),
    emptyTitle: () => cy.get('#reportTableBody .empty-title'),
    totalBobot: () => cy.get('#totalBobot'),
    totalScore: () => cy.get('#totalScore'),
    statTotal: () => cy.get('#statTotal'),
  };

  visitOfficer() {
    this.open(this.officerPath);
    return this;
  }

  visitUnit() {
    this.open(this.unitPath);
    return this;
  }

  /** Status HTTP halaman (tanpa gagal otomatis) — dipakai untuk memastikan halaman tidak error 500. */
  pageStatus(path) {
    return cy.request({ url: path, failOnStatusCode: false }).its('status');
  }

  /** Teks header tabel laporan (dua baris thead digabung). */
  headerTexts() {
    return this.elements.tableHead().find('th').then(($th) => Cypress.$.makeArray($th).map((th) => th.innerText.replace(/\s+/g, ' ').trim()));
  }

  selectOfficer(value) {
    this.elements.officerFilter().select(String(value), { force: true });
    return this;
  }

  selectYear(year) {
    this.elements.yearFilter().select(String(year), { force: true });
    return this;
  }

  show() {
    this.elements.btnFilter().click();
    return this;
  }

  /** Parse baris data laporan → [{ indicator, weight, achievement, score }]. */
  parsedRows() {
    return this.elements.dataRows().then(($rows) => Cypress.$.makeArray($rows).map((tr) => {
      const td = Cypress.$(tr).find('td');
      const num = (i) => Number(td.eq(i).text().replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      const pct = (i) => Number(td.eq(i).text().replace(/[^0-9.-]/g, ''));
      return {
        cells: td.length,
        indicator: td.eq(1).text().trim(),
        targetThisYear: num(3),
        achievement: pct(17),
        weight: pct(18),
        score: pct(19),
      };
    }));
  }
}

export default new RkaReportPage();
