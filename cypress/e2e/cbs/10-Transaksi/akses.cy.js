// Transaksi — hak akses menu & URL (read-only).
// TC sumber: docs/test-cases/src/TC_Transaksi_Akses.json
//
// Sumber perilaku:
//   - Menu "Transaksi" hanya dirender untuk role 'teller' (navigation.blade.php:516).
//   - TransactionController::__construct -> checkRole(['teller','super-admin']);
//     gagal -> 302 /home + flash "Akses anda terbatas!" (Helpers::errorRedirect).
import LoginPage from '../../../support/pageobjects/LoginPage';
import KasPage from '../../../support/pageobjects/Transaksi/KasPage';

describe('Transaksi - Hak Akses Menu & URL', () => {
  let fx;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
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

  describe('Menu sidebar (akun teller)', () => {
    it('TC-TRX-AKSES-001 | Happy | Menu Transaksi tampil dengan 4 sub-menu untuk akun teller', () => {
      KasPage.open(fx.home);
      KasPage.assertSidebarMenuVisible(fx.menu.title, fx.roleHintMenu);
      KasPage.sidebar
        .menuTitle(fx.menu.title)
        .closest('li')
        .find('ul.sub-menu a.nav-link')
        .should(($a) => {
          const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
          const hrefs = Cypress.$.makeArray($a).map((a) => new URL(a.href).pathname);
          expect(labels).to.deep.eq(fx.menu.sub.map((s) => s.label));
          expect(hrefs).to.deep.eq(fx.menu.sub.map((s) => s.path));
        });
    });

    it('TC-TRX-AKSES-002 | Positif | Klik sub-menu Kas dari sidebar membuka halaman Kas', () => {
      KasPage.open(fx.home);
      KasPage.assertSidebarMenuVisible(fx.menu.title, fx.roleHintMenu);
      KasPage.sidebar.menuTitle(fx.menu.title).click();
      KasPage.sidebar.subLink(fx.kas.path).should('be.visible').click();
      KasPage.assertUrl(fx.kas.path).assertNotRedirectedToLogin().assertBreadcrumb(fx.kas.breadcrumb);
    });
  });

  describe('Akses URL langsung (akun teller / super-admin)', () => {
    it('TC-TRX-AKSES-003 | Positif | URL /transaction/cash dapat dibuka tanpa dialihkan', () => {
      KasPage.openGuarded(fx.kas.path, fx.roleHint);
      KasPage.assertBreadcrumb(fx.kas.breadcrumb).assertDocumentTitle(fx.kas.title);
    });

    it('TC-TRX-AKSES-004 | Positif | URL /transaction/general_ledger dapat dibuka tanpa dialihkan', () => {
      KasPage.openGuarded(fx.gl.path, fx.roleHint);
      KasPage.assertBreadcrumb(fx.gl.breadcrumb).assertDocumentTitle(fx.gl.title);
    });

    it('TC-TRX-AKSES-005 | Positif | URL /transaction/history dapat dibuka tanpa dialihkan', () => {
      KasPage.openGuarded(fx.riwayatKasir.path, fx.roleHint);
      KasPage.assertBreadcrumb(fx.riwayatKasir.breadcrumb).assertDocumentTitle(fx.riwayatKasir.title);
    });

    it('TC-TRX-AKSES-006 | Positif | URL /transaction/mass-history dapat dibuka tanpa dialihkan', () => {
      KasPage.openGuarded(fx.riwayatMassal.path, fx.roleHint);
      KasPage.assertBreadcrumb(fx.riwayatMassal.breadcrumb).assertDocumentTitle(fx.riwayatMassal.title);
    });
  });

  describe('Akses ditolak (akun tanpa role teller/super-admin)', () => {
    it('TC-TRX-AKSES-007 | Negatif | Buka /transaction/cash tanpa role dialihkan ke /home dengan pesan akses terbatas', () => {
      KasPage.assertDirectUrlDenied(fx.kas.path, {
        home: fx.home,
        message: fx.deniedMessage,
        roleHint: fx.roleHintDenied,
      });
    });

    it('TC-TRX-AKSES-008 | Negatif | Buka /transaction/general_ledger tanpa role dialihkan ke /home dengan pesan akses terbatas', () => {
      KasPage.assertDirectUrlDenied(fx.gl.path, {
        home: fx.home,
        message: fx.deniedMessage,
        roleHint: fx.roleHintDenied,
      });
    });
  });
});
