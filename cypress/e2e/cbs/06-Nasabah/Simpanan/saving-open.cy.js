// Simpanan Nasabah — Buka Rekening Simpanan dari detail CIF (tab Simpanan → modal).
// Spec ini TIDAK membuat rekening. Pembukaan sungguhan: saving-open.irreversible.cy.js.
// TC sumber: docs/test-cases/src/TC_Simpanan_Buka.json
//
// TC-SMP-BUKA-003 mengirim POST /cif/{code}/saving TANPA product_id → pasti ditolak
// CreateSavingRequest (product_id required) sehingga tidak ada rekening tercipta.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifDetailPage from '../../../../support/pageobjects/Nasabah/CifDetailPage';

describe('Nasabah - Simpanan - Buka Rekening dari Detail CIF', () => {
  let cfx;
  let sfx;
  let cif;

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      cfx = d;
    });
    cy.fixture('nasabah/saving').then((d) => {
      sfx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    CifListPage.visitList(cfx.paths.list, cfx.timeout);
    CifListPage.isUserPusat().then((pusat) => {
      if (pusat) {
        throw new Error('Precondition tidak terpenuhi: akun test = user pusat (office_id 0) — tombol "BUAT REKENING BARU" hanya untuk user cabang.');
      }
    });
    CifListPage.firstRowData(cfx.list.col).then((row) => {
      cif = row;
    });
  });

  it('TC-SMP-BUKA-001 | Positif | Tombol BUAT REKENING BARU tampil di tab Simpanan detail CIF', () => {
    cy.guardWrites();
    CifDetailPage.visitDetail(cif.code);
    CifDetailPage.clickTab('Simpanan');
    CifDetailPage.elements.openAccountBtn().should('be.visible').and(($b) => {
      expect($b.text().replace(/\s+/g, ' ').trim()).to.eq(sfx.open.buttonLabel);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-SMP-BUKA-002 | Positif | Modal Buka Rekening Baru menampilkan pilihan produk simpanan', () => {
    cy.guardWrites();
    CifDetailPage.visitDetail(cif.code);
    CifDetailPage.openNewAccountModal();
    CifDetailPage.elements.openModal().find('.modal-title').should('have.text', sfx.open.modalTitle);
    CifDetailPage.elements.productSelect().find('option[disabled]').should('contain.text', sfx.open.productPlaceholder);
    CifDetailPage.elements.productSelect().find('option:not([disabled])').should('have.length.greaterThan', 0);
    CifDetailPage.elements.modalCancel().should('contain.text', sfx.open.cancelLabel);
    CifDetailPage.elements.modalSubmit().should('contain.text', sfx.open.submitLabel);
    cy.assertNoWritesLeaked();
  });

  it('TC-SMP-BUKA-003 | Negatif | Oke tanpa memilih produk ditolak dan tidak membuat rekening', () => {
    cy.guardWrites({ allow: [/^\/cif\/[^/]+\/saving$/] });
    CifDetailPage.visitDetail(cif.code);
    CifDetailPage.clickTab('Simpanan');
    CifDetailPage.elements.savingPane().then(($p) => {
      const before = $p.find('.todo-tasklist-item').length;
      CifDetailPage.openNewAccountModal();
      CifDetailPage.elements.modalSubmit().click();
      cy.location('pathname', { timeout: sfx.timeout }).should('eq', `${cfx.paths.detail}${cif.code}`);
      CifDetailPage.common.alertDanger().should('be.visible');
      CifDetailPage.common.alertSuccess().should('not.exist');
      CifDetailPage.elements.savingPane().find('.todo-tasklist-item').should('have.length', before);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-SMP-BUKA-004 | Positif | Tombol Batal menutup modal tanpa mengirim data', () => {
    cy.guardWrites();
    CifDetailPage.visitDetail(cif.code);
    CifDetailPage.openNewAccountModal();
    CifDetailPage.elements.modalCancel().click();
    CifDetailPage.elements.openModal().should('not.be.visible');
    cy.blockedWrites().should('deep.eq', []);
    cy.assertNoWritesLeaked();
  });
});
