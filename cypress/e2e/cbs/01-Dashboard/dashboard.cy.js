/// <reference types="cypress" />
// Dashboard (/home) — ringkasan, aksi cepat, statistik, transaksi terbaru.
// Read-only: semua request tulis diblok (cy.guardWrites) dan diverifikasi
// tidak ada yang bocor. Tombol "Sinkronkan Data" (POST /dashboard/sync) TIDAK diklik.
// TC sheet: docs/test-cases/src/TC_Dashboard_Ringkasan.json
import DashboardPage from '../../../support/pageobjects/Dashboard/DashboardPage';

const sidebarTitles = () =>
  cy.get('ul.page-sidebar-menu span.title').then(($t) =>
    Cypress.$.makeArray($t).map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
  );

describe('Dashboard - Ringkasan', () => {
  let fx;

  before(() => {
    cy.fixture('dashboard/dashboard').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    DashboardPage.openGuarded(fx.urls);
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tampilan halaman', () => {
    it('TC-DSB-VIEW-001 | Happy | Dashboard terbuka setelah login dengan judul & breadcrumb Dashboard', () => {
      DashboardPage.assertUrl(fx.urls.home).assertNotRedirectedToLogin();
      DashboardPage.elements.heading().should('have.text', fx.labels.heading);
      DashboardPage.assertBreadcrumb(fx.labels.breadcrumb).assertDocumentTitle(fx.labels.documentTitle);
    });

    it('TC-DSB-VIEW-002 | Positif | Kartu Ringkasan tampil dengan format nilai yang benar', () => {
      sidebarTitles().then((titles) => {
        expect(titles, 'precondition: akun test BUKAN teller (menu Transaksi tidak boleh ada)').not.to.include('Transaksi');
      });
      const t = fx.labels.tiles;
      DashboardPage.elements.tileValueByLabel(t.realisasi).invoke('text').then((v) => {
        expect(v.trim(), `${t.realisasi}`).to.match(new RegExp(fx.patterns.currency));
      });
      DashboardPage.elements.tileValueByLabel(t.kasTeller).invoke('text').then((v) => {
        expect(v.trim(), `${t.kasTeller}`).to.match(new RegExp(fx.patterns.currency));
      });
      DashboardPage.elements.tileValueByLabel(t.npl).invoke('text').then((v) => {
        expect(v.trim(), 'NPL').to.match(new RegExp(fx.patterns.npl));
      });
      DashboardPage.elements.tileValueByLabel(t.totalCif).invoke('text').then((v) => {
        expect(v.trim(), `${t.totalCif}`).to.match(new RegExp(fx.patterns.count));
      });
      cy.contains('.db-grid .tile-label', t.saldoTellerAnda).should('not.exist');
    });

    it('TC-DSB-VIEW-003 | Positif | Aksi Cepat menautkan ke halaman CIF yang benar', () => {
      fx.labels.quickActions.forEach((qa) => {
        DashboardPage.elements.quickAction(qa.title).should('be.visible').and(($a) => {
          expect(new URL($a.prop('href')).pathname, `href ${qa.title}`).to.eq(qa.href);
        });
        DashboardPage.elements.quickAction(qa.title).find('.qa-text span').invoke('text').then((s) => {
          expect(s.trim(), `helper ${qa.title}`).to.match(new RegExp(`^\\d{1,3}(\\.\\d{3})* ${qa.helperPattern}`));
        });
      });
    });

    it('TC-DSB-VIEW-004 | Positif | Total Nasabah (CIF) konsisten dengan jumlah di Aksi Cepat "Buat CIF Baru"', () => {
      DashboardPage.elements.tileValueByLabel(fx.labels.tiles.totalCif).invoke('text').then((tile) => {
        DashboardPage.elements.quickAction(fx.labels.quickActions[0].title).find('.qa-text span').invoke('text').then((qa) => {
          expect(qa.trim().split(' ')[0], 'jumlah CIF di Aksi Cepat = tile Total Nasabah').to.eq(tile.trim());
        });
      });
    });

    it('TC-DSB-VIEW-005 | Positif | Tombol Sinkronkan Data & info waktu sinkron tampil', () => {
      DashboardPage.elements.syncBtn().should('be.visible').and('contain.text', fx.labels.syncButton).and('be.enabled');
      DashboardPage.elements.syncInfo().invoke('text').then((s) => {
        expect(s.replace(/\s+/g, ' ').trim()).to.match(new RegExp(fx.labels.syncInfoPattern));
      });
    });

    it('TC-DSB-VIEW-006 | Positif | Tautan "Lihat detail" Saldo Kas Teller mengarah ke pengaturan saldo teller (super-admin)', () => {
      sidebarTitles().then((titles) => {
        expect(titles, 'precondition: akun test super-admin (menu Kantor tampil) — butuh akun super-admin').to.include('Kantor');
      });
      DashboardPage.elements.tileByLabel(fx.labels.tiles.kasTeller)
        .contains('a', fx.labels.lihatDetail)
        .should('have.attr', 'href', fx.urls.tellerDetail);
    });
  });

  describe('Statistik & transaksi terbaru', () => {
    it('TC-DSB-VIEW-007 | Positif | Ganti periode grafik ke Mingguan memuat data periode weekly', () => {
      cy.wait('@chartData', { timeout: fx.timeouts.ajax })
        .its('request.url').should('include', 'period=monthly');
      DashboardPage.elements.periodBtn('monthly').should('have.class', 'active');

      DashboardPage.elements.periodBtn('weekly').should('have.text', fx.labels.periods.weekly).click();
      cy.wait('@chartData', { timeout: fx.timeouts.ajax }).then((itc) => {
        expect(itc.request.url).to.include('period=weekly');
        expect(itc.response.statusCode).to.eq(200);
      });
      DashboardPage.elements.periodBtn('weekly').should('have.class', 'active');
      DashboardPage.elements.periodBtn('monthly').should('not.have.class', 'active');
    });

    it('TC-DSB-VIEW-008 | Positif | Tabel 10 Transaksi Terbaru tampil sesuai respon server (maks 10 baris / empty state)', () => {
      cy.wait('@recentTrx', { timeout: fx.timeouts.ajax }).then((itc) => {
        expect(itc.response.statusCode).to.eq(200);
        const rows = itc.response.body;
        expect(rows, 'respon berupa array').to.be.an('array');
        expect(rows.length, 'maksimal 10 transaksi').to.be.at.most(fx.labels.trxMaxRows);

        DashboardPage.elements.trxTable().should('be.visible');
        DashboardPage.elements.trxHeaders().should(($th) => {
          const actual = Cypress.$.makeArray($th).map((th) => th.innerText.trim());
          expect(actual).to.deep.eq(fx.labels.trxHeaders);
        });
        if (rows.length === 0) {
          DashboardPage.elements.trxRows().should('have.length', 1).and('contain.text', fx.labels.trxEmpty);
        } else {
          DashboardPage.elements.trxRows().should('have.length', rows.length);
          DashboardPage.elements.trxRows().first().find('td').eq(1).should('have.text', rows[0].ref_id);
        }
      });
    });
  });

  describe('Navigasi', () => {
    it('TC-DSB-VIEW-009 | Positif | Menu sidebar Dashboard membuka /home dari halaman lain', () => {
      cy.visit(fx.urls.profile);
      cy.get('ul.page-sidebar-menu a[href$="/home"]').first().click();
      DashboardPage.assertUrl(fx.urls.home);
      DashboardPage.elements.heading().should('have.text', fx.labels.heading);
    });
  });
});
