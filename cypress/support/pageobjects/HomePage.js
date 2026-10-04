// HomePage — halaman /home CBS + sidebar (Metronic page-sidebar-menu).
//
// Sidebar mulai tertutup (class "page-sidebar-menu-closed"); di viewport
// responsif harus klik toggler dulu supaya .navbar-collapse terbuka. Menu
// utama diidentifikasi lewat teks judul (<span class="title">) atau href-nya.

class HomePage {
  elements = {
    menuToggler: () => cy.get('a.menu-toggler.responsive-toggler'),
    sidebar: () => cy.get('ul.page-sidebar-menu'),
    // Item menu top-level dicari via teks judul (stabil).
    menuByTitle: (title) =>
      cy.get('ul.page-sidebar-menu span.title').contains(new RegExp(`^\\s*${title}\\s*$`)),
    // Link menu via href-nya (mis. '/customer', '/approval', '/collateral').
    menuByHref: (href) => cy.get(`ul.page-sidebar-menu a[href*="${href}"]`),
  };

  assertLoaded() {
    cy.url().should('include', '/home');
    return this;
  }

  openSidebar() {
    // Klik toggler kalau tampil (viewport responsif). Di layar lebar sidebar
    // sudah tampil; toggler tersembunyi — jadi cek visibility dulu.
    this.elements.menuToggler().then(($t) => {
      if ($t.is(':visible')) cy.wrap($t).click();
    });
    return this;
  }

  assertMenuVisible(title) {
    this.elements.menuByTitle(title).should('exist');
    return this;
  }

  goToMenu(href) {
    this.elements.menuByHref(href).first().click();
    return this;
  }
}

export default new HomePage();
