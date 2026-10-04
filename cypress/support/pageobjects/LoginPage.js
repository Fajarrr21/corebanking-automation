// LoginPage — halaman login CBS (staging-cbs.cazh.id/login).
//
// ⚠️ BEDA dengan school v3: CBS = Laravel/Metronic. Login BUKAN API XHR, tapi
// FORM POST biasa (<form action=".../login" method="post"> + hidden _token CSRF).
// Sukses login = full-page redirect ke /home. Jadi TIDAK ada endpoint API buat
// di-intercept; validasi sukses dilakukan lewat URL (harus pindah ke /home).
//
// Selector (dari HTML asli yang direkam):
//   email  : <input class="form-control" type="email"  name="email" id="email">
//   password: <input class="form-control" type="password" name="password" id="password">
//   submit : <button type="submit" class="btn-submit">Masuk</button>
//   token  : <input type="hidden" name="_token" value="...">  (sudah ada di DOM)

const DASHBOARD_PATH = '/home';

class LoginPage {
  elements = {
    // ⚠️ Scope ke #loginForm: halaman login juga punya form "Lupa password?"
    // (action=/password/email) yang PUNYA input[name="email"] sendiri (hidden).
    // Tanpa scope, selector email ambigu (match 2 elemen) -> clear/type gagal.
    emailInput: () => cy.get('#loginForm input[name="email"]'),
    // pakai name (bukan type) — ada tombol "toggle-pw" yang mengubah type
    // password<->text, jadi selector by-type rapuh.
    passwordInput: () => cy.get('#loginForm input[name="password"]'),
    submitBtn: () => cy.get('#loginForm button[type="submit"].btn-submit'),
    togglePw: () => cy.get('button.toggle-pw'),
    rememberCheck: () => cy.get('input[name="remember"]'),
    forgotLink: () => cy.get('#forget-password'),
    form: () => cy.get('form#loginForm'),
    csrfToken: () => cy.get('#loginForm input[name="_token"]'),
  };

  visit(baseUrl, loginPath) {
    cy.visit(`${baseUrl}${loginPath}`);
    return this;
  }

  fillEmail(email) {
    this.elements.emailInput().clear().type(email);
    return this;
  }

  fillPassword(password) {
    this.elements.passwordInput().clear().type(password, { log: false });
    return this;
  }

  clickSubmit() {
    this.elements.submitBtn().click();
    return this;
  }

  login(email, password) {
    if (email) this.fillEmail(email);
    if (password) this.fillPassword(password);
    return this.clickSubmit();
  }

  clearSession() {
    cy.clearCookies();
    cy.clearLocalStorage();
    return this;
  }

  /**
   * Login via cy.session dengan validasi berbasis URL.
   *
   * ENVIRONMENT SWITCH — kalau run dijalankan dengan environment tertentu
   * (--env environment=staging), cypress.config.js sudah menaruh URL + kredensial
   * env itu ke Cypress.env. Nilai itu MENANG atas argumen fixture. Inilah yang
   * bikin satu repo melayani banyak environment tanpa mengedit tiap spec/fixture.
   *
   * @param {object} opts - { redirect, dashboard } — semua opsional
   */
  loginViaSession(email, password, baseUrl, loginPath, opts = {}) {
    const redirect = opts.redirect || 20000;
    const dashboard = opts.dashboard || Cypress.env('appDashboard') || DASHBOARD_PATH;

    const environment = Cypress.env('environment') || 'staging';
    const e = Cypress.env('appEmail') || email;
    const p = Cypress.env('appPassword') || password;
    const b = Cypress.env('appBase') || baseUrl;
    const l = Cypress.env('appLogin') || loginPath;

    cy.session(
      // Namespace per-env: sesi environment berbeda tidak saling menimpa.
      `session-${environment}-${e}`,
      () => {
        cy.visit(`${b}${l}`);
        this.elements.emailInput().should('be.visible').clear().type(e);
        this.elements.passwordInput().should('be.visible').clear().type(p, { log: false });
        this.elements.submitBtn().should('be.enabled').click();

        // Sukses = full-page redirect keluar dari /login menuju /home.
        cy.url({ timeout: redirect }).should('include', dashboard);
      },
      {
        validate() {
          // Sesi mati -> app melempar balik ke /login. Cek dengan mengunjungi
          // /home: kalau masih login, url tetap di /home.
          cy.visit(`${b}${dashboard}`, { failOnStatusCode: false });
          cy.url({ timeout: redirect }).should('not.include', l);
        },
      },
    );
    return this;
  }

  assertOnLoginPage(loginPath = '/login') {
    cy.url().should('contain', loginPath);
    this.elements.emailInput().should('be.visible');
    this.elements.passwordInput().should('be.visible');
    this.elements.submitBtn().should('be.visible');
    return this;
  }

  assertLoggedIn(dashboard = DASHBOARD_PATH) {
    cy.url().should('include', dashboard);
    return this;
  }
}

export default new LoginPage();
