/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LaporanMenuPage from '../../../support/pageobjects/Laporan/LaporanMenuPage';

// Menu "Laporan" (sidebar) + halaman indeks kartu laporan Umum / Pinjaman / Simpanan.
// Sumber: layouts/navigation.blade.php, report/{general,loan,saving}/index.blade.php.
// PRD terkait: Neraca & Laba Rugi (Laporan > Umum), Cashflow (Laporan > Simpanan),
// Laporan Penyesuaian Pinjaman (menu BARU di kelompok Laporan).
// READ-ONLY: write-guard aktif tanpa allow.

describe('Laporan - Menu & halaman indeks', () => {
  let fx;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    LoginPage.clearSession();
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Sidebar', () => {
    it('TC-LAP-MENU-001 | Happy | menu Laporan berisi submenu Umum, Pinjaman, Simpanan, Laporan AI', () => {
      LaporanMenuPage.open('/home');
      LaporanMenuPage.subMenuTexts(fx.menu.parent).then((items) => {
        fx.menu.children.forEach((c) => {
          const hit = items.find((i) => i.text === c.label);
          expect(hit, `submenu "${c.label}"`).to.exist;
          expect(hit.href, `href submenu "${c.label}"`).to.eq(c.href);
        });
      });
      LaporanMenuPage.expandLaporan(fx.menu.parent);
      LaporanMenuPage.elements.subMenuLinks(fx.menu.parent).filter(':visible').should('have.length.at.least', fx.menu.children.length);
    });

    it('TC-LAP-MENU-002 | Negatif | menu "Laporan Penyesuaian Pinjaman" tersedia di kelompok Laporan', () => {
      LaporanMenuPage.open('/home');
      LaporanMenuPage.subMenuTexts(fx.menu.parent).then((items) => {
        const hit = items.find((i) => i.text.toLowerCase().includes(fx.menu.penyesuaianLabel.toLowerCase()));
        expect(hit, `submenu "${fx.menu.penyesuaianLabel}" di kelompok Laporan`).to.exist;
      });
    });
  });

  describe('Halaman indeks laporan', () => {
    it('TC-LAP-MENU-003 | Positif | Laporan Umum menampilkan kartu laporan (termasuk Neraca & Lap Laba/Rugi) dengan tautan benar', () => {
      const page = fx.indexPages.general;
      LaporanMenuPage.visitIndex(page);
      LaporanMenuPage.assertNotRedirectedToLogin().assertBreadcrumb(page.breadcrumb);
      LaporanMenuPage.elements.heading().should('contain.text', page.heading);
      page.cards.forEach((c) => LaporanMenuPage.assertCard(c));
    });

    it('TC-LAP-MENU-004 | Positif | Laporan Pinjaman menampilkan kartu laporan pinjaman dengan tautan benar', () => {
      const page = fx.indexPages.loan;
      LaporanMenuPage.visitIndex(page);
      LaporanMenuPage.assertNotRedirectedToLogin().assertBreadcrumb(page.breadcrumb);
      LaporanMenuPage.elements.heading().should('contain.text', page.heading);
      page.cards.forEach((c) => LaporanMenuPage.assertCard(c));
    });

    it('TC-LAP-MENU-005 | Positif | Laporan Simpanan menampilkan kartu laporan simpanan (termasuk Lap Cashflow) dengan tautan benar', () => {
      const page = fx.indexPages.saving;
      LaporanMenuPage.visitIndex(page);
      LaporanMenuPage.assertNotRedirectedToLogin().assertBreadcrumb(page.breadcrumb);
      LaporanMenuPage.elements.heading().should('contain.text', page.heading);
      page.cards.forEach((c) => LaporanMenuPage.assertCard(c));
    });

    it('TC-LAP-MENU-006 | Edge | semua tautan "Lihat Detail" di halaman indeks Laporan dapat dibuka (HTTP 200, tidak ke /login)', () => {
      LaporanMenuPage.open('/home');
      const cards = [
        ...fx.indexPages.general.cards,
        ...fx.indexPages.loan.cards,
        ...fx.indexPages.saving.cards,
      ];
      const results = [];
      cards.forEach((c) => {
        cy.request({ url: c.href, failOnStatusCode: false, followRedirect: true }).then((res) => {
          const finalPath = res.redirects && res.redirects.length ? res.redirects[res.redirects.length - 1] : c.href;
          results.push({ href: c.href, status: res.status, toLogin: String(finalPath).includes(fx.loginPath) });
        });
      });
      cy.then(() => {
        const broken = results.filter((r) => r.status !== 200 || r.toLogin);
        expect(broken, `tautan laporan rusak: ${JSON.stringify(broken)}`).to.deep.eq([]);
      });
    });
  });
});
