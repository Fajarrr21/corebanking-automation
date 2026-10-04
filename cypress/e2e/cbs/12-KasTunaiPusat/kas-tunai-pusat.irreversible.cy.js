// Kas Tunai Pusat — SETORAN/PENARIKAN SUNGGUHAN (transaksi kas, riwayat tidak bisa dihapus).
// TC sumber: docs/test-cases/src/TC_KasTunaiPusat_Transaksi.json
// Default TIDAK jalan: --env allowTransaction=true.
// Cleanup: setoran QA (IDR 1) langsung di-VOID (saldo kembali); riwayat + baris VOID tetap ada.
import LoginPage from '../../../support/pageobjects/LoginPage';
import KTPPage from '../../../support/pageobjects/KasTunaiPusat/KasTunaiPusatPage';
import DetailPage from '../../../support/pageobjects/KasTunaiPusat/KasTunaiPusatDetailPage';
import { describeIfFlag } from '../../../support/utils/flags';

describeIfFlag('allowTransaction', 'Kas Tunai Pusat - Setoran/Penarikan (irreversible)', () => {
  let fx;
  let office;

  before(() => {
    cy.fixture('kastunaipusat/kas-tunai-pusat').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    // Setelah sukses app memanggil window.open(print) — stub supaya tidak membuka tab.
    cy.on('window:before:load', (win) => {
      cy.stub(win, 'open').as('winOpen');
    });
    cy.intercept('GET', fx.dataUrl).as('ktpData');
    KTPPage.openGuarded(fx.path, fx.roleHint);
    cy.wait('@ktpData');
    KTPPage.waitTable('#kasTunai', fx.timeouts.table);
    KTPPage.firstOffice().then((o) => {
      office = o;
    });
  });

  it('TC-KTP-TRX-001 | Happy | Setoran IDR 1 menambah saldo, lalu Void mengembalikan saldo', () => {
    cy.qaName('KTP').then((note) => {
      cy.visit(office.path);
      DetailPage.balanceNumber().then((before) => {
        cy.visit(`${office.path}?menu=deposit`);
        DetailPage.elements.depositAmount().type(fx.trx.depositAmount);
        DetailPage.elements.depositNotes().clear().type(note);
        DetailPage.elements.depositSubmit().click();
        DetailPage.assertSuccess(fx.trx.depositSuccess);
        cy.visit(office.path);
        DetailPage.balanceNumber().should('eq', before + Number(fx.trx.depositAmount));

        // Cleanup: void baris riwayat ber-Catatan QA ini.
        cy.intercept('GET', '/account/center/*/history*').as('ktpHistory');
        cy.visit(`${office.path}?menu=history`);
        cy.wait('@ktpHistory');
        DetailPage.waitTable('#data-table-history', fx.timeouts.table);
        DetailPage.tableSearch('#data-table-history').type(note);
        cy.wait('@ktpHistory');
        DetailPage.dataRows('#data-table-history')
          .filter((_, tr) => Cypress.$(tr).find('td').eq(4).text().trim().startsWith('QA'))
          .first()
          .find('#void_account_centers')
          .click();
        DetailPage.elements.voidModal().should('be.visible').find('button[type="submit"]').click();
        DetailPage.assertSuccess(fx.trx.voidSuccess);
        cy.visit(office.path);
        DetailPage.balanceNumber().should('eq', before);
      });
    });
  });

  it('TC-KTP-TRX-002 | Negatif | Penarikan melebihi saldo ditolak dengan pesan saldo tidak mencukupi', () => {
    cy.visit(office.path);
    DetailPage.balanceNumber().then((before) => {
      cy.visit(`${office.path}?menu=withdraw`);
      DetailPage.elements.withdrawAmount().type(String(before + 1000000));
      cy.qaName('KTP-TARIK').then((note) => DetailPage.elements.withdrawNotes().clear().type(note));
      DetailPage.elements.withdrawSubmit().click();
      DetailPage.assertError(fx.trx.withdrawExcess);
      cy.visit(office.path);
      DetailPage.balanceNumber().should('eq', before);
    });
  });
});
