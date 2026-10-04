// RiwayatKasirPage — /transaction/history (TransactionController@history).
// View: resources/views/transaction/history/index.blade.php.
// CATATAN: DataTables halaman ini memanggil /transaction/general_ledger/history_gl/data
// (BUKAN /transaction/history/data) dengan query ?date=&date2=&type=.
// Filter tanggal (#date/#date2, readonly datepicker) & #filter_type -> redraw tabel.
import RoleGuardPage from './RoleGuardPage';

class RiwayatKasirPage extends RoleGuardPage {
  elements = {
    note: () => cy.get('.note p, .note').first(),
    filterType: () => cy.get('#filter_type'),
    date1: () => cy.get('#date'),
    date2: () => cy.get('#date2'),
    exportWrap: () => cy.get('#buttonhistorykasir'),
    voidModal: () => cy.get('#in_pinspv'),
    voidButtons: () => cy.get('#data-table tbody a#void'),
  };

  /** Set rentang tanggal (input readonly) lalu trigger change -> tabel redraw. */
  setRange(from, to) {
    // #date di-set tanpa trigger, lalu #date2 + change -> SATU redraw dgn kedua tanggal.
    cy.window().then((win) => {
      win.$('#date').val(from);
      win.$('#date2').val(to).trigger('change');
    });
    return this;
  }
}

export default new RiwayatKasirPage();
