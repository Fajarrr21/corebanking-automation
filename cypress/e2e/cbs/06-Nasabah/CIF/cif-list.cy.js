// CIF Nasabah — list /cif (read-only).
// TC sumber: docs/test-cases/src/TC_CIF_List.json
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

describe('Nasabah - CIF - List CIF (/cif)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tampilan halaman', () => {
    it('TC-CIF-LIST-001 | Happy | Halaman list CIF terbuka dan tabel termuat dari /cif/data', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.assertUrl(fx.paths.list).assertNotRedirectedToLogin().assertBreadcrumb(fx.breadcrumb.list);
      cy.get('@cifData').its('response.statusCode').should('eq', 200);
    });

    it('TC-CIF-LIST-002 | Positif | Header kolom tabel CIF sesuai', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.assertHeaders(fx.list.headers, CifListPage.table);
    });

    it('TC-CIF-LIST-003 | Positif | Setiap baris punya aksi Lihat menuju detail CIF', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.dataRows(CifListPage.table).should('have.length.greaterThan', 0);
      cy.get(`${CifListPage.table} tbody tr`).should(($rows) => {
        const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
        data.forEach((r) => {
          const $r = Cypress.$(r);
          const code = norm($r.find('td').eq(fx.list.col.code).text());
          const $a = $r.find('td').eq(0).find('a');
          expect(norm($a.text()), 'label aksi').to.eq(fx.list.viewLabel);
          expect($a.attr('href'), `href Lihat untuk ${code}`).to.match(new RegExp(`/cif/${code}$`));
        });
      });
    });

    it('TC-CIF-LIST-004 | Positif | Tombol Buat CIF tampil untuk user cabang', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.isUserPusat().then((pusat) => {
        if (pusat) {
          throw new Error(
            'Precondition tidak terpenuhi: akun test = user pusat (office_id 0) — source menyembunyikan tombol "Buat CIF" untuk user pusat. Butuh akun cabang.',
          );
        }
      });
      CifListPage.elements.createBtn().should('be.visible').and('contain.text', fx.list.createLabel);
    });

    it('TC-CIF-LIST-005 | Positif | Tombol export CSV dan Excel tersedia', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.elements.exportCsv().should('be.visible');
      CifListPage.elements.exportExcel().should('be.visible');
    });
  });

  describe('Pencarian & filter', () => {
    it('TC-CIF-LIST-006 | Positif | Pencarian berdasarkan nama menampilkan baris yang sesuai', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.firstRowData(fx.list.col).then((row) => {
        CifListPage.search(row.name, fx.timeout);
        CifListPage.dataRows(CifListPage.table).should('have.length.greaterThan', 0);
        cy.get(`${CifListPage.table} tbody tr`).should(($rows) => {
          const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
          const hit = data.some((r) => norm(Cypress.$(r).find('td').eq(fx.list.col.code).text()) === row.code);
          expect(hit, `CIF ${row.code} ada di hasil pencarian "${row.name}"`).to.eq(true);
        });
      });
    });

    it('TC-CIF-LIST-007 | Negatif | Pencarian kata kunci yang tidak ada menampilkan tabel kosong', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.search(fx.list.notFoundKeyword, fx.timeout);
      CifListPage.emptyState(CifListPage.table).should('be.visible');
      CifListPage.dataRows(CifListPage.table).should('have.length', 0);
    });

    it('TC-CIF-LIST-008 | Positif | Filter cabang (user pusat) hanya menampilkan CIF cabang terpilih', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.isUserPusat().then((pusat) => {
        if (!pusat) {
          throw new Error('Precondition tidak terpenuhi: filter cabang hanya dirender untuk user pusat (office_id 0). Butuh akun pusat.');
        }
      });
      CifListPage.firstRowData(fx.list.col).then((row) => {
        CifListPage.filterOffice(row.office, fx.timeout);
        CifListPage.dataRows(CifListPage.table).should('have.length.greaterThan', 0);
        CifListPage.assertEveryRowColumn(
          fx.list.col.office,
          (t) => t.includes(row.office),
          `Kantor Cabang = ${row.office}`,
          CifListPage.table,
        );
      });
    });

    it('TC-CIF-LIST-009 | Edge | Jumlah baris per halaman default tidak melebihi 10', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.dataRows(CifListPage.table).its('length').should('be.lte', fx.list.pageLength);
      cy.get('@cifData').its('request.url').should('include', `length=${fx.list.pageLength}`);
    });
  });
});
