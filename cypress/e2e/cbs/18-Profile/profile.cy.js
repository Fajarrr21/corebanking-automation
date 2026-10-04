/// <reference types="cypress" />
// Profile (/profile) — HANYA tampilan (read-only).
// DILARANG: ganti password, ganti PIN, lupa PIN, edit profil. Tidak ada input
// yang diketik dan tidak ada tombol submit yang diklik; seluruh request tulis
// diblok cy.guardWrites dan diverifikasi tidak ada yang terkirim.
// TC sheet: docs/test-cases/src/TC_Profile_View.json
import ProfilePage from '../../../support/pageobjects/Profile/ProfilePage';

describe('Profile - Tampilan profil (read-only)', () => {
  let fx;

  before(() => {
    cy.fixture('profile/profile').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-PRF-VIEW-001 | Happy | Halaman Profile tampil dengan tab Info Akun aktif secara default', () => {
    ProfilePage.openGuarded();
    ProfilePage.assertUrl(fx.urls.profile).assertNotRedirectedToLogin().assertBreadcrumb(fx.labels.breadcrumb);
    ProfilePage.elements.caption().should('contain.text', fx.labels.caption);
    ProfilePage.elements.tabLinks().should(($a) => {
      expect(Cypress.$.makeArray($a).map((a) => a.textContent.trim())).to.deep.eq(fx.labels.tabs);
    });
    ProfilePage.elements.tabItem(fx.labels.tabs[0]).should('have.class', 'active');
    ProfilePage.elements.tabPane(fx.tabPanes.info).should('have.class', 'active').and('be.visible')
      .and('contain.text', fx.labels.infoNote);
  });

  it('TC-PRF-VIEW-002 | Positif | Email akun tampil read-only dan sesuai akun login', () => {
    ProfilePage.openGuarded();
    ProfilePage.elements.fieldByLabel('Email').should('have.attr', 'readonly');
    ProfilePage.elements.fieldByLabel('Email').should(($i) => {
      expect($i.val().toLowerCase(), 'email profil = email login').to.eq(String(Cypress.env('appEmail')).toLowerCase());
    });
  });

  it('TC-PRF-VIEW-003 | Positif | Nama Lengkap di profil sama dengan nama di header', () => {
    ProfilePage.openGuarded();
    ProfilePage.headerIdentity().then(({ name }) => {
      ProfilePage.elements.fieldByLabel('Nama Lengkap').should(($i) => {
        expect($i.val().trim(), 'Nama Lengkap = nama di header').to.eq(name);
      });
    });
  });

  it('TC-PRF-VIEW-004 | Positif | Data instansi konsisten dengan kantor di header (read-only)', () => {
    ProfilePage.openGuarded();
    ProfilePage.headerIdentity().then(({ office }) => {
      if (office === fx.labels.noOffice) {
        // User pusat (office_id 0): blok instansi tidak dirender.
        ProfilePage.elements.instansiLabels().should('have.length', 0);
      } else {
        ProfilePage.elements.fieldByLabel('Nama Instansi').should('have.attr', 'readonly');
        ProfilePage.elements.fieldByLabel('Nama Instansi').should(($i) => expect($i.val().trim()).to.eq(office));
        ['Nama Instansi Pusat', 'Nama Penanggung Jawab', 'No HP Penanggung Jawab'].forEach((l) => {
          ProfilePage.elements.fieldByLabel(l).should('have.attr', 'readonly');
        });
      }
    });
  });

  it('TC-PRF-VIEW-005 | Positif | Tautan ?menu=password membuka tab Password tanpa mengubah apa pun', () => {
    ProfilePage.openGuarded('?menu=password');
    ProfilePage.elements.tabItem(fx.labels.tabs[1]).should('have.class', 'active');
    ProfilePage.elements.tabItem(fx.labels.tabs[0]).should('not.have.class', 'active');
    ProfilePage.elements.tabPane(fx.tabPanes.password).should('have.class', 'active').and('contain.text', fx.labels.passwordNote);
    ProfilePage.elements.tabPane(fx.tabPanes.info).should('not.have.class', 'active');
  });

  it('TC-PRF-VIEW-006 | Positif | Menu header "Akun Saya" membuka halaman Profile', () => {
    ProfilePage.openGuarded();
    cy.visit(fx.urls.home);
    ProfilePage.elements.headerToggle().click();
    ProfilePage.elements.accountMenuLink(fx.labels.accountMenu).should('be.visible').click();
    ProfilePage.assertUrl(fx.urls.profile).assertBreadcrumb(fx.labels.breadcrumb);
  });

  it('TC-PRF-VIEW-007 | Positif | Menu sidebar Profile membuka halaman Profile', () => {
    ProfilePage.openGuarded();
    cy.visit(fx.urls.home);
    cy.get('ul.page-sidebar-menu a[href$="/profile"]').first().click();
    ProfilePage.assertUrl(fx.urls.profile).assertBreadcrumb(fx.labels.breadcrumb);
  });
});
