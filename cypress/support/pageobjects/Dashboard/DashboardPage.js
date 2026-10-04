// DashboardPage — halaman /home CBS (HomeController@index,
// resources/views/dashboard/index.blade.php).
//
// Struktur (develop):
//   - Sync bar: button#btnSync "Sinkronkan Data" + span#syncInfo
//   - Ringkasan: .db-grid > .db-tile (.tile-label / .tile-value)
//   - Rasio Keuangan (lazy, GET /dashboard/camel-data): skeleton #skel<Key>,
//     kartu #card<Key> (display:none sampai data datang), nilai #val<Key>,
//     badge #badge<Key>, ikon info a.ratio-info (popover Bootstrap 3, trigger focus).
//     Key = Car | Roa | Bopo | Ldr.
//   - Aksi Cepat: .qa-grid > a.qa-tile
//   - Statistik: #periodBar .period-btn[data-period] (GET /dashboard/chart-data?period=)
//   - 10 Transaksi Terbaru: table#trxTable > tbody#trxBody (GET /dashboard/recent-transactions)
//
// ⚠️ Urutan open: login (cy.session) DULU, baru guardWrites — kalau guard
// dipasang sebelum cy.session, POST /login ikut diblok.

import BasePage from '../BasePage';
import LoginPage from '../LoginPage';

class DashboardPage extends BasePage {
  path = '/home';

  elements = {
    heading: () => cy.get('.page-head .page-title h1'),
    syncBtn: () => cy.get('#btnSync'),
    syncInfo: () => cy.get('#syncInfo'),
    tileByLabel: (label) => cy.contains('.db-grid .db-tile .tile-label', label).closest('.db-tile'),
    tileValueByLabel: (label) =>
      cy.contains('.db-grid .db-tile .tile-label', label).closest('.db-tile').find('.tile-value'),
    quickAction: (title) => cy.contains('.qa-grid a.qa-tile strong', title).closest('a.qa-tile'),
    periodBtn: (period) => cy.get(`#periodBar .period-btn[data-period="${period}"]`),
    trxTable: () => cy.get('#trxTable'),
    trxHeaders: () => cy.get('#trxTable thead th'),
    trxRows: () => cy.get('#trxBody tr'),
    ratioCard: (key) => cy.get(`#card${key}`),
    ratioValue: (key) => cy.get(`#val${key}`),
    ratioBadge: (key) => cy.get(`#badge${key}`),
    ratioSkeleton: (key) => cy.get(`#skel${key}`),
    ratioInfo: (key) => cy.get(`#card${key} a.ratio-info`),
    visiblePopover: () => cy.get('.popover:visible'),
    pageContent: () => cy.get('.page-content'),
  };

  interceptApis(urls) {
    cy.intercept('GET', urls.camelData).as('camelData');
    cy.intercept('GET', urls.chartData).as('chartData');
    cy.intercept('GET', urls.recentTrx).as('recentTrx');
    return this;
  }

  /** Login → guard tulis → intercept XHR dashboard → visit /home. */
  openGuarded(urls, { allow = [] } = {}) {
    LoginPage.loginViaSession();
    cy.guardWrites({ allow });
    this.interceptApis(urls);
    cy.visit(urls.home || this.path);
    return this;
  }

  /** Tunggu respon camel-data dan kembalikan body-nya (yield). */
  waitCamel(timeout = 30000) {
    return cy.wait('@camelData', { timeout }).then((itc) => {
      expect(itc.response, 'response /dashboard/camel-data').to.exist;
      expect(itc.response.statusCode, 'status camel-data').to.eq(200);
      const body = typeof itc.response.body === 'string' ? JSON.parse(itc.response.body) : itc.response.body;
      return cy.then(() => body);
    });
  }

  /** Teks yang tampil (innerText, whitespace dirapikan) dari satu kartu rasio. */
  cardText(key) {
    return this.elements.ratioCard(key).then(($c) => $c[0].innerText.replace(/\s+/g, ' ').trim());
  }

  /** Assert kartu rasio tampil (tidak tertahan skeleton / pesan "Klik Sinkronkan Data"). */
  assertRatioCardVisible(key, timeout = 30000) {
    cy.get(`#card${key}`, { timeout }).should('be.visible');
    this.elements.ratioSkeleton(key).should('not.be.visible');
    return this;
  }

  /** Buka popover info rasio (trigger=focus) lalu tutup dengan blur. */
  openRatioInfo(key) {
    this.elements.ratioInfo(key).focus();
    return this;
  }

  closeRatioInfo(key) {
    this.elements.ratioInfo(key).blur();
    return this;
  }
}

export default new DashboardPage();
