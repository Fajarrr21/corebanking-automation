// NeracaPage — Laporan > Umum > Neraca (/sheet-balance).
//
// Sumber: resources/views/report/general/sheetbalance.blade.php,
//         ReportController@sheetBalance / @getDataNeraca (origin/develop).
// - Filter kantor hanya untuk user pusat (office_id = 0): #filter_branch
//   (opsi "Akumulasi" = 999) + #filter_unit_pusat. User cabang: #filter_unit.
// - Filter bulan: #date (readonly, format "M - yyyy"), handler change → ajax
//   GET /sheet-balance/data?date=..&office=..&pusat=..
// - Tabel #neraca-perusahaan (Jenis Data | Akun | Jumlah (IDR)), paging off,
//   baris anak (_children) diratakan di client dengan class `child-row`.

import ReportBasePage from './ReportBasePage';

class NeracaPage extends ReportBasePage {
  elements = {
    caption: () => cy.get('.portlet-title .caption'),
    filterBranch: () => cy.get('#filter_branch'),
    filterUnitPusat: () => cy.get('#filter_unit_pusat'),
    filterUnit: () => cy.get('#filter_unit'),
    date: () => cy.get('#date'),
    table: () => cy.get('#neraca-perusahaan'),
    parentRows: () => cy.get('#neraca-perusahaan tbody tr').not('.child-row'),
  };

  visit(fx) {
    this.interceptGet(fx.dataPath, 'neraca');
    return this.open(fx.path);
  }

  /** Tunggu response data neraca (200) — yield body. */
  waitData() {
    return cy.wait('@neraca', { timeout: 120000 }).then((i) => this.expectDataTablesOk(i));
  }

  /** Precondition user pusat (filter kantor ada). Gagal dengan pesan jelas bila tidak. */
  assertUserPusat() {
    cy.get('body').then(($b) => {
      expect(
        $b.find('#filter_branch').length,
        'Precondition: akun test harus user PUSAT (office_id = 0) agar filter kantor #filter_branch tampil',
      ).to.be.greaterThan(0);
    });
    return this;
  }

  /** Pilih kantor cabang pertama (bukan Akumulasi) — yield {value, text}. */
  selectFirstBranch(akumulasiValue) {
    return this.elements
      .filterBranch()
      .find('option')
      .then(($opts) => {
        const opt = Cypress.$.makeArray($opts).find((o) => o.value !== akumulasiValue && o.value !== '');
        expect(opt, 'Precondition: minimal satu kantor cabang di filter kantor').to.exist;
        const picked = { value: opt.value, text: opt.text.trim() };
        this.elements.filterBranch().select(picked.value, { force: true });
        return cy.then(() => picked);
      });
  }
}

export default new NeracaPage();
