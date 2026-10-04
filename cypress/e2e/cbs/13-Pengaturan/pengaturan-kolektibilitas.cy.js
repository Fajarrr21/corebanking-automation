/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_Kolektibilitas.json
// READ-ONLY. Simpan kolektibilitas = upsert berdasarkan (nama, produk) → menimpa aturan kolektibilitas
// NYATA yang dipakai klasifikasi pinjaman; simpan "Pinjaman melewati jatuh tempo" juga global.
// Tidak ada submit sungguhan di spec ini (guardWrites memblokir semua POST).
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Kolektibilitas (read-only)', () => {
  let fx;
  const DUE = '/setting/collectibility/loanduedate';
  const COL = '/setting/collectibility';

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    cy.guardWrites();
    PengaturanPage.openSetting('collectibility');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-SET-KOL-001 | Happy | Form jatuh tempo, form kolektibilitas, dan tabel kolektibilitas tampil lengkap', () => {
    PengaturanPage.elements.field(DUE, 'loan_due_date').find('option:not([disabled])').then(($o) => {
      const map = {};
      Cypress.$.makeArray($o).forEach((o) => {
        map[o.value] = o.textContent.replace(/\s+/g, ' ').trim();
      });
      expect(map).to.deep.eq(fx.collectibility.dueDateOptions);
    });
    ['product_collectibilties', 'collectibility_type', 'name', ...fx.collectibility.requiredInputs]
      .forEach((n) => PengaturanPage.elements.field(COL, n).should('exist'));
    PengaturanPage.assertHeaders(fx.collectibility.headers, fx.collectibility.table);
  });

  it('TC-SET-KOL-002 | Positif | Pilihan Otomatis Diragukan menampilkan field Otomatis Macet, pilihan lain menyembunyikannya', () => {
    PengaturanPage.elements.field(DUE, 'loan_due_date').select('DOUBTFUL');
    cy.get('#automatic_bad_form').should('be.visible');
    PengaturanPage.elements.field(DUE, 'loan_due_date').select('MANUAL');
    cy.get('#automatic_bad_form').should('not.be.visible');
  });

  it('TC-SET-KOL-003 | Positif | Produk Anuitas mengunci Tipe Kolektibilitas ke Pokok, Bunga dan atau Simpanan', () => {
    PengaturanPage.elements.field(COL, 'product_collectibilties').find('option').then(($o) => {
      const opts = Cypress.$.makeArray($o).filter((o) => o.value !== '0');
      const anuitas = opts.find((o) => o.textContent.includes('Anuitas'));
      const flat = opts.find((o) => o.textContent.includes('Flat'));
      expect(anuitas || flat, 'precondition: ada produk pinjaman aktif di pilihan').to.exist;
      if (anuitas) {
        PengaturanPage.elements.field(COL, 'product_collectibilties').select(anuitas.value);
        PengaturanPage.elements.field(COL, 'collectibility_type')
          .should('have.value', fx.collectibility.typeLocked)
          .and('be.disabled');
      } else {
        cy.log('Tidak ada produk Anuitas aktif — hanya diverifikasi produk Flat tidak mengunci tipe');
      }
      if (flat) {
        PengaturanPage.elements.field(COL, 'product_collectibilties').select(flat.value);
        PengaturanPage.elements.field(COL, 'collectibility_type').should('not.be.disabled');
      }
    });
  });

  it('TC-SET-KOL-004 | Negatif | Tambah kolektibilitas dengan field angka kosong — form tidak terkirim', () => {
    fx.collectibility.requiredInputs.forEach((n) => PengaturanPage.elements.field(COL, n).clear());
    PengaturanPage.elements.form(COL).find('button[type="submit"]').click();
    PengaturanPage.firstInvalidName(COL).should('eq', fx.collectibility.requiredInputs[0]);
    cy.blockedWrites().should('deep.eq', []);
  });

  it('TC-SET-KOL-005 | Positif | Kolom Kolektibilitas hanya berisi 5 label kolektibilitas baku', () => {
    PengaturanPage.allRows(fx.collectibility.table).then((rows) => {
      if (!rows.length) {
        cy.log('Belum ada aturan kolektibilitas — empty-state');
        PengaturanPage.emptyState(fx.collectibility.table).should('exist');
        return;
      }
      rows.forEach((r) => expect(fx.collectibility.names, `kolektibilitas "${r[1]}"`).to.include(r[1]));
    });
  });

  it('TC-SET-KOL-006 | Negatif | Batal hapus kolektibilitas (Close) tidak mengirim request', () => {
    PengaturanPage.allRows(fx.collectibility.table).then((rows) => {
      expect(rows.length, 'precondition: minimal 1 aturan kolektibilitas').to.be.greaterThan(0);
    });
    cy.get(`${fx.collectibility.table} tbody button[data-target="${fx.collectibility.deleteModal}"]`).first().click();
    cy.get(fx.collectibility.deleteModal).should('be.visible');
    cy.get(`${fx.collectibility.deleteModal} button[data-dismiss="modal"]`).contains('Close').click();
    cy.get(fx.collectibility.deleteModal).should('not.be.visible');
    cy.blockedWrites().should('deep.eq', []);
  });
});
