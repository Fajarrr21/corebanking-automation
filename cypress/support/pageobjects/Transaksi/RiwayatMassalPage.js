// RiwayatMassalPage — /transaction/mass-history (TransactionController@massHistory).
// View: resources/views/transaction/mass-history/index.blade.php.
// DataTables ajax GET /transaction/mass-history/data, param date_from/date_to
// diambil dari #date/#date2 (readonly) -> change => ajax.reload().
import RoleGuardPage from './RoleGuardPage';

class RiwayatMassalPage extends RoleGuardPage {
  elements = {
    date1: () => cy.get('#date'),
    date2: () => cy.get('#date2'),
    exportWrap: () => cy.get('#buttonhistorymassal'),
    voidModal: () => cy.get('#modalVoid'),
    voidButtons: () => cy.get('#data-table tbody .btn-void'),
  };

  setRange(from, to) {
    // #date di-set tanpa trigger, lalu #date2 + change -> SATU redraw dgn kedua tanggal.
    cy.window().then((win) => {
      win.$('#date').val(from);
      win.$('#date2').val(to).trigger('change');
    });
    return this;
  }
}

export default new RiwayatMassalPage();
