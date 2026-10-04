/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import HomePage from '../../../support/pageobjects/HomePage';

// Smoke test login CBS — memastikan project baru bisa:
//   1. membuka halaman login & elemennya tampil
//   2. login dengan kredensial valid (via env-switch) sampai mendarat di /home
//   3. sidebar & menu utama muncul setelah login
//
// URL & kredensial datang dari env-switch (cypress.config.js + cypress.env.json),
// BUKAN di-hardcode di spec. Fixture login.json hanya untuk label/menu/timeout.

describe('CBS - Autentikasi Login', () => {
  let fx;

  before(() => {
    cy.fixture('login').then((data) => (fx = data));
  });

  beforeEach(() => {
    LoginPage.clearSession();
  });

  it('TC-001 : halaman login tampil dengan elemen lengkap', () => {
    const base = Cypress.env('appBase');
    const loginPath = Cypress.env('appLogin');

    LoginPage.visit(base, loginPath);
    LoginPage.assertOnLoginPage(loginPath);

    // token CSRF harus ada (form Laravel).
    LoginPage.elements.csrfToken().should('exist');
    LoginPage.elements
      .emailInput()
      .should('have.attr', 'placeholder', fx.labels.emailPlaceholder);
    LoginPage.elements.submitBtn().should('contain', fx.labels.submitButton);
  });

  it('TC-002 : login valid mendarat di /home', () => {
    // Login via cy.session (kredensial dari env-switch).
    LoginPage.loginViaSession();
    cy.visit(Cypress.env('appDashboard'));
    LoginPage.assertLoggedIn('/home');
  });

  it('TC-003 : sidebar & menu utama muncul setelah login', () => {
    LoginPage.loginViaSession();
    cy.visit(Cypress.env('appDashboard'));

    HomePage.assertLoaded();
    HomePage.openSidebar();
    HomePage.elements.sidebar().should('exist');

    // Sejumlah menu inti harus ada.
    HomePage.assertMenuVisible('Dashboard');
    HomePage.assertMenuVisible('Nasabah');
    HomePage.assertMenuVisible('Approval');
  });
});
