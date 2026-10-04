// Transaksi > Riwayat Kasir (/transaction/history) — read-only.
// TC sumber: docs/test-cases/src/TC_Transaksi_RiwayatKasir.json
// Tabel memanggil GET /transaction/general_ledger/history_gl/data?date=&date2=&type=.
import LoginPage from '../../../support/pageobjects/LoginPage';
import RiwayatKasirPage from '../../../support/pageobjects/Transaksi/RiwayatKasirPage';

describe('Transaksi - Riwayat Kasir (/transaction/history)', () => {
  let fx;
  let r;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      r = d.riwayatKasir;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', r.dataUrl).as('kasirData');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openPage = () => {
    RiwayatKasirPage.openGuarded(r.path, fx.roleHint);
    cy.wait('@kasirData').its('response.statusCode').should('eq', 200);
    RiwayatKasirPage.waitTable('#data-table', fx.timeouts.table);
  };

  it('TC-TRX-RKASIR-001 | Happy | Halaman Riwayat Kasir tampil dengan catatan pembatalan dan kolom tabel lengkap', () => {
    openPage();
    RiwayatKasirPage.assertBreadcrumb(r.breadcrumb);
    cy.get('.page-content').should('contain.text', r.note);
    RiwayatKasirPage.assertHeaders(r.headers, '#data-table');
  });

  it('TC-TRX-RKASIR-002 | Positif | Filter jenis transaksi memuat semua opsi jenis transaksi kasir', () => {
    openPage();
    RiwayatKasirPage.optionTexts('#filter_type').should('deep.eq', r.filterOptions);
    RiwayatKasirPage.elements.filterType().should('have.value', 'ALL');
  });

  it('TC-TRX-RKASIR-003 | Positif | Filter rentang tanggal mengirim tanggal ke server dan baris berada dalam rentang', () => {
    openPage();
    RiwayatKasirPage.setRange(r.range.from, r.range.to);
    cy.wait('@kasirData').then(({ request, response }) => {
      expect(request.url).to.include(`date=${r.range.from}`).and.include(`date2=${r.range.to}`);
      expect(response.statusCode).to.eq(200);
    });
    RiwayatKasirPage.waitTable('#data-table', fx.timeouts.table);
    RiwayatKasirPage.assertEveryRowColumn(
      0,
      (t) => t.slice(0, 10) >= r.range.from && t.slice(0, 10) <= r.range.to,
      'Tanggal Transaksi dalam rentang',
    );
  });

  it('TC-TRX-RKASIR-004 | Positif | Filter jenis "Jurnal" mengirim type=JOURNAL ke server', () => {
    openPage();
    RiwayatKasirPage.elements.filterType().select('JOURNAL');
    cy.wait('@kasirData').then(({ request, response }) => {
      expect(request.url).to.include('type=JOURNAL');
      expect(response.statusCode).to.eq(200);
    });
    RiwayatKasirPage.waitTable('#data-table', fx.timeouts.table);
  });

  it('TC-TRX-RKASIR-005 | Positif | Tombol export CSV dan Excel tersedia', () => {
    openPage();
    RiwayatKasirPage.elements.exportWrap().within(() => {
      cy.get('.buttons-csv').should('exist');
      cy.get('.buttons-excel').should('exist');
    });
  });

  it('TC-TRX-RKASIR-006 | Edge | Pencarian tanpa kecocokan menampilkan empty-state', () => {
    openPage();
    RiwayatKasirPage.tableSearch('#data-table').type(fx.gl.searchNoMatch);
    cy.wait('@kasirData');
    RiwayatKasirPage.waitTable('#data-table', fx.timeouts.table);
    RiwayatKasirPage.emptyState('#data-table').should('be.visible');
  });

  it('TC-TRX-RKASIR-007 | Positif | Tombol Void membuka modal PIN Supervisor (tidak disubmit) atau tidak ada transaksi hari ini', () => {
    openPage();
    cy.get('#data-table tbody').then(($tb) => {
      const voids = $tb.find('a#void');
      if (!voids.length) {
        // Kemungkinan 2 (eksplisit): tidak ada transaksi hari ini yang bisa di-void.
        cy.log('Tidak ada transaksi yang bisa di-void hari ini');
        cy.get('#data-table tbody a#void').should('not.exist');
        return;
      }
      cy.wrap(voids.first()).click();
      RiwayatKasirPage.elements.voidModal().should('be.visible').and('contain.text', r.voidModalTitle);
      cy.get('#in_pinspv button[data-dismiss="modal"]').first().click({ force: true });
      RiwayatKasirPage.elements.voidModal().should('not.be.visible');
    });
  });
});
