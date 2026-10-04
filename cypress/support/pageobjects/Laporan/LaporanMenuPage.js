// LaporanMenuPage — menu sidebar "Laporan" + halaman indeks kartu laporan
// (/report/general, /report/loan, /report/saving).
//
// Sumber: resources/views/layouts/navigation.blade.php (blok "Laporan"),
//         resources/views/report/{general,loan,saving}/index.blade.php.
// Halaman indeks = kartu `.portlet.light` berisi <strong>judul</strong> dan tombol
// "Lihat Detail" (a.btn) ber-href ke laporan.

import ReportBasePage from './ReportBasePage';

class LaporanMenuPage extends ReportBasePage {
  elements = {
    sidebar: () => cy.get('ul.page-sidebar-menu'),
    laporanMenu: (label) => cy.contains('ul.page-sidebar-menu span.title', new RegExp(`^\\s*${label}\\s*$`)).closest('li'),
    subMenuLinks: (label) => this.elements.laporanMenu(label).find('ul.sub-menu a.nav-link'),
    cards: () => cy.get('.page-content .portlet.light'),
    cardLink: (href) => cy.get(`.page-content .portlet.light a[href="${href}"]`),
    heading: () => cy.get('.page-content .row p').first(),
  };

  visitIndex(page) {
    return this.open(page.path);
  }

  expandLaporan(label) {
    cy.contains('ul.page-sidebar-menu span.title', label).click();
    return this;
  }

  /** Teks semua submenu Laporan (dibaca dari DOM, tidak perlu menu terbuka). */
  subMenuTexts(label) {
    return this.elements.subMenuLinks(label).then(($a) =>
      Cypress.$.makeArray($a).map((a) => ({
        text: a.textContent.replace(/\s+/g, ' ').trim(),
        href: new URL(a.getAttribute('href'), window.location.origin).pathname,
      })),
    );
  }

  /** Assert kartu dengan judul & href ada. */
  assertCard(card) {
    this.elements
      .cardLink(card.href)
      .should('have.length.at.least', 1)
      .first()
      .closest('.portlet')
      .find('strong')
      .invoke('text')
      .then((t) => expect(t.replace(/\s+/g, ' ').trim()).to.eq(card.label));
    return this;
  }
}

export default new LaporanMenuPage();
