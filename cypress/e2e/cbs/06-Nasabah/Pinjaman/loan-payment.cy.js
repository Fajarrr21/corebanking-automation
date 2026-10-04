/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Angsuran.json (TC-LOAN-BAYAR-001..005)
// PRD: "Angsuran Pinjaman Aktif - BKD Pekalongan" & "Angsuran Pinjaman DH - BKD Pekalongan".
// Read-only: form angsuran diisi tapi TIDAK pernah dikirim (modal PIN dibatalkan). Write-guard aktif.
// Precondition role: tab Angsuran (#tab_installment) hanya dirender untuk role selain super-admin/auditor yang
// kantornya sama dengan rekening (detail.blade.php). Bila tidak ada → test GAGAL dengan pesan jelas.
// Transaksi sungguhan ada di loan-payment.irreversible.cy.js (flag allowLoanPayment).
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage, { norm, rupiah } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describe('Nasabah - Pinjaman - Form Angsuran', () => {
  let fx;
  let loan;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({ fixtureRefId: fx.data.refIdBulanan, dataPath: fx.paths.data, length: fx.data.scanLength, label: 'apa pun' })
        .then((l) => {
          loan = l;
        });
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openInstallment = (refId) => {
    LoanDetailPage.openDetail(fx.paths.detail, refId, 'installment');
    cy.get('body').then(($b) => {
      expect($b.find(fx.payment.tabInstallment).length, fx.payment.rolePrecondition).to.be.greaterThan(0);
    });
    cy.get(fx.payment.tabInstallment).should('have.class', 'active');
  };

  describe('Pinjaman aktif', () => {
    beforeEach(() => openInstallment(loan.refId));

    it('TC-LOAN-BAYAR-001 | Happy | Tab Angsuran menampilkan form angsuran pinjaman lengkap', () => {
      LoanDetailPage.navLabels().should('include', fx.detail.tabs.angsuran);
      cy.contains(`${fx.payment.tabInstallment} ul.nav-tabs a`, fx.payment.subtabAngsuran).should('be.visible');
      cy.contains(`${fx.payment.tabInstallment} ul.nav-tabs a`, fx.payment.subtabPelunasan).should('be.visible');
      cy.get(fx.payment.principal).should('have.attr', 'required');
      cy.get(fx.payment.interest).should('have.attr', 'required');
      cy.get(fx.payment.total).should('have.attr', 'readonly');
      cy.get(fx.payment.debitSaving).should('have.attr', 'type', 'checkbox');
      cy.get(`${fx.payment.form} ${fx.payment.notes}`).should('exist');
    });

    it('TC-LOAN-BAYAR-002 | Positif | Jumlah dihitung otomatis dari angsuran pokok + bunga', () => {
      cy.get(fx.payment.principal).clear().type(fx.payment.contohPokok);
      cy.get(fx.payment.interest).clear().type(fx.payment.contohBunga);
      cy.get(fx.payment.saving).invoke('val').then((s) => {
        const exp = Number(fx.payment.contohPokok) + Number(fx.payment.contohBunga) + rupiah(s);
        cy.get(fx.payment.total).should(($t) => {
          expect(rupiah($t.val()), `Jumlah = ${exp}`).to.eq(exp);
        });
      });
    });

    it('TC-LOAN-BAYAR-003 | Negatif | Proses dengan field wajib kosong menampilkan error dan tidak membuka konfirmasi PIN', () => {
      cy.get(fx.payment.principal).clear();
      cy.get(fx.payment.interest).clear();
      cy.contains(`${fx.payment.form} button`, fx.payment.btnProses).click();
      cy.get(`${fx.payment.form} .has-error, ${fx.payment.form} label.error, ${fx.payment.form} .help-block-error`).should('exist');
      cy.get(fx.payment.modalPin).should('not.be.visible');
      cy.blockedWrites().should('have.length', 0);
    });

    it('TC-LOAN-BAYAR-004 | Positif | Proses dengan data lengkap meminta PIN; Batal tidak memproses transaksi', () => {
      cy.get(fx.payment.principal).clear().type(fx.payment.contohPokok);
      cy.get(fx.payment.interest).clear().type(fx.payment.contohBunga);
      cy.contains(`${fx.payment.form} button`, fx.payment.btnProses).click();
      cy.get(fx.payment.modalPin).should('be.visible').within(() => {
        cy.get('.modal-title').should('have.text', fx.payment.modalTitle);
        cy.get(fx.payment.pinInput).should('have.attr', 'required');
        cy.contains('button', 'Batal').click();
      });
      cy.get(fx.payment.modalPin).should('not.be.visible');
      cy.blockedWrites().should('have.length', 0);
    });
  });

  describe('Pinjaman daftar hitam (DH)', () => {
    it('TC-LOAN-BAYAR-005 | Happy | Pinjaman DH menampilkan form Angsuran DH dan Pelunasan DH', () => {
      LoginPage.loginViaSession();
      cy.request({ url: fx.paths.dataBlacklistActive, qs: { draw: 1, start: 0, length: 10 }, timeout: fx.timeout.request }).then((res) => {
        const row = (res.body.data || [])[0];
        expect(row, 'precondition: ada pinjaman daftar hitam aktif').to.exist;
        openInstallment(row.ref_id);
        cy.contains(`${fx.payment.tabInstallment} ul.nav-tabs a`, fx.payment.subtabAngsuranDh).should('be.visible');
        cy.contains(`${fx.payment.tabInstallment} ul.nav-tabs a`, fx.payment.subtabPelunasanDh).should('be.visible');
        cy.get(`${fx.payment.formDh} [name="principal"]`).should('have.attr', 'required');
        cy.get(`${fx.payment.formDh} [name="interest"]`).should('have.attr', 'required');
        cy.get(`${fx.payment.formDh}`).invoke('text').then((t) => expect(norm(t)).to.include('Jumlah'));
      });
    });
  });
});
