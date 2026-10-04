// Transaksi > Riwayat Massal (/transaction/mass-history) — read-only.
// TC sumber: docs/test-cases/src/TC_Transaksi_RiwayatMassal.json
// PRD: "Transaksi Overbooking Masal" (m: transaksi tercatat di riwayat).
import LoginPage from '../../../support/pageobjects/LoginPage';
import RiwayatMassalPage from '../../../support/pageobjects/Transaksi/RiwayatMassalPage';

describe('Transaksi - Riwayat Massal (/transaction/mass-history)', () => {
  let fx;
  let r;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      r = d.riwayatMassal;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', r.dataUrl).as('massalData');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  /** Buka halaman, tunggu ajax pertama; kembalikan interception lewat alias @firstLoad. */
  const openPage = () => {
    RiwayatMassalPage.openGuarded(r.path, fx.roleHint);
    cy.wait('@massalData').as('firstLoad').its('response.statusCode').should('eq', 200);
    RiwayatMassalPage.waitTable('#data-table', fx.timeouts.table);
  };

  it('TC-TRX-RMASSAL-001 | Happy | Halaman Riwayat Massal tampil dengan keterangan dan kolom tabel lengkap', () => {
    openPage();
    RiwayatMassalPage.assertBreadcrumb(r.breadcrumb);
    cy.get('.page-content').should('contain.text', r.note);
    RiwayatMassalPage.assertHeaders(r.headers, '#data-table');
  });

  it('TC-TRX-RMASSAL-002 | Positif | Default rentang tanggal dikirim ke server sebagai date_from/date_to', () => {
    openPage();
    cy.get('@firstLoad').then(({ request }) => {
      const u = new URL(request.url);
      RiwayatMassalPage.elements.date1().should('have.value', u.searchParams.get('date_from'));
      RiwayatMassalPage.elements.date2().should('have.value', u.searchParams.get('date_to'));
    });
  });

  it('TC-TRX-RMASSAL-003 | Positif | Filter rentang tanggal memuat ulang tabel dan baris berada dalam rentang', () => {
    openPage();
    RiwayatMassalPage.setRange(r.range.from, r.range.to);
    cy.wait('@massalData').then(({ request, response }) => {
      const u = new URL(request.url);
      expect(u.searchParams.get('date_from')).to.eq(r.range.from);
      expect(u.searchParams.get('date_to')).to.eq(r.range.to);
      expect(response.statusCode).to.eq(200);
    });
    RiwayatMassalPage.waitTable('#data-table', fx.timeouts.table);
    RiwayatMassalPage.assertEveryRowColumn(
      1,
      (t) => t.slice(0, 10) >= r.range.from && t.slice(0, 10) <= r.range.to,
      'Tanggal Transaksi dalam rentang',
    );
  });

  it('TC-TRX-RMASSAL-004 | Positif | Tombol export CSV dan Excel tersedia', () => {
    openPage();
    RiwayatMassalPage.elements.exportWrap().within(() => {
      cy.get('.buttons-csv').should('exist');
      cy.get('.buttons-excel').should('exist');
    });
  });

  it('TC-TRX-RMASSAL-005 | Positif | Tombol Void membuka modal Supervisor & PIN wajib (tidak disubmit) atau tidak ada data', () => {
    openPage();
    cy.get('#data-table tbody').then(($tb) => {
      const btn = $tb.find('.btn-void');
      if (!btn.length) {
        cy.log('Tidak ada transaksi massal SUCCESS di rentang default — tombol Void tidak ada');
        cy.get('#data-table tbody .btn-void').should('not.exist');
        return;
      }
      cy.wrap(btn.first()).click();
      RiwayatMassalPage.elements.voidModal().should('be.visible');
      cy.get('#modalVoid #spv_user').should('have.attr', 'required');
      cy.get('#modalVoid #pin_spv').should('have.attr', 'required').and('have.attr', 'type', 'password');
      cy.get('#modalVoid [data-dismiss="modal"]').first().click({ force: true });
      RiwayatMassalPage.elements.voidModal().should('not.be.visible');
    });
  });
});
