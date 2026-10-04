// GeneralLedgerPage — /transaction/general_ledger (TransactionController@generalLedger).
// View: resources/views/transaction/general_ledger/index.blade.php + partial
//   accounting.blade.php (#accounting_form)      tab "Pembukuan"
//   overbooking.blade.php (#overbooking_form)    tab "Overbooking GL"
//   history.blade.php (#data-table-history)      tab "Riwayat"
//   historygl.blade.php (#data-table-history-gl) tab "Riwayat Akun GL"
//   masstransaction.blade.php                    tab "Overbooking Massal"
//   mass_saving_transaction.blade.php (#mass-saving-form) tab "Transaksi Massal Simpanan"
// Tab aktif via query ?menu=<key>. Validasi form Pembukuan/Overbooking memakai
// jQuery Validate default (.valid()) -> field invalid diberi aria-invalid="true".
import RoleGuardPage from './RoleGuardPage';

class GeneralLedgerPage extends RoleGuardPage {
  elements = {
    tabLink: (hash) => cy.get(`ul.nav-pills a[href="${hash}"]`),
    tabPane: (hash) => cy.get(`${hash}.tab-pane`),
    caption: (hash) => cy.get(`${hash} .caption-subject`).first(),

    // --- Pembukuan
    accForm: () => cy.get('form#accounting_form'),
    accJournal: () => cy.get('#accounting_form select#journal'),
    accTeller: () => cy.get('#accounting_teller_user'),
    accAmount: () => cy.get('#accounting_amount'),
    accNotes: () => cy.get('#accounting_form input[name="notes"]'),
    accBackdateCheck: () => cy.get('#accounting_is_backdate'),
    accBackdateDate: () => cy.get('#accounting_backdate_date'),
    accSubmit: () => cy.get('#accounting_form button.btn.blue-steel'),
    accPinModal: () => cy.get('#accounting_pinspv'),

    // --- Overbooking GL
    obForm: () => cy.get('form#overbooking_form'),
    obName: () => cy.get('#overbooking_form input[name="name"]'),
    obDebit: () => cy.get('#overbooking_form select#account_debit'),
    obCredit: () => cy.get('#overbooking_form select#account_credit'),
    obTeller: () => cy.get('#overbooking_teller_user'),
    obTellerHelp: () => cy.get('#overbooking_teller_user').closest('.form-group').find('.help-block'),
    obAmount: () => cy.get('#overbooking_amount'),
    obNotes: () => cy.get('#overbooking_form input[name="notes"]'),
    obBackdateCheck: () => cy.get('#overbooking_is_backdate'),
    obBackdateDate: () => cy.get('#overbooking_backdate_date'),
    obBackdateHelp: () => cy.get('#overbooking_backdate_help'),
    obSubmit: () => cy.get('#overbooking_form button.btn.blue-steel'),
    obPinModal: () => cy.get('#overbooking_pinspv'),
    obModalSpv: () => cy.get('#overbooking_modal_spv_user'),
    obModalPin: () => cy.get('#overbooking_modal_pin_spv'),
    obModalProcess: () => cy.get('#overbooking_form_pin button[type="submit"]'),

    // --- Riwayat
    historyType: () => cy.get('#history_filter_type'),
    historyDate1: () => cy.get('#date'),
    historyDate2: () => cy.get('#date2'),
    historyExportButtons: () => cy.get('#history .dt-buttons a, #history .dt-buttons button, #buttonhistory a, #buttonhistory button'),

    // --- Overbooking Massal
    massAlert: () => cy.get('#mass_transaction_alert'),
    massOffice: () => cy.get('#office_id'),
    massType: () => cy.get('#transaction_type'),
    massDebitSection: () => cy.get('#debit_section'),
    massCreditSection: () => cy.get('#credit_section'),
    massMainDebit: () => cy.get('#main_debit_account'),
    massMainCredit: () => cy.get('#main_credit_account'),
    massAddCredit: () => cy.get('#debit_section button').contains('Tambah Kredit'),
    massAddDebit: () => cy.get('#credit_section button').contains('Tambah Debit'),
    massCreditRows: () => cy.get('#credit_rows .credit-row'),
    massDebitRows: () => cy.get('#debit_rows .debit-row'),
    massProcess: () => cy.get('#btn_process_mass_transaction'),
    massPinModal: () => cy.get('#mass_transaction_pinspv'),
    massPinInput: () => cy.get('#mass_transaction_modal_pin_user'),
    massFieldErrors: () => cy.get('#masstransaction .help-block-error'),

    // --- Transaksi Massal Simpanan
    msForm: () => cy.get('form#mass-saving-form'),
    msType: () => cy.get('#mass-saving-form select[name="transaction_type"]'),
    msPosition: () => cy.get('#mass-saving-form select[name="gl_position"]'),
    msFile: () => cy.get('#mass-saving-form input[type="file"][name="file"]'),
    msTemplateLink: () => cy.get('#mass-saving-form a[href*="Setoran Simpanan"]'),
    msOffice: () => cy.get('#mass-saving-form #office'),
    msAccountGl: () => cy.get('#mass-saving-form #account_gl'),
    msAllowNegative: () => cy.get('#allow_negative_balance'),
    msProcess: () => cy.get('#btn_process_mass_saving'),
    msPinModal: () => cy.get('#mass_saving_pin_modal'),
    msPinInput: () => cy.get('#mass_saving_pin_input'),
    msAlert: () => cy.get('#mass_saving_alert'),
    msErrorFor: (name) => cy.get(`#mass-saving-form span.help-block-error[id="${name}-error"]`),
  };

  /** Buka GL langsung di tab tertentu (?menu=). */
  openMenu(menu, roleHint) {
    return this.openGuarded(`/transaction/general_ledger?menu=${menu}`, roleHint);
  }

  /** Pilih option ke-n (index >= 1, lewati placeholder) dari <select> select2me via jQuery app. */
  pickOptionByIndex(sel, idx = 1) {
    cy.get(`${sel} option`).should('have.length.greaterThan', idx);
    cy.window().then((win) => {
      const $s = win.$(sel);
      const v = $s.find('option').eq(idx).val();
      $s.val(v).trigger('change');
    });
    return this;
  }

  /** Field yang ditandai invalid oleh jQuery Validate. */
  invalidField(formSel, name) {
    return cy.get(`${formSel} [name="${name}"]`).should('have.attr', 'aria-invalid', 'true');
  }
}

export default new GeneralLedgerPage();
