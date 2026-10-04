/// <reference types="cypress" />
// Karyawan (/user) — daftar karyawan. Read-only (cy.guardWrites).
// Tombol Hapus pada modal TIDAK pernah diklik di spec ini.
// TC sheet: docs/test-cases/src/TC_Karyawan_List.json
import KaryawanListPage from '../../../support/pageobjects/Karyawan/KaryawanListPage';

describe('Karyawan - Daftar Karyawan', () => {
  let fx;

  before(() => {
    cy.fixture('karyawan/karyawan').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    KaryawanListPage.openGuarded();
    KaryawanListPage.assertSuperAdmin(fx.labels.superAdminMenu).waitLoaded();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tampilan', () => {
    it('TC-KRY-LIST-001 | Happy | Halaman Karyawan tampil dengan breadcrumb, tombol Tambah Karyawan, dan tabel', () => {
      KaryawanListPage.assertUrl(fx.urls.list).assertNotRedirectedToLogin().assertBreadcrumb(fx.labels.breadcrumbList);
      KaryawanListPage.elements.addButton().should('be.visible').and('contain.text', fx.labels.addButton).and(($a) => {
        expect(new URL($a.prop('href')).pathname).to.eq(fx.urls.create);
      });
      KaryawanListPage.rowData().then((rows) => expect(rows.length, 'ada data karyawan').to.be.greaterThan(0));
    });

    it('TC-KRY-LIST-002 | Positif | Header kolom tabel karyawan sesuai', () => {
      KaryawanListPage.assertHeaders(fx.labels.headers, KaryawanListPage.table);
    });

    it('TC-KRY-LIST-003 | Positif | Kolom Status hanya Aktif / Tidak Aktif', () => {
      KaryawanListPage.showAll();
      KaryawanListPage.rowData().then((rows) => {
        rows.forEach((c) => {
          expect(fx.labels.statusValues, `Status ${c[fx.columns.email]}`).to.include(c[fx.columns.status]);
        });
      });
    });

    it('TC-KRY-LIST-004 | Positif | Akun bot tidak ditampilkan di daftar karyawan', () => {
      KaryawanListPage.showAll();
      KaryawanListPage.rowData().then((rows) => {
        const bots = rows.filter((c) => new RegExp(fx.labels.botRolePattern, 'i').test(c[fx.columns.role]));
        expect(bots.map((c) => c[fx.columns.email]), 'user ber-role bot').to.deep.eq([]);
      });
    });

    it('TC-KRY-LIST-005 | Positif | Label UI halaman Karyawan tidak memakai istilah "Unit"', () => {
      cy.document().then((doc) => {
        const $ = Cypress.$;
        const txt = [
          ...$('.page-breadcrumb', doc).toArray(),
          ...$(`${KaryawanListPage.table} thead th`, doc).toArray(),
          ...$('.table-toolbar', doc).toArray(),
        ].map((el) => el.innerText).join(' | ');
        expect(txt).not.to.match(new RegExp(fx.labels.forbiddenTermPattern, 'i'));
      });
    });
  });

  describe('Pencarian & aksi', () => {
    it('TC-KRY-LIST-006 | Positif | Pencarian email menampilkan karyawan yang sesuai', () => {
      KaryawanListPage.rowData().then((rows) => {
        const email = rows[0][fx.columns.email];
        KaryawanListPage.search(email);
        KaryawanListPage.rowByEmail(email, fx.columns.email).should('have.length', 1);
        KaryawanListPage.elements.rows().should(($rows) => {
          Cypress.$.makeArray($rows).forEach((r) => {
            expect(r.innerText.toLowerCase(), 'baris hasil memuat email').to.include(email.toLowerCase());
          });
        });
      });
    });

    it('TC-KRY-LIST-007 | Negatif | Modal Hapus menampilkan nama karyawan dan batal tanpa menghapus', () => {
      const loginEmail = Cypress.env('appEmail');
      KaryawanListPage.rowData().then((rows) => {
        const target = rows.find((c) => c[fx.columns.email] !== loginEmail);
        expect(target, 'ada karyawan selain akun login').to.exist;
        KaryawanListPage.search(target[fx.columns.email]);
        KaryawanListPage.rowByEmail(target[fx.columns.email], fx.columns.email)
          .find('a[data-target="#delete"]').click();
        KaryawanListPage.elements.deleteModal().should('be.visible')
          .and('contain.text', fx.labels.deleteModalTitle)
          .and('contain.text', fx.labels.deleteModalBody);
        KaryawanListPage.elements.deleteName().should('have.text', target[fx.columns.name]);
        KaryawanListPage.elements.deleteClose().click();
        KaryawanListPage.elements.deleteModal().should('not.be.visible');
        cy.blockedWrites().should('deep.eq', []);
        KaryawanListPage.rowByEmail(target[fx.columns.email], fx.columns.email).should('have.length', 1);
      });
    });

    it('TC-KRY-LIST-008 | Positif | Tombol Tambah Karyawan membuka form tambah', () => {
      KaryawanListPage.elements.addButton().click();
      KaryawanListPage.assertUrl(fx.urls.create).assertBreadcrumb(fx.labels.breadcrumbCreate);
    });

    it('TC-KRY-LIST-009 | Positif | Menu sidebar Karyawan membuka halaman /user', () => {
      cy.visit(fx.urls.home);
      cy.get('ul.page-sidebar-menu a[href$="/user"]').first().click();
      KaryawanListPage.assertUrl(fx.urls.list).assertBreadcrumb(fx.labels.breadcrumbList);
    });
  });
});
