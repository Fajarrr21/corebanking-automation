/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_Umum.json
// Read-only (guardWrites + assertNoWritesLeaked).
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Halaman & navigasi tab', () => {
  let fx;

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Halaman tampil', () => {
    beforeEach(() => {
      PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    });

    it('TC-SET-UMUM-001 | Happy | Halaman Pengaturan tampil dengan 10 tab dan tab Biaya aktif secara default', () => {
      PengaturanPage.openSetting().assertUrl(fx.paths.setting).assertBreadcrumb(fx.menu.breadcrumb);
      PengaturanPage.elements.tabLinks().should(($a) => {
        const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
        expect(labels).to.deep.eq(fx.tabs.map((t) => t.label));
      });
      PengaturanPage.assertTabActive(fx.tabs[0]);
      PengaturanPage.elements.activeTabItems().should('have.length', 1);
    });

    it('TC-SET-UMUM-002 | Positif | Menu sidebar Pengaturan membuka halaman /setting', () => {
      PengaturanPage.open('/home');
      PengaturanPage.elements.sidebarMenu(fx.menu.sidebarTitle).should('have.attr', 'href').and('match', /\/setting$/);
      PengaturanPage.elements.sidebarMenu(fx.menu.sidebarTitle).click();
      PengaturanPage.assertUrl(fx.paths.setting).assertBreadcrumb(fx.menu.breadcrumb);
    });

    it('TC-SET-UMUM-003 | Positif | Klik setiap tab menampilkan panel tab tersebut dan menulis ?menu ke URL', () => {
      PengaturanPage.openSetting();
      fx.tabs.forEach((t) => {
        PengaturanPage.elements.tabLink(t.pane).click();
        PengaturanPage.assertTabActive(t);
        cy.location('search').should('include', `menu=${t.key}`);
      });
    });

    it('TC-SET-UMUM-004 | Positif | Deep link ?menu=<tab> langsung mengaktifkan tab yang sesuai', () => {
      fx.tabs.forEach((t) => {
        PengaturanPage.openSetting(t.key);
        PengaturanPage.assertTabActive(t);
        PengaturanPage.elements.activeTabItems().should('have.length', 1);
      });
    });

    it('TC-SET-UMUM-005 | Edge | Parameter menu yang tidak dikenal tidak menimbulkan error halaman', () => {
      PengaturanPage.openSetting(fx.unknownMenu);
      PengaturanPage.elements.tabLinks().should('have.length', fx.tabs.length);
      PengaturanPage.assertNoErrorAlert();
      PengaturanPage.elements.tabLink(fx.tabs[0].pane).click();
      PengaturanPage.assertTabActive(fx.tabs[0]);
    });

    it('TC-SET-UMUM-006 | Positif | Label statis halaman Pengaturan tidak lagi memakai istilah Unit', () => {
      PengaturanPage.openSetting();
      cy.get(fx.staticLabelSelectors).then(($els) => {
        const re = new RegExp(fx.forbiddenTerm);
        const hits = Cypress.$.makeArray($els)
          .map((e) => e.textContent.replace(/\s+/g, ' ').trim())
          .filter((t) => re.test(t));
        expect(hits, 'label yang masih memakai istilah "Unit"').to.deep.eq([]);
      });
    });
  });

  describe('Kesehatan JavaScript halaman', () => {
    it('TC-SET-UMUM-007 | Negatif | Halaman Pengaturan dimuat tanpa error JavaScript', () => {
      const errors = [];
      cy.on('uncaught:exception', (err) => {
        errors.push(err.message);
        return false;
      });
      PengaturanPage.openSetting();
      PengaturanPage.elements.tabLinks().should('have.length', fx.tabs.length);
      cy.then(() => expect(errors, 'uncaught JS error saat memuat /setting').to.deep.eq([]));
    });
  });
});
