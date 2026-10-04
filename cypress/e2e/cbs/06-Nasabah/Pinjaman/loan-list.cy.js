/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_List.json
// Read-only: semua test memasang cy.guardWrites() dan diakhiri cy.assertNoWritesLeaked().
// ⚠️ Kolom aksi list (super-admin pusat) punya link GET /loan/delete2 yang MENGHAPUS pinjaman — tidak pernah diklik.
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describe('Nasabah - Pinjaman - Daftar Pinjaman', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Pinjaman aktif (/loan)', () => {
    beforeEach(() => {
      LoanListPage.openList(fx.paths.list, fx.paths.data, fx.list.table, fx.timeout.table);
    });

    it('TC-LOAN-LIST-001 | Happy | Halaman Daftar Pinjaman Aktif tampil dengan judul, breadcrumb, dan tabel', () => {
      LoanListPage.assertDocumentTitle(fx.list.title).assertBreadcrumb(fx.list.breadcrumb);
      cy.get(fx.list.table).should('be.visible');
      LoanListPage.tableInfo(fx.list.table).should('be.visible');
    });

    it('TC-LOAN-LIST-002 | Positif | Header kolom tabel pinjaman aktif sesuai urutan', () => {
      LoanListPage.assertHeaders(fx.list.headers, fx.list.table);
    });

    it('TC-LOAN-LIST-003 | Positif | Kartu ringkasan (NPL, pencairan, tunggakan, sisa pokok per kolektibilitas) tampil dengan nominal berformat ribuan', () => {
      fx.list.cards.forEach((c) => {
        LoanListPage.elements.card(c.id).should('exist').invoke('text').then((t) => {
          const v = t.replace(/\s+/g, '');
          if (c.id === 'npl') expect(v, `${c.label}`).to.match(/^-?\d+(\.\d+)?$/);
          else expect(v, `${c.label} berformat ribuan`).to.match(/^-?\d{1,3}(\.\d{3})*(,\d+)?$/);
        });
        cy.contains('.portlet span', c.label).should('exist');
      });
    });

    it('TC-LOAN-LIST-004 | Positif | Kolom Status hanya berisi Aktif dan Model Angsuran/Kolektibilitas berisi label baku', () => {
      LoanListPage.assertEveryRowColumn(fx.list.colStatus, (t) => t === fx.list.statusAktif, 'Status', fx.list.table);
      LoanListPage.assertEveryRowColumn(fx.list.colModel, (t) => fx.list.modelAngsuran.includes(t), 'Model Angsuran', fx.list.table);
      LoanListPage.assertEveryRowColumn(fx.list.colStatus + 1, (t) => fx.list.kolektibilitas.includes(t), 'Kolektibilitas', fx.list.table);
    });

    it('TC-LOAN-LIST-005 | Positif | Pilihan filter kolektibilitas lengkap', () => {
      LoanListPage.elements.filterStatus().find('option').then(($o) => {
        expect(Cypress.$.makeArray($o).map((o) => o.textContent.trim())).to.deep.eq(fx.list.statusOptions);
      });
      LoanListPage.elements.filterProduct().find('option').first().should('have.text', 'Semua Produk');
    });

    it('TC-LOAN-LIST-006 | Positif | Filter kolektibilitas Lancar memanggil ulang data dan hanya menampilkan pinjaman Lancar', () => {
      cy.intercept('GET', LoanListPage.dataRe(fx.paths.data)).as('filtered');
      LoanListPage.selectNative('#filter_status', 'CURRENT');
      cy.get('#filter_status').trigger('change', { force: true });
      cy.wait('@filtered', { timeout: fx.timeout.table }).then((i) => {
        expect(decodeURIComponent(i.request.url)).to.include(`columns[${fx.list.colStatus + 1}][search][value]=CURRENT`);
      });
      LoanListPage.waitTable(fx.list.table, fx.timeout.table);
      LoanListPage.assertEveryRowColumn(fx.list.colStatus + 1, (t) => t === 'Lancar', 'Kolektibilitas', fx.list.table);
    });

    it('TC-LOAN-LIST-007 | Positif | Tombol Lihat mengarah ke detail pinjaman dan detail dapat dibuka', () => {
      LoanListPage.dataRows(fx.list.table).should('have.length.greaterThan', 0, 'precondition: ada pinjaman aktif');
      LoanListPage.elements.rowViewLinks(fx.list.table).first()
        .should('have.attr', 'href')
        .and('match', /\/loan\/[^/?#]+$/)
        .then((href) => {
          const refId = new URL(href, Cypress.config('baseUrl')).pathname.split('/').pop();
          LoanDetailPage.openDetail(fx.paths.detail, refId);
          LoanDetailPage.assertBreadcrumb(fx.detail.breadcrumb).assertDocumentTitle(fx.detail.title);
        });
    });

    it('TC-LOAN-LIST-008 | Edge | Pencarian tanpa hasil menampilkan tabel kosong', () => {
      cy.intercept('GET', LoanListPage.dataRe(fx.paths.data)).as('searched');
      LoanListPage.tableSearch(fx.list.table).clear().type(fx.list.searchNoResult);
      cy.wait('@searched', { timeout: fx.timeout.table });
      LoanListPage.waitTable(fx.list.table, fx.timeout.table);
      LoanListPage.emptyState(fx.list.table).should('be.visible');
    });

    it('TC-LOAN-LIST-009 | Negatif | List pinjaman menampilkan kolom Officer Pengelola (PRD Pengajuan Pinjaman)', () => {
      // PRD Pengajuan Pinjaman (Officer Pengelola e): nama Officer Pengelola tampil pada list pinjaman.
      // Source: header hanya "Account Officer" (= created_user), field Officer Pengelola tidak ada → kandidat bug.
      LoanListPage.tableHeaders(fx.list.table).then(($th) => {
        const t = Cypress.$.makeArray($th).map((th) => th.innerText.trim());
        expect(t, 'header list pinjaman').to.include(fx.detail.officerPengelolaLabel);
      });
    });
  });

  describe('Pinjaman lunas (/loan/paid)', () => {
    it('TC-LOAN-LIST-010 | Happy | Halaman Daftar Pembiayaan Lunas tampil dengan filter tanggal default dan header kolom', () => {
      LoanListPage.openList(fx.paths.paid, fx.paths.dataPaid, fx.paid.table, fx.timeout.table);
      LoanListPage.assertDocumentTitle(fx.paid.title).assertBreadcrumb(fx.paid.breadcrumb);
      LoanListPage.assertHeaders(fx.paid.headers, fx.paid.table);
      LoanListPage.elements.dateFrom().invoke('val').then((d1) => {
        expect(d1).to.match(/^\d{4}-\d{2}-\d{2}$/);
        LoanListPage.elements.dateTo().should('have.value', d1);
      });
    });
  });

  describe('Daftar hitam (/loan/blacklist)', () => {
    it('TC-LOAN-LIST-011 | Happy | Halaman Daftar Hitam tampil dengan tab DH Aktif & DH Lunas beserta header kolom', () => {
      cy.intercept('GET', LoanListPage.dataRe(fx.paths.dataBlacklistPaid)).as('dhPaid');
      LoanListPage.openList(fx.paths.blacklist, fx.paths.dataBlacklistActive, fx.blacklist.tableActive, fx.timeout.table);
      LoanListPage.assertDocumentTitle(fx.blacklist.title).assertBreadcrumb(fx.blacklist.breadcrumb);
      LoanListPage.elements.tab(fx.blacklist.tabActive).should('be.visible');
      LoanListPage.elements.tab(fx.blacklist.tabPaid).should('be.visible');
      LoanListPage.assertHeaders(fx.blacklist.headers, fx.blacklist.tableActive);
      LoanListPage.elements.tab(fx.blacklist.tabPaid).click();
      cy.wait('@dhPaid', { timeout: fx.timeout.table }).its('response.statusCode').should('eq', 200);
      LoanListPage.waitTable(fx.blacklist.tablePaid, fx.timeout.table);
      LoanListPage.assertHeaders(fx.blacklist.headers, fx.blacklist.tablePaid);
    });
  });
});
