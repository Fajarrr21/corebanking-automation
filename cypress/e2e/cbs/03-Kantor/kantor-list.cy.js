/// <reference types="cypress" />
// Kantor (/office) — daftar kantor. Read-only (cy.guardWrites).
// PRD "Penamaan Cabang dan Penanda Tangan Dokumen": istilah Unit → Cabang.
// TC sheet: docs/test-cases/src/TC_Kantor_List.json
import KantorPage from '../../../support/pageobjects/Kantor/KantorPage';

describe('Kantor - Daftar Kantor', () => {
  let fx;

  before(() => {
    cy.fixture('kantor/kantor').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    KantorPage.openGuarded();
    KantorPage.assertSuperAdmin(fx.labels.superAdminMenu).waitLoaded();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tampilan', () => {
    it('TC-KTR-LIST-001 | Happy | Halaman Kantor tampil dengan breadcrumb, catatan vendor, dan tabel kantor', () => {
      KantorPage.assertUrl(fx.urls.office).assertNotRedirectedToLogin().assertBreadcrumb(fx.labels.breadcrumb);
      KantorPage.elements.infoNote().should('contain.text', fx.labels.note);
      KantorPage.elements.openOperationBtn().should('be.visible').and('have.text', fx.labels.openOperation);
      KantorPage.elements.closedOperationBtn().should('be.visible').and('have.text', fx.labels.closedOperation);
    });

    it('TC-KTR-LIST-002 | Positif | Header kolom tabel kantor sesuai', () => {
      KantorPage.elements.headers().should(($th) => {
        const actual = Cypress.$.makeArray($th).map((th) => th.innerText.replace(/\s+/g, ' ').trim());
        // Kolom 0 (ID) dirender plugin checkbox DataTables → header bisa berupa checkbox tanpa teks.
        expect(actual.slice(1), 'header kolom 2..12').to.deep.eq(fx.labels.headers.slice(1));
        expect(actual.length).to.eq(fx.labels.headers.length);
      });
    });

    it('TC-KTR-LIST-003 | Positif | Kolom Status dan Auto Debit hanya berisi Aktif / Non Aktif', () => {
      KantorPage.showAll(fx.pageLengthAll);
      KantorPage.rowData().then((rows) => {
        expect(rows.length, 'ada data kantor').to.be.greaterThan(0);
        rows.forEach((c) => {
          expect(fx.labels.statusValues, `Status kantor ${c[fx.columns.name]}`).to.include(c[fx.columns.status]);
          expect(fx.labels.autoDebitValues, `Auto Debit kantor ${c[fx.columns.name]}`).to.include(c[7]);
        });
      });
    });
  });

  describe('Istilah Unit → Cabang (PRD)', () => {
    it('TC-KTR-LIST-004 | Positif | Kolom Role menampilkan Wilayah/Cabang, bukan kode BRANCH/UNIT', () => {
      KantorPage.showAll(fx.pageLengthAll);
      KantorPage.rowData().then((rows) => {
        const allowed = Object.values(fx.labels.roleValues);
        rows.forEach((c) => {
          expect(allowed, `Role kantor ${c[fx.columns.name]} = "${c[fx.columns.role]}"`).to.include(c[fx.columns.role]);
        });
      });
    });

    it('TC-KTR-LIST-005 | Positif | Filter jenis kantor berisi Semua Jenis Kantor, Wilayah, Cabang', () => {
      KantorPage.elements.roleFilter().find('option').should(($o) => {
        const texts = Cypress.$.makeArray($o).map((o) => o.textContent.trim());
        expect(texts).to.deep.eq(fx.labels.roleFilterOptions);
      });
    });

    it('TC-KTR-LIST-006 | Positif | Filter Cabang/Wilayah hanya menampilkan kantor dengan jenis tersebut', () => {
      KantorPage.showAll(fx.pageLengthAll);
      Object.entries(fx.labels.roleValues).forEach(([value, label]) => {
        KantorPage.filterRole(value);
        KantorPage.elements.rows().should(($rows) => {
          const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
          data.forEach((r) => {
            const role = Cypress.$(r).find('td').eq(fx.columns.role).text().trim();
            expect(role, `filter ${label}`).to.eq(label);
          });
        });
      });
      KantorPage.filterRole('');
      KantorPage.rowData().then((rows) => expect(rows.length).to.be.greaterThan(0));
    });

    it('TC-KTR-LIST-007 | Positif | Label UI halaman Kantor tidak memakai istilah "Unit"', () => {
      KantorPage.uiLabelText().then((txt) => {
        expect(txt, 'label UI halaman Kantor').not.to.match(new RegExp(fx.forbiddenTermPattern, 'i'));
      });
    });
  });

  describe('Pencarian & integritas data', () => {
    it('TC-KTR-LIST-008 | Positif | Pencarian nama kantor menyaring baris tabel', () => {
      KantorPage.rowData().then((rows) => {
        const name = rows[0][fx.columns.name];
        KantorPage.elements.searchInput().clear().type(name, { delay: 0 });
        KantorPage.elements.rows().should(($rows) => {
          const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
          expect(data.length, 'minimal 1 hasil').to.be.greaterThan(0);
          const names = data.map((r) => Cypress.$(r).find('td').eq(fx.columns.name).text().trim());
          expect(names, 'kantor yang dicari ada di hasil').to.include(name);
          // DataTables "smart search": tiap kata kunci harus muncul di baris hasil.
          const words = name.toLowerCase().split(/\s+/).filter(Boolean);
          data.forEach((r) => {
            const txt = r.innerText.toLowerCase();
            words.forEach((w) => expect(txt, `baris memuat kata "${w}"`).to.include(w));
          });
        });
      });
    });

    it('TC-KTR-LIST-009 | Edge | Kolom Wilayah kantor Cabang merujuk nama kantor Wilayah yang ada', () => {
      KantorPage.showAll(fx.pageLengthAll);
      KantorPage.rowData().then((rows) => {
        const wilayahNames = rows
          .filter((c) => c[fx.columns.role] === fx.labels.roleValues.BRANCH)
          .map((c) => c[fx.columns.name]);
        const orphans = rows
          .filter((c) => c[fx.columns.role] === fx.labels.roleValues.UNIT && c[fx.columns.wilayah] !== '')
          .filter((c) => !wilayahNames.includes(c[fx.columns.wilayah]))
          .map((c) => `${c[fx.columns.name]} → "${c[fx.columns.wilayah]}"`);
        expect(orphans, 'kantor Cabang yang Wilayah-nya tidak cocok dengan nama kantor Wilayah mana pun').to.deep.eq([]);
      });
    });

    it('TC-KTR-LIST-010 | Positif | Menu sidebar Kantor membuka halaman /office', () => {
      cy.visit(fx.urls.home);
      cy.get('ul.page-sidebar-menu a[href$="/office"]').first().click();
      KantorPage.assertUrl(fx.urls.office).assertBreadcrumb(fx.labels.breadcrumb);
    });
  });
});
