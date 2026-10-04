// KasTunaiPusatDetailPage — /account/center/{officeId} (AccountCenterController@detail).
// View: resources/views/account_center/detail.blade.php + detail/{data,cashin,cashout,printout,history}.
// Tab nav-pills ?menu=info|deposit|withdraw|printout|history.
// Form Setoran/Penarikan: <input required name="balance"> (inputmask IDR) + <textarea required name="notes">
// -> validasi HTML5 native (browser memblok submit bila kosong).
import RoleGuardPage from '../Transaksi/RoleGuardPage';

class KasTunaiPusatDetailPage extends RoleGuardPage {
  elements = {
    tabLink: (hash) => cy.get(`ul.nav-pills a[href="${hash}"]`),
    tabPane: (hash) => cy.get(`${hash}.tab-pane`),
    dataTable: () => cy.get('#tab_data table'),
    dataValue: (label) => cy.get('#tab_data table tbody tr').filter(`:contains("${label}")`).find('td.sbold'),
    // Setoran
    depositForm: () => cy.get('#tab_cashin form'),
    depositAmount: () => cy.get('#cashInAccountCenter'),
    depositNotes: () => cy.get('#tab_cashin textarea[name="notes"]'),
    depositSubmit: () => cy.get('#tab_cashin button[type="submit"]'),
    // Penarikan
    withdrawForm: () => cy.get('#tab_cashout form'),
    withdrawBalance: () => cy.get('#balanceAccountCenter'),
    withdrawAmount: () => cy.get('#cashOutAccountCenter'),
    withdrawNotes: () => cy.get('#tab_cashout textarea[name="notes"]'),
    withdrawSubmit: () => cy.get('#tab_cashout button[type="submit"]'),
    // Cetak buku
    printLastBalance: () => cy.get('#printout_last_balance'),
    printLine: () => cy.get('#form_print_out input[name="line"]'),
    printButton: () => cy.get('#form_print_out button').contains('Cetak'),
    // Riwayat
    historyTable: () => cy.get('#data-table-history'),
    voidModal: () => cy.get('#void_account_center'),
  };

  /** Saldo pada tab Data Kantor sebagai angka (format "1.234.567" / "1.234.567,00"). */
  balanceNumber() {
    return this.elements.dataValue('Saldo').first().invoke('text').then((t) => {
      const n = Number(t.replace(/[^0-9,]/g, '').split(',')[0]);
      return cy.then(() => n);
    });
  }
}

export default new KasTunaiPusatDetailPage();
