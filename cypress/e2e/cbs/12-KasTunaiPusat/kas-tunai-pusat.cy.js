// Kas Tunai Pusat — daftar saldo kas per kantor (/account/center). Read-only.
// TC sumber: docs/test-cases/src/TC_KasTunaiPusat_List.json
// Precondition: akun super-admin; menu hanya tampil bila APP_NAME staging =
// 'PT. LKM BKD KABUPATEN PEKALONGAN'. Tidak ada PRD (Sumber = Asumsi).
import LoginPage from '../../../support/pageobjects/LoginPage';
import KTPPage from '../../../support/pageobjects/KasTunaiPusat/KasTunaiPusatPage';

describe('Kas Tunai Pusat - Daftar (/account/center)', () => {
  let fx;

  before(() => {
    cy.fixture('kastunaipusat/kas-tunai-pusat').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', fx.dataUrl).as('ktpData');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openList = () => {
    KTPPage.openGuarded(fx.path, fx.roleHint);
    cy.wait('@ktpData').its('response.statusCode').should('eq', 200);
    KTPPage.waitTable('#kasTunai', fx.timeouts.table);
  };

  it('TC-KTP-LIST-001 | Happy | Menu Kas Tunai Pusat tampil dan membuka halaman daftar', () => {
    KTPPage.open(fx.home);
    KTPPage.assertSidebarMenuVisible(fx.menuTitle, fx.roleHintMenu);
    KTPPage.sidebar.menuTitle(fx.menuTitle).closest('a').should('have.attr', 'href').and('match', new RegExp(`${fx.path}$`));
    KTPPage.sidebar.menuTitle(fx.menuTitle).click();
    cy.location('pathname').should('eq', fx.path);
    KTPPage.assertBreadcrumb(fx.breadcrumb);
  });

  it('TC-KTP-LIST-002 | Positif | Halaman menampilkan kartu ringkasan bulan ini dan tabel Kantor/Saldo', () => {
    openList();
    KTPPage.assertBreadcrumb(fx.breadcrumb).assertDocumentTitle(fx.title);
    cy.contains('span', fx.cards.setoran).should('be.visible');
    cy.contains('span', fx.cards.penarikan).should('be.visible');
    KTPPage.assertHeaders(fx.headers, '#kasTunai');
  });

  it('TC-KTP-LIST-003 | Positif | Setiap kantor punya tombol Lihat ke detail dan saldo berformat IDR', () => {
    openList();
    KTPPage.dataRows('#kasTunai').should('have.length.greaterThan', 0);
    cy.get('#kasTunai tbody tr').should(($rows) => {
      Cypress.$.makeArray($rows)
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .forEach((r) => {
          const a = Cypress.$(r).find('a.btn');
          expect(a.text().trim()).to.eq(fx.viewButton);
          expect(new URL(a.attr('href')).pathname).to.match(new RegExp(`^${fx.path}/\\d+$`));
          expect(Cypress.$(r).find('td').eq(2).text().trim()).to.match(/^IDR -?[\d.]+,\d{2}$/);
        });
    });
  });

  it('TC-KTP-LIST-004 | Positif | Tombol export PDF dan Excel tersedia', () => {
    openList();
    cy.get('.buttons-pdf').should('exist');
    cy.get('.buttons-excel').should('exist');
  });

  it('TC-KTP-LIST-005 | Edge | Kartu "Jumlah Setoran bulan ini" menampilkan nilai setoran (bukan penarikan)', () => {
    openList();
    // Nilai di bawah label Setoran harus elemen #deposit (deposit_this_month).
    cy.contains('span', fx.cards.setoran).parent().find('strong[id]').should('have.attr', 'id', 'deposit');
    cy.contains('span', fx.cards.penarikan).parent().find('strong[id]').should('have.attr', 'id', 'withdraw');
  });

  it('TC-KTP-LIST-006 | Edge | Pencarian kantor tanpa kecocokan menampilkan empty-state', () => {
    openList();
    KTPPage.tableSearch('#kasTunai').type(fx.searchNoMatch);
    cy.wait('@ktpData');
    KTPPage.waitTable('#kasTunai', fx.timeouts.table);
    KTPPage.emptyState('#kasTunai').should('be.visible');
  });

  it('TC-KTP-LIST-007 | Negatif | Akun tanpa role super-admin membuka /account/center dialihkan ke /home', () => {
    KTPPage.assertDirectUrlDenied(fx.path, { home: fx.home, message: fx.deniedMessage, roleHint: fx.roleHintDenied });
  });
});
