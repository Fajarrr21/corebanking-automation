// ProfilePage — halaman profil user login (/profile).
//
// Source develop: ProfileController@profile → view dashboard/profile.blade.php
// (BUKAN profile/index.blade.php — file itu tidak dirender).
// Tab: #tab_1_1 Info Akun (form POST profile.post), #tab_1_2 Password,
// #tab_1_3 PIN (+ modal #forgot_pin). Tab aktif mengikuti ?menu=info|password|pin.
//
// ⚠️ READ-ONLY. Page object ini sengaja TIDAK menyediakan method submit /
// isi password / PIN — akun login test tidak boleh diubah.

import BasePage from '../BasePage';
import LoginPage from '../LoginPage';

class ProfilePage extends BasePage {
  path = '/profile';

  elements = {
    caption: () => cy.get('.portlet-title .caption-subject'),
    tabLinks: () => cy.get('.portlet-title ul.nav-tabs > li > a'),
    tabItem: (text) => cy.contains('.portlet-title ul.nav-tabs > li > a', text).parent('li'),
    tabPane: (sel) => cy.get(`.tab-content ${sel}`),
    infoPane: () => cy.get('#tab_1_1'),
    fieldByLabel: (label) =>
      cy.contains('#tab_1_1 .form-group label.control-label', new RegExp(`^\\s*${label}\\s*$`))
        .siblings('input, textarea'),
    instansiLabels: () => cy.get('#tab_1_1 label').filter((_, l) => /Nama Instansi/.test(l.textContent)),
    headerUsername: () => cy.get('.top-menu .dropdown-user .username'),
    headerToggle: () => cy.get('.top-menu .dropdown-user > a.dropdown-toggle'),
    accountMenuLink: (text) => cy.contains('.top-menu .dropdown-user .dropdown-menu a', text),
  };

  openGuarded(query = '') {
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.visit(`${this.path}${query}`);
    return this;
  }

  /** Header "Nama | Kantor" → { name, office }. */
  headerIdentity() {
    return this.elements.headerUsername().then(($u) => {
      const [name, office] = $u[0].innerText.split('|').map((s) => s.replace(/\s+/g, ' ').trim());
      return cy.then(() => ({ name, office }));
    });
  }
}

export default new ProfilePage();
