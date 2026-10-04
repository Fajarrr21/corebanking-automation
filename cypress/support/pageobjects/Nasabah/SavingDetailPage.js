// SavingDetailPage — detail rekening simpanan (/saving/{refId}).
//
// Sumber: resources/views/saving/detail.blade.php + partial saving/detail/*.
// - Tab pills (ul.nav-pills a[data-toggle=tab]); klik tab memanggil insertUrlParam('menu', x).
//   super-admin & auditor: hanya "Data Simpanan" + "Riwayat Transaksi".
//   Role lain: Data Simpanan, Setoran, Penarikan*, Cetak Buku*, Ganti Buku, Riwayat Transaksi,
//   Pengaturan, Formulir Permohonan (*hanya bila rekening punya buku tabungan).
//   Semua tab-pane SELALU dirender; `?menu=<x>` membuat pane-nya aktif saat load.
//   menu: info | deposit | withdraw | printout | saving_book | history | setting | application.
// - Data Simpanan (#tab_data): .sdm-hero-name, .sdm-balance-value, .sdm-card (.sdm-card-head),
//   .sdm-key/.sdm-val, tombol "Cetak Cover Buku Tabungan" (a[href=/saving/{ref}/print], _blank).
// - Riwayat (#tab_history): tabel #data-table-history, ajax GET /saving/{ref}/history (dimuat
//   saat halaman siap), tombol PDF (/history/export/pdf, _blank) & Excel (/history/export/excel).
//   Tombol "Lihat" per baris → window.open('/saving/{ref}/{id}/print_history').
// - Formulir Permohonan (#tab_application): #filter_head_office, #filter_account_officer
//   (value = nama penanda tangan), preview #head_office / #account_officer, tombol .print-btn
//   → window.open('/saving/print/document/{ref}?head_office=..&account_officer=..').
// - Setoran (#tab_cashin): form #form_deposit_without_saving_book (amount
//   #amount_without_saving_book, notes) → modal #cashin_pin (#cashin_pin_teller) → POST /saving/deposit.
// - Penarikan (#tab_cashout): form #form_withdraw (#cashout_amount, #cashout_last_balance,
//   #cashout_line) → modal #cashout_pin_modal (#cashout_pin_teller) → POST /saving/withdraw.
// - refId tidak ada → redirect /saving + flash "Nomor Rekening tidak ditemukan".

import BasePage from '../BasePage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

class SavingDetailPage extends BasePage {
  historyTable = '#data-table-history';

  elements = {
    tabLinks: () => cy.get('ul.nav-pills a[data-toggle="tab"]'),
    tab: (label) => cy.get('ul.nav-pills a[data-toggle="tab"]').filter((i, el) => norm(el.innerText) === label),
    pane: (id) => cy.get(`#${id}`),
    heroName: () => cy.get('#tab_data .sdm-hero-name'),
    balance: () => cy.get('#tab_data .sdm-balance-value'),
    cardHeads: () => cy.get('#tab_data .sdm-card-head'),
    card: (title) => cy.get('#tab_data .sdm-card').filter((i, el) => norm(Cypress.$(el).find('.sdm-card-head').text()) === title),
    printCover: () => cy.get('#tab_data a[href$="/print"]'),
    pdfLink: () => cy.get('#tab_history a[href$="/history/export/pdf"]'),
    excelLink: () => cy.get('#tab_history a[href$="/history/export/excel"]'),
    historyDetailBtns: () => cy.get(`${this.historyTable} tbody .detail-btn`),
    // Formulir Permohonan
    applicationPane: () => cy.get('#tab_application'),
    headOfficeSelect: () => cy.get('#filter_head_office'),
    accountOfficerSelect: () => cy.get('#filter_account_officer'),
    headOfficePreview: () => cy.get('#tab_application #head_office'),
    accountOfficerPreview: () => cy.get('#tab_application #account_officer'),
    printApplicationBtn: () => cy.get('#tab_application .print-btn'),
    // Setoran / Penarikan
    depositAmount: () => cy.get('#amount_without_saving_book'),
    depositProcessBtn: () => cy.get('#form_deposit_without_saving_book button.blue-steel'),
    depositPinModal: () => cy.get('#cashin_pin'),
    depositPinInput: () => cy.get('#cashin_pin_teller'),
    depositPinSubmit: () => cy.get('#cashin_pin .modal-footer button.blue-steel'),
    withdrawAmount: () => cy.get('#cashout_amount'),
    withdrawLine: () => cy.get('#cashout_line'),
    withdrawProcessBtn: () => cy.get('#form_withdraw button.blue-steel'),
    withdrawPinModal: () => cy.get('#cashout_pin_modal'),
    withdrawPinInput: () => cy.get('#cashout_pin_teller'),
    withdrawPinSubmit: () => cy.get('#cashout_pin_modal .modal-footer button.blue-steel'),
  };

  /** Buka detail; history DataTables di-intercept karena dimuat saat halaman siap. */
  visitDetail(refId, menu, timeout = 30000) {
    cy.intercept({ method: 'GET', pathname: `/saving/${refId}/history` }).as('savingHistory');
    this.open(`/saving/${refId}${menu ? `?menu=${menu}` : ''}`);
    return this;
  }

  waitHistory(timeout = 30000) {
    cy.wait('@savingHistory', { timeout });
    this.waitTable(this.historyTable, timeout);
    return this;
  }

  clickTab(label) {
    this.elements.tab(label).click();
    return this;
  }

  tabLabels() {
    return this.elements.tabLinks().then(($a) => Cypress.$.makeArray($a).map((a) => norm(a.innerText)));
  }

  /** Stub window.open supaya tab baru tidak dibuka; URL bisa dibaca dari alias. */
  stubWindowOpen(alias = 'winOpen') {
    cy.window().then((win) => {
      cy.stub(win, 'open').as(alias).returns({ focus: () => {} });
    });
    return this;
  }

  /** Pilih opsi pertama non-ALL dari select penanda tangan; kembalikan namanya. */
  selectFirstSigner(sel) {
    return cy.get(sel).find('option').then(($o) => {
      const opt = Cypress.$.makeArray($o).find((o) => o.value && o.value !== 'ALL');
      expect(opt, `precondition: ${sel} punya data penanda tangan (Setting Signature kantor rekening)`).to.exist;
      cy.get(sel).select(opt.value, { force: true });
      return cy.then(() => opt.value);
    });
  }
}

export default new SavingDetailPage();
