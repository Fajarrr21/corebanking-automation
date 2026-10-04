// CashflowSimpananPage — Laporan > Simpanan > Lap Cashflow (/saving-cashflow).
//
// Sumber: resources/views/report/saving/savingcashflow.blade.php,
//         ReportController@indexSavingCashflow / @getSavingCashflow (origin/develop).
// - User pusat: #filter_office (0 = Semua Cabang). Semua user: #date (yyyy-mm-dd,
//   default hari ini). Perubahan → GET /saving-cashflow/data?office_id=..&date=..
// - Tabel #data-table: Nama Produk | Transaksi Masuk | Jml Orang | Transaksi Keluar |
//   Jml Orang | Saldo Awal | Saldo Akhir. JSON key: Product, Deposit,
//   Jml_Orang_Deposit, Kredit, Jml_Orang_Kredit, Saldo_Awal, Saldo_Akhir.

import ReportBasePage from './ReportBasePage';

class CashflowSimpananPage extends ReportBasePage {
  elements = {
    filterOffice: () => cy.get('#filter_office'),
    date: () => cy.get('#date'),
    table: () => cy.get('#data-table'),
  };

  visit(fx) {
    this.interceptGet(fx.dataPath, 'cashflow');
    return this.open(fx.path);
  }

  waitData() {
    return cy.wait('@cashflow', { timeout: 120000 }).then((i) => this.expectDataTablesOk(i));
  }

  assertUserPusat() {
    cy.get('body').then(($b) => {
      expect(
        $b.find('#filter_office').length,
        'Precondition: akun test harus user PUSAT (office_id = 0) agar filter kantor #filter_office tampil',
      ).to.be.greaterThan(0);
    });
    return this;
  }

  selectFirstOffice(semuaValue) {
    return this.elements
      .filterOffice()
      .find('option')
      .then(($opts) => {
        const opt = Cypress.$.makeArray($opts).find((o) => o.value !== semuaValue && o.value !== '');
        expect(opt, 'Precondition: minimal satu kantor di filter kantor').to.exist;
        const picked = { value: opt.value, text: opt.text.trim() };
        this.elements.filterOffice().select(picked.value, { force: true });
        return cy.then(() => picked);
      });
  }
}

export default new CashflowSimpananPage();
