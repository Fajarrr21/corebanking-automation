// LabaRugiPage — Laporan > Umum > Lap Laba/Rugi (/profit-loss).
//
// Sumber: resources/views/report/general/profitloss.blade.php,
//         ReportController@profitLoss / @getDataProfitLoss (origin/develop).
// - User pusat: #filter_branch (999 = Akumulasi) → ajax /general-ledger/unit/{id}
//   lalu langsung draw /profit-loss/data/?date=..&office=<id>&pusat=1.
// - #date "M - yyyy" → draw ulang dengan bulan terpilih.
// - Tabel #profit-loss (Jenis Data | Akun | Jumlah (IDR)); export CSV/Excel
//   ditempel ke #buttonprofitloss.
// - Nilai balance di JSON berupa string "1234.50" (number_format tanpa ribuan).

import ReportBasePage from './ReportBasePage';

class LabaRugiPage extends ReportBasePage {
  elements = {
    caption: () => cy.get('.portlet-title .caption'),
    filterBranch: () => cy.get('#filter_branch'),
    filterUnitPusat: () => cy.get('#filter_unit_pusat'),
    date: () => cy.get('#date'),
    table: () => cy.get('#profit-loss'),
    buttonsBox: () => cy.get('#buttonprofitloss'),
    parentRows: () => cy.get('#profit-loss tbody tr').not('.child-row'),
  };

  visit(fx) {
    this.interceptGet(fx.dataPath, 'labaRugi');
    return this.open(fx.path);
  }

  waitData() {
    return cy.wait('@labaRugi', { timeout: 120000 }).then((i) => this.expectDataTablesOk(i));
  }

  assertUserPusat() {
    cy.get('body').then(($b) => {
      expect(
        $b.find('#filter_branch').length,
        'Precondition: akun test harus user PUSAT (office_id = 0) agar filter kantor #filter_branch tampil',
      ).to.be.greaterThan(0);
    });
    return this;
  }

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

export default new LabaRugiPage();
