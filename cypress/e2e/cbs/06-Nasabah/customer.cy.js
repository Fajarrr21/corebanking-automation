// Menu Nasabah — halaman landing /customer (read-only).
// TC sumber: docs/test-cases/src/TC_Nasabah_Menu.json
import LoginPage from '../../../support/pageobjects/LoginPage';
import CustomerPage from '../../../support/pageobjects/Nasabah/CustomerPage';

describe('Nasabah - Halaman Menu Nasabah (/customer)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/customer').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    // Login dulu (POST /login) baru pasang write-guard.
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Navigasi & tampilan', () => {
    it('TC-NSB-MENU-001 | Happy | Menu sidebar Nasabah membuka halaman /customer', () => {
      CustomerPage.visitPage('/home');
      CustomerPage.elements.sidebarMenu(fx.menuTitle).should('have.length', 1);
      CustomerPage.clickSidebar(fx.menuTitle);
      CustomerPage.assertUrl(fx.path).assertNotRedirectedToLogin().assertBreadcrumb(fx.breadcrumb);
    });

    it('TC-NSB-MENU-002 | Positif | Kartu daftar nasabah tampil lengkap dan kartu Deposito tidak tampil', () => {
      CustomerPage.visitPage(fx.path);
      CustomerPage.assertCardTitles(fx.cards);
      fx.hiddenCards.forEach((t) => CustomerPage.elements.card(t).should('not.exist'));
      fx.cards.forEach((t) =>
        CustomerPage.elements.card(t).find('a.btn').should('contain.text', fx.detailButton),
      );
    });
  });

  describe('Tombol Lihat Detail', () => {
    it('TC-NSB-MENU-003 | Positif | Lihat Detail kartu Data CIF membuka list CIF', () => {
      CustomerPage.visitPage(fx.path);
      CustomerPage.elements.card(fx.cards[0]).find('a.btn').should('have.attr', 'href').and('match', new RegExp(`${fx.links.cif}$`));
      CustomerPage.clickCardDetail(fx.cards[0], fx.detailButton);
      cy.location('pathname').should('eq', fx.links.cif);
    });

    it('TC-NSB-MENU-004 | Positif | Lihat Detail kartu Simpanan membuka list simpanan', () => {
      CustomerPage.visitPage(fx.path);
      CustomerPage.elements.card(fx.cards[1]).find('a.btn').should('have.attr', 'href').and('match', new RegExp(`${fx.links.saving}$`));
      CustomerPage.clickCardDetail(fx.cards[1], fx.detailButton);
      cy.location('pathname').should('eq', fx.links.saving);
    });
  });
});
