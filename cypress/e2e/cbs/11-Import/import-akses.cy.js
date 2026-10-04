// Import — hak akses menu & URL (read-only).
// TC sumber: docs/test-cases/src/TC_Import_Akses.json
//
// Sumber perilaku:
//   - Menu "Import" dirender hanya untuk role 'teller' (navigation.blade.php:544).
//   - ImportController::__construct -> checkRole(['supervisor','customer-service']);
//     gagal -> 302 /home + flash "Akses anda terbatas!".
import LoginPage from '../../../support/pageobjects/LoginPage';
import ImportPage from '../../../support/pageobjects/Import/ImportPage';

describe('Import - Hak Akses Menu & URL', () => {
  let fx;

  before(() => {
    cy.fixture('import/import').then((d) => {
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

  it('TC-IMP-AKSES-001 | Happy | Menu Import tampil dengan 4 sub-menu', () => {
    ImportPage.open(fx.home);
    ImportPage.assertSidebarMenuVisible(fx.menu.title, fx.roleHintMenu);
    ImportPage.sidebar
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

  it('TC-IMP-AKSES-002 | Edge | Sub-menu Import membuka halaman upload (menu vs hak akses konsisten)', () => {
    ImportPage.open(fx.home);
    ImportPage.assertSidebarMenuVisible(fx.menu.title, fx.roleHintMenu);
    ImportPage.sidebar.menuTitle(fx.menu.title).click();
    ImportPage.sidebar.subLink(fx.pages.cif.path).should('be.visible').click();
    cy.location('pathname').should('eq', fx.pages.cif.path);
    ImportPage.assertBreadcrumb(fx.pages.cif.breadcrumb);
  });

  it('TC-IMP-AKSES-003 | Negatif | Akun tanpa role supervisor/CS membuka /import/cif', () => {
    ImportPage.assertDirectUrlDenied(fx.pages.cif.path, {
      home: fx.home,
      message: fx.deniedMessage,
      roleHint: fx.roleHintDenied,
    });
  });

  it('TC-IMP-AKSES-004 | Negatif | Akun tanpa role supervisor/CS membuka /import/neraca', () => {
    ImportPage.assertDirectUrlDenied(fx.pages.neraca.path, {
      home: fx.home,
      message: fx.deniedMessage,
      roleHint: fx.roleHintDenied,
    });
  });
});
