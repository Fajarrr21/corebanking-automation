/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Angsuran.json (TC-LOAN-BAYAR-006..008)
// ⚠️ TRANSAKSI KEUANGAN — TIDAK BISA DIBATALKAN (pembatalan hanya lewat void ber-PIN supervisor & jurnal balik).
//   - Dibungkus describeIfFlag('allowLoanPayment') → default di-skip.
//   - Hanya pada pinjaman milik nasabah QA (nama rekening diawali "QA"): fixture data.refIdQaAngsuran (aktif)
//     dan data.refIdQaDh (daftar hitam). Kosong / bukan QA → test gagal dengan pesan jelas.
//   - PIN staff dibaca dari Cypress.env('loanPin') (taruh di cypress.env.json, JANGAN commit). Akun harus
//     role non super-admin/auditor pada cabang yang sama dengan rekening (tab Angsuran baru tampil).
//   - TC-006 (PIN salah) juga di sini: POST transaksi sungguhan yang ditolak CheckPinRule; tetap di-gate agar
//     tidak pernah terkirim tanpa sengaja.
// Jalankan: npx cypress run --spec "cypress/e2e/cbs/06-Nasabah/Pinjaman/loan-payment.irreversible.cy.js" --env allowLoanPayment=true
import { describeIfFlag } from '../../../../support/utils/flags';
import LoanDetailPage, { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describeIfFlag('allowLoanPayment', 'Nasabah - Pinjaman - Pembayaran Angsuran (transaksi)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  const openQaLoan = (refId, key) => {
    expect(refId, `precondition: isi fixture data.${key} dengan refId pinjaman milik nasabah QA`).to.be.a('string').and.not.be.empty;
    LoanDetailPage.openDetail(fx.paths.detail, refId, 'installment');
    cy.get('body').then(($b) => {
      expect($b.find(fx.payment.tabInstallment).length, fx.payment.rolePrecondition).to.be.greaterThan(0);
    });
    cy.get('#tab_data').invoke('text').then((t) => {
      expect(norm(t), 'pinjaman harus milik nasabah QA (nama diawali "QA")').to.match(/Nama\s*:?\s*QA/);
    });
  };

  const bayar = (formSel, modalSel, pin) => {
    cy.get(`${formSel} [name="principal"]`).clear().type(fx.payment.contohPokok);
    cy.get(`${formSel} [name="interest"]`).clear().type(fx.payment.contohBunga);
    cy.get(`${formSel} ${fx.payment.notes}`).clear().type('QA otomasi angsuran');
    cy.contains(`${formSel} button`, fx.payment.btnProses).click();
    cy.get(modalSel).should('be.visible').find('input[name="pin"]').type(pin, { log: false });
    cy.get(modalSel).contains('button[type="submit"]', fx.payment.btnProses).click();
  };

  it('TC-LOAN-BAYAR-006 | Negatif | PIN salah menolak pembayaran angsuran dengan pesan error', () => {
    openQaLoan(fx.data.refIdQaAngsuran, 'refIdQaAngsuran');
    expect(Cypress.env('loanPin'), 'PIN uji tidak boleh sama dengan nilai PIN salah').not.to.eq(fx.payment.pinSalahValue);
    bayar(fx.payment.form, fx.payment.modalPin, fx.payment.pinSalahValue);
    LoanDetailPage.assertError(fx.payment.pinSalah);
  });

  it('TC-LOAN-BAYAR-007 | Happy | Pembayaran angsuran dengan PIN benar berhasil dan tercatat pada riwayat', () => {
    const pin = Cypress.env('loanPin');
    expect(pin, 'precondition: Cypress.env("loanPin") berisi PIN staff akun test').to.be.ok;
    openQaLoan(fx.data.refIdQaAngsuran, 'refIdQaAngsuran');
    cy.request({ url: fx.paths.history.replace('{refId}', fx.data.refIdQaAngsuran), qs: { draw: 1, start: 0, length: -1 } })
      .its('body.recordsTotal').then((before) => {
        bayar(fx.payment.form, fx.payment.modalPin, String(pin));
        LoanDetailPage.assertSuccess('Pembayaran angsuran berhasil diproses');
        cy.request({ url: fx.paths.history.replace('{refId}', fx.data.refIdQaAngsuran), qs: { draw: 1, start: 0, length: -1 } })
          .its('body.recordsTotal').should('be.greaterThan', before);
      });
  });

  it('TC-LOAN-BAYAR-008 | Happy | Pembayaran angsuran pinjaman DH dengan PIN benar berhasil', () => {
    const pin = Cypress.env('loanPin');
    expect(pin, 'precondition: Cypress.env("loanPin") berisi PIN staff akun test').to.be.ok;
    openQaLoan(fx.data.refIdQaDh, 'refIdQaDh');
    bayar(fx.payment.formDh, '#modal_pin_payment_blacklist', String(pin));
    LoanDetailPage.assertSuccess();
  });
});
