// Simpanan Nasabah — Setoran & Penarikan tunai (TRANSAKSI KEUANGAN, TIDAK BISA DIBATALKAN).
// Hanya jalan dengan --env allowSavingTransaction=true.
// TC sumber: docs/test-cases/src/TC_Simpanan_Transaksi.json
//
// Precondition (dicek di awal, gagal jelas bila tidak terpenuhi):
// - Akun test ber-role teller/CS cabang (tab Setoran tampil; super-admin/auditor tidak punya tab ini).
// - fixture nasabah/saving.json → transaction.refId = rekening simpanan ACTIVE milik test
//   (account_name diawali "QA"), dan rekening punya buku tabungan (untuk Penarikan).
// - PIN teller di --env tellerPin=<pin> (JANGAN ditulis di fixture/spec).
// - Kas teller mencukupi. Setoran & penarikan memakai nominal sama → saldo nasabah kembali.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import SavingDetailPage from '../../../../support/pageobjects/Nasabah/SavingDetailPage';
import { describeIfFlag } from '../../../../support/utils/flags';

describeIfFlag('allowSavingTransaction', 'Nasabah - Simpanan - Setoran & Penarikan (irreversible)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/saving').then((d) => {
      fx = d;
    });
  });

  const readBalance = () => SavingDetailPage.elements.balance().invoke('text').then((t) => cy.parseRupiah(t));

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.then(() => {
      if (!fx.transaction.refId) {
        throw new Error('Precondition: isi fixture nasabah/saving.json → transaction.refId dengan rekening simpanan milik test (nama QA...).');
      }
      if (!Cypress.env('tellerPin')) {
        throw new Error('Precondition: jalankan dengan --env tellerPin=<PIN teller akun test>.');
      }
    });
    LoginPage.loginViaSession();
    cy.then(() => SavingDetailPage.visitDetail(fx.transaction.refId));
    SavingDetailPage.elements.heroName().invoke('text').then((n) => {
      expect(n.trim().startsWith(fx.transaction.qaNamePrefix), 'rekening transaksi HARUS milik test (nama diawali QA)').to.eq(true);
    });
    SavingDetailPage.tabLabels().then((labels) => {
      if (!labels.includes(fx.transaction.depositTab)) {
        throw new Error('Precondition tidak terpenuhi: tab Setoran tidak tampil — akun test super-admin/auditor. Butuh akun teller cabang.');
      }
    });
  });

  it('TC-SMP-TRX-001 | Happy | Setoran tunai tanpa buku menambah saldo rekening', () => {
    readBalance().then((before) => {
      SavingDetailPage.clickTab(fx.transaction.depositTab);
      SavingDetailPage.elements.depositAmount().type(fx.transaction.amount, { delay: 0 });
      SavingDetailPage.elements.depositProcessBtn().click();
      SavingDetailPage.elements.depositPinModal().should('be.visible');
      SavingDetailPage.elements.depositPinInput().type(Cypress.env('tellerPin'), { log: false, delay: 0 });
      SavingDetailPage.elements.depositPinSubmit().click();
      cy.location('search', { timeout: fx.timeout }).should('include', 'menu=deposit');
      SavingDetailPage.assertSuccess(fx.transaction.depositSuccess);
      readBalance().should('eq', before + Number(fx.transaction.amount));
    });
  });

  it('TC-SMP-TRX-002 | Negatif | Setoran dengan PIN salah ditolak dan saldo tidak berubah', () => {
    readBalance().then((before) => {
      SavingDetailPage.clickTab(fx.transaction.depositTab);
      SavingDetailPage.elements.depositAmount().type(fx.transaction.amount, { delay: 0 });
      SavingDetailPage.elements.depositProcessBtn().click();
      SavingDetailPage.elements.depositPinModal().should('be.visible');
      SavingDetailPage.elements.depositPinInput().type(fx.transaction.wrongPin, { delay: 0 });
      SavingDetailPage.elements.depositPinSubmit().click();
      SavingDetailPage.assertError(fx.transaction.wrongPinMsg);
      SavingDetailPage.visitDetail(fx.transaction.refId);
      readBalance().should('eq', before);
    });
  });

  it('TC-SMP-TRX-003 | Happy | Penarikan tunai mengurangi saldo rekening', () => {
    SavingDetailPage.tabLabels().then((labels) => {
      if (!labels.includes(fx.transaction.withdrawTab)) {
        throw new Error('Precondition tidak terpenuhi: tab Penarikan hanya tampil bila rekening punya buku tabungan.');
      }
    });
    readBalance().then((before) => {
      expect(before, 'precondition: saldo cukup untuk penarikan').to.be.at.least(Number(fx.transaction.amount));
      SavingDetailPage.clickTab(fx.transaction.withdrawTab);
      SavingDetailPage.elements.withdrawAmount().type(fx.transaction.amount, { delay: 0 });
      SavingDetailPage.elements.withdrawProcessBtn().click();
      SavingDetailPage.elements.withdrawPinModal().should('be.visible');
      SavingDetailPage.elements.withdrawPinInput().type(Cypress.env('tellerPin'), { log: false, delay: 0 });
      SavingDetailPage.elements.withdrawPinSubmit().click();
      cy.location('search', { timeout: fx.timeout }).should('include', 'menu=withdraw');
      SavingDetailPage.assertSuccess(fx.transaction.withdrawSuccess);
      readBalance().should('eq', before - Number(fx.transaction.amount));
    });
  });
});
