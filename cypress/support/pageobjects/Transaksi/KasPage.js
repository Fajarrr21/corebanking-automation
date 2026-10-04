// KasPage — /transaction/cash (route transaction.cash, TransactionController@cash).
// View: resources/views/transaction/cash/index.blade.php (+ in/out/ininduk/outinduk/
// in_other_branch/out_other_branch/history). Tab nav-pills, ?menu=<key>.
// Validasi client-side: checkInTotal()/checkOutTotal() -> window.alert bila total 0,
// selain itu membuka modal PIN Supervisor (#in_pinspv / #out_pinspv).
import RoleGuardPage from './RoleGuardPage';

class KasPage extends RoleGuardPage {
  elements = {
    tabLink: (hash) => cy.get(`ul.nav-pills a[href="${hash}"]`),
    tabPane: (hash) => cy.get(`${hash}.tab-pane`),
    // Bon Kas Teller (#in)
    inForm: () => cy.get('form#in_form'),
    inCount: (denom) => cy.get(`#in_${denom}`),
    inSubtotal: (denom) => cy.get(`#in_total_${denom}`),
    inTotal: () => cy.get('#in_total'),
    inProcess: () => cy.get('#in_form a.btn.blue-steel'),
    inPinModal: () => cy.get('#in_pinspv'),
    inModalTotal: () => cy.get('#in_total_text'),
    inModalSpv: () => cy.get('#in_modal_spv_user'),
    inModalPin: () => cy.get('#in_modal_pin_spv'),
    inModalCancel: () => cy.get('#in_pinspv button[data-dismiss="modal"]').contains('Batal'),
    // Setor Kas Teller (#out)
    outForm: () => cy.get('form#out_form'),
    outCount: (denom) => cy.get(`#out_${denom}`),
    outTotal: () => cy.get('#out_total'),
    outCashSystem: () => cy.get('#out_cash_system'),
    outDifferent: () => cy.get('#out_different'),
    outProcess: () => cy.get('#out_form a.btn.blue-steel'),
    outPinModal: () => cy.get('#out_pinspv'),
    // Riwayat (#history)
    historyTable: () => cy.get('#history table#data-table'),
  };

  /** Isi lembar pecahan Bon Kas Teller. counts = { '100_000': 2, ... } */
  fillInCounts(counts) {
    Object.entries(counts).forEach(([denom, n]) => {
      this.elements.inCount(denom).clear().type(String(n)).trigger('keyup').trigger('change');
    });
    return this;
  }

  fillOutCounts(counts) {
    Object.entries(counts).forEach(([denom, n]) => {
      this.elements.outCount(denom).clear().type(String(n)).trigger('keyup').trigger('change');
    });
    return this;
  }
}

export default new KasPage();
