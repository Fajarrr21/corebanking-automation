// KasTunaiPusatPage — /account/center (AccountCenterController@index, super-admin).
// View: resources/views/account_center/index.blade.php
//   kartu ringkasan: <strong id="withdraw"> & <strong id="deposit">
//   tabel #kasTunai (DataTables server-side, GET /account/center/data):
//     kolom [aksi 'Lihat' -> /account/center/{officeId} target=_blank, Kantor, Saldo]
// ⚠️ GET /account/center/data MEMBUAT baris account_centers untuk kantor yang belum
//    punya (AccountCenterController@data) — efek samping di GET, tidak bisa diblok guard.
import RoleGuardPage from '../Transaksi/RoleGuardPage';

class KasTunaiPusatPage extends RoleGuardPage {
  elements = {
    cardByLabel: (label) => cy.contains('span', label).parent(),
    depositValue: () => cy.get('strong#deposit'),
    withdrawValue: () => cy.get('strong#withdraw'),
    table: () => cy.get('#kasTunai'),
    viewLinks: () => cy.get('#kasTunai tbody a.btn').filter(':contains("Lihat")'),
    exportButtons: () => cy.get('.dt-buttons'),
  };

  /** Ambil href detail + nama kantor baris data pertama. */
  firstOffice() {
    return this.dataRows('#kasTunai').first().then(($tr) => {
      const href = Cypress.$($tr).find('a.btn').attr('href');
      const name = Cypress.$($tr).find('td').eq(1).text().trim();
      return cy.then(() => ({ href, path: new URL(href).pathname, name }));
    });
  }
}

export default new KasTunaiPusatPage();
