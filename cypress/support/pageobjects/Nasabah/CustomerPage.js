// CustomerPage — landing menu Nasabah (/customer).
//
// Sumber: resources/views/customer/index.blade.php (origin/develop).
// Halaman statis berisi kartu `.portlet.light` dengan judul <strong> (Data CIF,
// Simpanan, Pinjaman Aktif, Daftar Hitam, Pinjaman Lunas) dan tombol
// "Lihat Detail" (a.btn.blue-steel) yang mengarah ke route masing-masing.
// Kartu Deposito di-comment di blade (tidak dirender).
//
// Menu sidebar "Nasabah" hanya tampil untuk role auditor / super-admin /
// customer-service (navigation.blade.php @if checkRoleWithoutAction).

import BasePage from '../BasePage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

class CustomerPage extends BasePage {
  elements = {
    sidebarMenu: (title) =>
      cy.get('ul.page-sidebar-menu span.title').filter((i, el) => norm(el.innerText) === title),
    cards: () => cy.get('.page-content .portlet.light'),
    cardTitles: () => cy.get('.page-content .portlet.light strong'),
    /** Kartu berdasarkan judul <strong> (persis). */
    card: (title) =>
      cy.get('.page-content .portlet.light').filter((i, el) => norm(Cypress.$(el).find('strong').text()) === title),
  };

  visitPage(path) {
    this.open(path);
    return this;
  }

  /** Klik menu sidebar berdasarkan judul `span.title`. */
  clickSidebar(title) {
    this.elements.sidebarMenu(title).first().closest('a').click();
    return this;
  }

  /** Klik tombol "Lihat Detail" pada kartu berjudul `title`. */
  clickCardDetail(title, label) {
    this.elements.card(title).find('a.btn').contains(label).click();
    return this;
  }

  /** Daftar judul kartu yang terlihat (urutan DOM). */
  assertCardTitles(expected) {
    this.elements.cardTitles().should(($s) => {
      const actual = Cypress.$.makeArray($s).map((el) => norm(el.innerText));
      expect(actual).to.deep.eq(expected);
    });
    return this;
  }

  /**
   * true bila menu khusus super-admin (mis. "Kantor") tampil di sidebar.
   * Dipakai spec untuk precondition berbasis role.
   */
  isSuperAdmin(marker = 'Kantor') {
    return cy.get('ul.page-sidebar-menu').then(($m) => {
      const titles = Cypress.$.makeArray($m.find('span.title')).map((el) => norm(el.innerText));
      return titles.includes(marker);
    });
  }
}

export default new CustomerPage();
