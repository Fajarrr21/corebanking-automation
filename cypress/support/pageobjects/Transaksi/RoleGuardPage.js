// RoleGuardPage — base page untuk modul yang dibatasi role (Transaksi, Import,
// Kas Tunai Pusat, Website LKM).
//
// Otorisasi CBS ada di constructor controller (BUKAN route):
//   if (Helpers::checkRole([...])) return $next($request);
// checkRole() gagal -> Helpers::errorRedirect('home', 'Akses anda terbatas!')
// -> 302 ke /home + flash 'error' (div.alert.alert-danger di dashboard).
//
// Akun test (cypress.env.json) role-nya BELUM terverifikasi. Supaya TC tidak
// lulus diam-diam, method di sini memeriksa precondition role di awal dan
// MENGGAGALKAN test dengan pesan jelas bila tidak terpenuhi.
import BasePage from '../BasePage';

export default class RoleGuardPage extends BasePage {
  sidebar = {
    /** Judul menu level-1 di sidebar, cocok persis (trim). */
    menuTitle: (title) =>
      cy
        .get('ul.page-sidebar-menu > li > a > span.title')
        .filter((_, el) => el.innerText.replace(/\s+/g, ' ').trim() === title),
    /** Link sub-menu berdasarkan href (route name -> path). */
    subLink: (path) => cy.get(`ul.page-sidebar-menu ul.sub-menu a.nav-link[href$="${path}"]`),
  };

  /**
   * Buka halaman yang dibatasi role. Kalau app mengalihkan (mis. ke /home karena
   * checkRole gagal, atau ke /login), test GAGAL dengan pesan precondition.
   */
  openGuarded(path, roleHint) {
    this.open(path);
    const expected = path.split('?')[0];
    cy.location('pathname').then((p) => {
      if (!p.startsWith(expected)) {
        const flash = Cypress.$('.alert.alert-danger').text().replace(/\s+/g, ' ').trim();
        throw new Error(
          `Precondition role tidak terpenuhi: ${expected} dialihkan ke ${p}` +
            `${flash ? ` dengan pesan "${flash}"` : ''} — ${roleHint}`,
        );
      }
    });
    return this;
  }

  /**
   * TC negatif akses: akun TANPA role membuka URL langsung -> 302 /home + flash
   * "Akses anda terbatas!". Kalau akun test ternyata PUNYA akses, precondition
   * gagal (bukan lulus diam-diam).
   */
  assertDirectUrlDenied(path, { home, message, roleHint }) {
    this.open(path);
    const expected = path.split('?')[0];
    cy.location('pathname').then((p) => {
      if (p.startsWith(expected)) {
        throw new Error(
          `Precondition tidak terpenuhi: akun test BISA membuka ${expected} — TC ini butuh akun ${roleHint}`,
        );
      }
    });
    cy.location('pathname').should('eq', home);
    this.common.alertDanger().should('be.visible').and('contain.text', message);
    return this;
  }

  /** Precondition menu sidebar tampil; gagal dengan pesan jelas bila tidak. */
  assertSidebarMenuVisible(title, roleHint) {
    cy.get('ul.page-sidebar-menu').should('exist');
    cy.get('ul.page-sidebar-menu > li > a > span.title').then(($t) => {
      const titles = Cypress.$.makeArray($t).map((el) => el.innerText.replace(/\s+/g, ' ').trim());
      if (!titles.includes(title)) {
        throw new Error(`Menu sidebar "${title}" tidak tampil — ${roleHint}. Menu yang ada: ${titles.join(', ')}`);
      }
    });
    return this;
  }

  /** Klik tab nav-pills Bootstrap berdasarkan href (#id) lalu pastikan pane aktif. */
  openTab(hash) {
    cy.get(`ul.nav-pills a[href="${hash}"]`).click();
    cy.get(`${hash}.tab-pane`).should('have.class', 'active');
    return this;
  }

  /** Set nilai input readonly (datepicker) via jQuery app + trigger change. */
  setReadonlyDate(sel, value) {
    cy.window().then((win) => {
      win.$(sel).val(value).trigger('change');
    });
    return this;
  }

  /** Teks semua <option> dari <select>. */
  optionTexts(sel) {
    return cy.get(`${sel} option`).then(($o) =>
      Cypress.$.makeArray($o).map((o) => o.textContent.replace(/\s+/g, ' ').trim()),
    );
  }

  /** Assert link download template merespons 200 (via cy.request, bukan membuka tab). */
  assertDownloadable(href) {
    cy.request({ url: href, encoding: 'binary', failOnStatusCode: false }).then((res) => {
      expect(res.status, `status ${href}`).to.eq(200);
      expect(res.body.length, 'ukuran file > 0').to.be.greaterThan(0);
    });
    return this;
  }
}
