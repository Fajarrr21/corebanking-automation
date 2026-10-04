// Agunan — Daftar Agunan (/collateral). Read-only.
// TC sumber: docs/test-cases/src/TC_Agunan_List.json
// PRD: "BKD - Data Agunan" (list, pencarian, filter jenis, detail).
import LoginPage from '../../../support/pageobjects/LoginPage';
import ListPage, { cell } from '../../../support/pageobjects/Agunan/CollateralListPage';

describe('Agunan - Daftar Agunan (/collateral)', () => {
  let fx;
  let T;

  before(() => {
    cy.fixture('agunan/agunan').then((d) => {
      fx = d;
      T = d.table;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', fx.dataUrl).as('colData');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openList = () => {
    ListPage.open(fx.path).assertUrl(fx.path).assertNotRedirectedToLogin();
    cy.wait('@colData').its('response.statusCode').should('eq', 200);
    ListPage.waitTable(T, fx.timeouts.table);
  };

  /** Jalankan fn(rows) bila ada data; bila kosong verifikasi empty-state (eksplisit). */
  const withRows = (fn) =>
    ListPage.dataRowEls(T).then((rows) => {
      if (!rows.length) {
        cy.log('Belum ada data agunan — skenario tidak dapat diuji, cek empty-state');
        ListPage.emptyState(T).should('be.visible');
        return;
      }
      fn(rows);
    });

  it('TC-AGN-LIST-001 | Happy | Menu Agunan membuka halaman Daftar Agunan', () => {
    ListPage.open(fx.home);
    ListPage.elements.sidebarMenu(fx.menuTitle).should('have.length', 1).click();
    cy.location('pathname').should('eq', fx.path);
    ListPage.assertBreadcrumb(fx.breadcrumb).assertDocumentTitle(fx.title);
    cy.wait('@colData').its('response.statusCode').should('eq', 200);
  });

  it('TC-AGN-LIST-002 | Positif | List agunan menampilkan kolom sesuai PRD (termasuk Atas Nama & Status)', () => {
    openList();
    ListPage.tableHeaders(T).should(($th) => {
      const actual = Cypress.$.makeArray($th).map((t) => t.innerText.replace(/\s+/g, ' ').trim().toLowerCase());
      fx.headersPrd
        .filter((h) => h !== 'Aksi')
        .forEach((h) => expect(actual, `kolom "${h}"`).to.include(h.toLowerCase()));
    });
  });

  it('TC-AGN-LIST-003 | Positif | Jenis Agunan & Harga Penilaian tampil dengan format benar', () => {
    openList();
    ListPage.assertEveryRowColumn(fx.col.jenis, (t) => fx.jenisLabels.includes(t), 'Jenis Agunan', T);
    ListPage.assertEveryRowColumn(fx.col.harga, (t) => /^IDR [\d.]+,\d{2}$/.test(t), 'Harga Penilaian', T);
    ListPage.assertEveryRowColumn(fx.col.dokumen, (t) => t.length > 0, 'Nomor Dokumen terisi', T);
  });

  it('TC-AGN-LIST-004 | Positif | Cari berdasarkan nama nasabah', () => {
    openList();
    withRows((rows) => {
      const name = cell(rows[0], fx.col.nasabah);
      ListPage.search(T, name, '@colData');
      ListPage.assertEveryRowColumn(fx.col.nasabah, (t) => t.toLowerCase().includes(name.toLowerCase()), 'Nasabah', T);
    });
  });

  it('TC-AGN-LIST-005 | Positif | Cari berdasarkan nomor CIF', () => {
    openList();
    withRows((rows) => {
      const cif = cell(rows[0], fx.col.cif);
      ListPage.search(T, cif, '@colData');
      ListPage.dataRows(T).should('have.length.greaterThan', 0);
      cy.get(`${T} tbody tr`).should(($r) => {
        const hit = Cypress.$.makeArray($r).some((tr) => cell(tr, fx.col.cif) === cif);
        expect(hit, `CIF ${cif} ada di hasil`).to.eq(true);
      });
    });
  });

  it('TC-AGN-LIST-006 | Positif | Cari berdasarkan nomor dokumen agunan', () => {
    openList();
    withRows((rows) => {
      const doc = cell(rows[0], fx.col.dokumen);
      ListPage.search(T, doc, '@colData');
      cy.get(`${T} tbody tr`).should(($r) => {
        const hit = Cypress.$.makeArray($r).some((tr) => cell(tr, fx.col.dokumen) === doc);
        expect(hit, `Nomor dokumen ${doc} ada di hasil`).to.eq(true);
      });
    });
  });

  it('TC-AGN-LIST-007 | Positif | Tersedia filter berdasarkan jenis agunan', () => {
    openList();
    cy.get('.page-content').then(($pc) => {
      const selects = Cypress.$.makeArray($pc.find('select')).filter((s) => {
        const txt = s.textContent;
        return fx.jenisLabels.some((j) => txt.includes(j.split('/')[0])) || /jenis/i.test(s.name + s.id);
      });
      expect(selects.length, 'dropdown filter Jenis Agunan').to.be.greaterThan(0);
    });
  });

  it('TC-AGN-LIST-008 | Positif | Tombol export CSV dan Excel tersedia', () => {
    openList();
    cy.get('.buttons-csv').should('exist');
    cy.get('.buttons-excel').should('exist');
  });

  it('TC-AGN-LIST-009 | Edge | Pencarian tanpa kecocokan menampilkan empty-state', () => {
    openList();
    ListPage.search(T, fx.searchNoMatch, '@colData');
    ListPage.emptyState(T).should('be.visible');
  });

  it('TC-AGN-LIST-010 | Positif | Tombol Lihat mengarah ke detail pinjaman tab Agunan', () => {
    openList();
    withRows(() => {
      cy.get(`${T} tbody tr`).should(($r) => {
        Cypress.$.makeArray($r)
          .filter((tr) => !Cypress.$(tr).find('td.dataTables_empty').length)
          .forEach((tr) => {
            const a = Cypress.$(tr).find('td').eq(fx.col.aksi).find('a');
            expect(a.text().trim()).to.eq(fx.viewButton);
            const u = new URL(a.attr('href'));
            expect(u.pathname).to.match(/^\/loan\/[^/]+$/);
            expect(u.searchParams.get('menu')).to.eq(fx.detail.menu);
          });
      });
    });
  });
});
