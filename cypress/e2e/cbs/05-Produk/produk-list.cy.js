/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Produk_List.json
// Read-only: semua test memasang cy.guardWrites() dan diakhiri cy.assertNoWritesLeaked().
import ProdukPage from '../../../support/pageobjects/Produk/ProdukPage';
import ProdukPinjamanPage from '../../../support/pageobjects/Produk/ProdukPinjamanPage';

describe('Produk - Daftar Produk', () => {
  let fx;

  before(() => {
    cy.fixture('produk/produk').then((d) => {
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

  describe('Halaman ringkasan produk (/product)', () => {
    it('TC-PRODUK-LIST-001 | Happy | Halaman Daftar Produk tampil dengan kartu Simpanan dan Pinjaman', () => {
      ProdukPage.openIndex(fx.paths.index).assertUrl(fx.paths.index).assertBreadcrumb(fx.index.breadcrumb);
      ProdukPage.elements.noteInfo().should('contain.text', fx.index.note);
      ProdukPage.elements.cardTitles().then(($s) => {
        const t = Cypress.$.makeArray($s).map((s) => s.innerText.trim());
        expect(t).to.include.members([fx.index.cardSaving, fx.index.cardLoan]);
      });
      ProdukPage.elements.btnTambahSimpanan().should('be.visible').and('contain.text', fx.index.btnSaving);
      ProdukPage.elements.btnTambahPinjaman().should('be.visible').and('contain.text', fx.index.btnLoan);
      ProdukPage.elements.cardDesc().should('contain.text', 'Produk Tersedia');
    });

    it('TC-PRODUK-LIST-002 | Positif | Menu sidebar Produk membuka halaman produk lalu tombol Pinjaman membuka list produk pinjaman', () => {
      ProdukPage.open('/home');
      ProdukPage.elements.sidebarMenu(fx.menu.sidebarTitle)
        .should('have.attr', 'href')
        .and('match', new RegExp(`${fx.menu.sidebarHref}$`));
      ProdukPage.elements.sidebarMenu(fx.menu.sidebarTitle).click();
      ProdukPage.assertUrl(fx.paths.index);
      ProdukPage.elements.btnTambahPinjaman().click();
      ProdukPage.assertUrl(fx.paths.loan).assertBreadcrumb(fx.loan.breadcrumb);
    });
  });

  describe('List produk pinjaman (/product/loan)', () => {
    beforeEach(() => {
      ProdukPinjamanPage.openLoan(fx.paths.loan);
    });

    it('TC-PRODUK-LIST-003 | Happy | Halaman produk pinjaman tampil dengan form tambah dan tabel daftar', () => {
      ProdukPinjamanPage.assertUrl(fx.paths.loan).assertBreadcrumb(fx.loan.breadcrumb);
      ProdukPinjamanPage.elements.portletCaptions().then(($c) => {
        const t = Cypress.$.makeArray($c).map((c) => c.innerText.trim().toUpperCase());
        expect(t).to.include.members([fx.loan.formCaption.toUpperCase(), fx.loan.listCaption.toUpperCase()]);
      });
      cy.get(fx.loan.table).should('be.visible');
    });

    it('TC-PRODUK-LIST-004 | Positif | Header kolom tabel produk pinjaman sesuai urutan', () => {
      ProdukPinjamanPage.assertHeaders(fx.loan.headers, fx.loan.table);
    });

    it('TC-PRODUK-LIST-005 | Positif | Kolom bunga menampilkan nilai beserta satuan periodenya', () => {
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        expect(list.length, 'precondition: minimal 1 produk pinjaman').to.be.greaterThan(0);
        const re = new RegExp(fx.loan.satuanPeriodeRegex, 'i');
        list.forEach((p) => {
          expect(re.test(p.bunga), `bunga "${p.bunga}" produk ${p.nama} memuat satuan periode`).to.eq(true);
        });
      });
    });

    it('TC-PRODUK-LIST-006 | Positif | Kolom Status hanya berisi Aktif atau Tidak Aktif', () => {
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        expect(list.length, 'precondition: minimal 1 produk pinjaman').to.be.greaterThan(0);
        list.forEach((p) => expect(fx.loan.statusLabels, `status produk ${p.nama}`).to.include(p.status));
      });
    });

    it('TC-PRODUK-LIST-007 | Positif | Kolom Simpanan Wajib ditampilkan Ya atau Tidak', () => {
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        expect(list.length, 'precondition: minimal 1 produk pinjaman').to.be.greaterThan(0);
        list.forEach((p) => {
          const head = p.simpananWajib.split(' ')[0];
          expect(fx.loan.yaTidak, `simpanan wajib produk ${p.nama}`).to.include(head);
          if (head === 'Tidak') {
            expect(p.simpananWajib, `produk ${p.nama} tanpa simpanan wajib cukup "Tidak"`).to.eq('Tidak');
          }
        });
      });
    });

    it('TC-PRODUK-LIST-008 | Positif | Jenis angsuran produk hanya Mingguan atau Bulanan', () => {
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        expect(list.length, 'precondition: minimal 1 produk pinjaman').to.be.greaterThan(0);
        list.forEach((p) => expect(fx.loan.angsuranPrd, `jenis angsuran produk ${p.nama}`).to.include(p.angsuran));
      });
    });

    it('TC-PRODUK-LIST-009 | Positif | Tidak ada lagi produk bernama Pinjaman Tempo', () => {
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        const old = list.filter((p) => p.nama.toLowerCase().includes(fx.loan.namaLama.toLowerCase()));
        expect(old.map((p) => p.nama), `produk bernama "${fx.loan.namaLama}"`).to.deep.eq([]);
      });
    });

    it('TC-PRODUK-LIST-010 | Positif | Setiap baris produk memiliki aksi Ubah (Edit)', () => {
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        expect(list.length, 'precondition: minimal 1 produk pinjaman').to.be.greaterThan(0);
        list.forEach((p) => expect(p.id, `tombol Edit (data-id) produk ${p.nama}`).to.be.a('string').and.not.be.empty);
      });
    });

    it('TC-PRODUK-LIST-011 | Edge | Pencarian dengan kata kunci yang tidak ada menampilkan list kosong', () => {
      ProdukPinjamanPage.tableSearch(fx.loan.table).clear().type(fx.testData.searchNoResult);
      ProdukPinjamanPage.emptyState(fx.loan.table).should('be.visible');
      ProdukPinjamanPage.dataRows(fx.loan.table).should('have.length', 0);
    });
  });

  describe('List produk simpanan (/product/saving)', () => {
    it('TC-PRODUK-LIST-012 | Happy | Halaman produk simpanan tampil dengan header kolom sesuai', () => {
      ProdukPage.openIndex(fx.paths.saving).assertUrl(fx.paths.saving).assertBreadcrumb(fx.saving.breadcrumb);
      ProdukPage.elements.savingCreateForm().should('exist');
      ProdukPage.assertHeaders(fx.saving.headers, fx.saving.table);
    });
  });
});
