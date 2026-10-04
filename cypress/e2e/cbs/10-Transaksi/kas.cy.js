// Transaksi > Kas (/transaction/cash) — tampilan, hitung pecahan, validasi client-side.
// TC sumber: docs/test-cases/src/TC_Transaksi_Kas.json
// Read-only: write-guard aktif; modal PIN TIDAK pernah disubmit.
import LoginPage from '../../../support/pageobjects/LoginPage';
import KasPage from '../../../support/pageobjects/Transaksi/KasPage';

describe('Transaksi - Kas (/transaction/cash)', () => {
  let fx;
  let k;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      k = d.kas;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tampilan halaman', () => {
    it('TC-TRX-KAS-001 | Happy | Halaman Kas tampil dengan breadcrumb dan 7 tab transaksi kas', () => {
      KasPage.openGuarded(k.path, fx.roleHint);
      KasPage.assertBreadcrumb(k.breadcrumb);
      cy.get('ul.nav-pills > li > a').should(($a) => {
        const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
        expect(labels).to.deep.eq(k.tabs.map((t) => t.label));
      });
    });

    it('TC-TRX-KAS-002 | Positif | Tanpa parameter menu, tab Bon Kas Teller aktif secara default', () => {
      KasPage.openGuarded(k.path, fx.roleHint);
      KasPage.elements.tabPane('#in').should('have.class', 'active');
      KasPage.elements.inForm().should('be.visible');
      k.denominations.forEach((d) => KasPage.elements.inCount(d).should('exist'));
      KasPage.elements.inTotal().should('have.attr', 'readonly');
    });

    it('TC-TRX-KAS-003 | Positif | Parameter ?menu=history membuka tab Riwayat dengan kolom tabel lengkap', () => {
      cy.intercept('GET', k.historyDataUrl).as('cashData');
      KasPage.openGuarded(`${k.path}?menu=history`, fx.roleHint);
      KasPage.elements.tabPane('#history').should('have.class', 'active');
      cy.wait('@cashData').its('response.statusCode').should('eq', 200);
      KasPage.waitTable('#data-table', fx.timeouts.table).assertHeaders(k.historyHeaders, '#data-table');
    });
  });

  describe('Bon Kas Teller', () => {
    it('TC-TRX-KAS-004 | Positif | Subtotal per pecahan dan total Bon Kas terhitung otomatis', () => {
      KasPage.openGuarded(k.path, fx.roleHint);
      KasPage.fillInCounts(k.sampleCount);
      Object.entries(k.sampleCount).forEach(([denom, n]) => {
        KasPage.elements.inSubtotal(denom).should('have.value', String(n * k.denomValues[denom]));
      });
      KasPage.elements.inTotal().should('have.value', String(k.sampleTotal));
    });

    it('TC-TRX-KAS-005 | Negatif | Proses Bon Kas dengan total 0 menampilkan alert dan modal PIN tidak terbuka', () => {
      const alertStub = cy.stub().as('alert');
      cy.on('window:alert', alertStub);
      KasPage.openGuarded(k.path, fx.roleHint);
      KasPage.elements.inProcess().click();
      cy.get('@alert').should('have.been.calledWith', k.alertBonKosong);
      KasPage.elements.inPinModal().should('not.be.visible');
    });

    it('TC-TRX-KAS-006 | Positif | Proses Bon Kas dengan total > 0 membuka modal PIN Supervisor berisi total, Batal menutup modal', () => {
      KasPage.openGuarded(k.path, fx.roleHint);
      KasPage.fillInCounts(k.sampleCount);
      KasPage.elements.inProcess().click();
      KasPage.elements.inPinModal().should('be.visible').and('contain.text', k.pinModalTitle);
      KasPage.elements.inModalTotal().invoke('text').then((t) => {
        expect(Number(t.replace(/[^0-9]/g, '')), 'total di modal').to.eq(k.sampleTotal);
      });
      KasPage.elements.inModalSpv().should('exist');
      KasPage.elements.inModalPin().should('have.attr', 'required');
      KasPage.elements.inModalCancel().click();
      KasPage.elements.inPinModal().should('not.be.visible');
    });
  });

  describe('Setor Kas Teller', () => {
    it('TC-TRX-KAS-007 | Positif | Selisih Setor Kas = saldo kas sistem dikurangi total setor', () => {
      KasPage.openGuarded(`${k.path}?menu=cash_out`, fx.roleHint);
      KasPage.elements.tabPane('#out').should('have.class', 'active');
      KasPage.fillOutCounts(k.sampleCount);
      KasPage.elements.outTotal().should('have.value', String(k.sampleTotal));
      KasPage.elements.outCashSystem().invoke('val').then((balance) => {
        KasPage.elements.outDifferent().should(($d) => {
          expect(Number($d.val()), 'selisih').to.eq(Number(balance) - k.sampleTotal);
        });
      });
    });

    it('TC-TRX-KAS-008 | Negatif | Proses Setor Kas dengan total 0 menampilkan alert dan modal PIN tidak terbuka', () => {
      const alertStub = cy.stub().as('alert');
      cy.on('window:alert', alertStub);
      KasPage.openGuarded(`${k.path}?menu=cash_out`, fx.roleHint);
      KasPage.elements.outProcess().click();
      cy.get('@alert').should('have.been.calledWith', k.alertSetorKosong);
      KasPage.elements.outPinModal().should('not.be.visible');
    });
  });
});
