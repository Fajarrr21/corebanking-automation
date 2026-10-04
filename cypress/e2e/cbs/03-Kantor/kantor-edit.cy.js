/// <reference types="cypress" />
// Kantor (/office) — modal Edit kantor. READ-ONLY: form TIDAK pernah disubmit.
// Submit = Office::renameTo pada kantor ASLI (ikut rename akun GL, anak kantor,
// saldo) → tidak boleh diuji di staging bersama; tidak ada kantor milik test
// (tidak ada fitur tambah kantor). Semua POST diblok cy.guardWrites.
// TC sheet: docs/test-cases/src/TC_Kantor_Edit.json
import KantorPage from '../../../support/pageobjects/Kantor/KantorPage';

describe('Kantor - Modal Edit Kantor (tanpa submit)', () => {
  let fx;
  let firstRow;

  before(() => {
    cy.fixture('kantor/kantor').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    KantorPage.openGuarded();
    KantorPage.assertSuperAdmin(fx.labels.superAdminMenu).waitLoaded();
    KantorPage.rowData().then((rows) => {
      firstRow = rows[0];
    });
    KantorPage.elements.editBtnInFirstRow().should('contain.text', fx.labels.editButton).click();
    KantorPage.elements.editModal().should('be.visible');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-KTR-EDIT-001 | Happy | Klik Edit membuka modal "Edit Tipe Kantor" dengan Nama Kantor terisi', () => {
    KantorPage.elements.editModal().find('.modal-title').first().should('have.text', fx.labels.editModalTitle);
    KantorPage.elements.officeNameInput().should('be.visible').and(($i) => {
      expect($i.val(), 'Nama Kantor terisi dari baris yang diklik').to.eq(firstRow[fx.columns.name]);
    });
  });

  it('TC-KTR-EDIT-002 | Positif | Pilihan Tipe Kantor = Wilayah / Cabang (tanpa istilah Unit)', () => {
    KantorPage.elements.officeRoleSelect().find('option').should(($o) => {
      const texts = Cypress.$.makeArray($o).map((o) => o.textContent.trim());
      expect(texts).to.deep.eq(fx.labels.tipeKantorOptions);
    });
  });

  it('TC-KTR-EDIT-003 | Positif | Modal Edit tidak menampilkan istilah Unit / kode role mentah', () => {
    KantorPage.elements.editModal().should(($m) => {
      const visible = $m[0].innerText;
      expect(visible, 'teks modal tanpa kode UNIT/BRANCH').not.to.match(new RegExp(fx.rawRolePattern));
      expect(visible, 'teks modal tanpa istilah Unit').not.to.match(new RegExp(fx.forbiddenTermPattern, 'i'));
    });
  });

  it('TC-KTR-EDIT-004 | Positif | Alamat Kantor dan Kepala Kantor tampil read-only terisi dari data kantor', () => {
    KantorPage.elements.officeAddressInput().should('be.visible').and('be.disabled').and(($i) => {
      expect($i.val()).to.eq(firstRow[3]);
    });
    KantorPage.elements.officePicInput().should('be.visible').and('be.disabled').and(($i) => {
      expect($i.val()).to.eq(firstRow[5]);
    });
  });

  it('TC-KTR-EDIT-005 | Negatif | Menutup modal tanpa Ubah tidak mengirim perubahan apa pun', () => {
    KantorPage.elements.editModal().find('.modal-header button.close').first().click();
    KantorPage.elements.editModal().should('not.be.visible');
    cy.blockedWrites().should('deep.eq', []);
    KantorPage.rowData().then((rows) => {
      expect(rows[0][fx.columns.name], 'nama kantor tidak berubah').to.eq(firstRow[fx.columns.name]);
    });
  });
});
