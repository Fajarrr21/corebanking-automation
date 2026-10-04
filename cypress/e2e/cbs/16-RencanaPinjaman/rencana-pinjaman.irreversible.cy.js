// Rencana Pinjaman — UBAH (dengan restore) & BATALKAN (tidak bisa dikembalikan) rencana MILIK TEST.
// TC sumber: docs/test-cases/src/TC_RencanaPinjaman_Ubah.json
// Default TIDAK jalan: --env allowLoanPlanChange=true.
// Hanya menyentuh baris yang kolom Nasabah diawali "QA" (column-scoped). Rencana dibuat app
// dari modal Penyesuaian Pinjaman (LoanController@adjustmentApproval) — test TIDAK membuatnya;
// precondition: minimal 1 rencana OPEN milik nasabah QA. Tidak ada -> gagal dengan pesan jelas.
import LoginPage from '../../../support/pageobjects/LoginPage';
import LoanPlanPage, { cell } from '../../../support/pageobjects/RencanaPinjaman/LoanPlanPage';
import { describeIfFlag } from '../../../support/utils/flags';

describeIfFlag('allowLoanPlanChange', 'Rencana Pinjaman - Ubah & Batalkan (irreversible)', () => {
  let fx;
  let T;
  let restore = null; // { id, product, amount, tenor } untuk dikembalikan setelah TC Ubah

  before(() => {
    cy.fixture('rencanapinjaman/rencana-pinjaman').then((d) => {
      fx = d;
      T = d.table;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.intercept('GET', fx.dataUrl).as('planData');
  });

  afterEach(() => {
    // Restore nilai asli rencana QA yang diubah (tetap jalan walau test gagal).
    if (!restore) return;
    const r = restore;
    restore = null;
    LoanPlanPage.open(fx.path);
    cy.wait('@planData');
    LoanPlanPage.waitTable(T, fx.timeouts.table);
    LoanPlanPage.tableSearch(T).type(fx.qaPrefix);
    cy.wait('@planData');
    LoanPlanPage.rowsWhere(T, (tr) => cell(tr, fx.col.id) === r.id).then((rows) => {
      if (!rows.length) return;
      LoanPlanPage.openEdit(rows[0]);
      LoanPlanPage.elements.modalProduct().select(String(r.product));
      LoanPlanPage.elements.modalAmount().clear().type(String(Math.round(r.amount)));
      LoanPlanPage.elements.modalTenor().clear().type(String(r.tenor));
      LoanPlanPage.elements.modalSave().click();
      LoanPlanPage.assertSuccess(fx.messages.updated);
    });
  });

  /** Cari rencana OPEN milik nasabah QA; gagal jelas bila tidak ada. */
  const findQaOpenPlan = () => {
    LoanPlanPage.open(fx.path);
    cy.wait('@planData');
    LoanPlanPage.waitTable(T, fx.timeouts.table);
    LoanPlanPage.tableSearch(T).type(fx.qaPrefix);
    cy.wait('@planData');
    LoanPlanPage.waitTable(T, fx.timeouts.table);
    return LoanPlanPage.rowsWhere(
      T,
      (tr) => cell(tr, fx.col.nasabah).startsWith(fx.qaPrefix) && cell(tr, fx.col.status) === fx.status.open,
    ).then((rows) => {
      if (!rows.length) {
        throw new Error('Precondition: tidak ada rencana pinjaman OPEN milik nasabah "QA..." — buat lewat Penyesuaian Pinjaman nasabah QA dulu');
      }
      return cy.then(() => rows[0]);
    });
  };

  it('TC-RPJ-UBAH-001 | Happy | Ubah Jangka Waktu rencana QA tersimpan (lalu dikembalikan)', () => {
    findQaOpenPlan().then((tr) => {
      const btn = Cypress.$(tr).find('a.plan-edit');
      const id = cell(tr, fx.col.id);
      restore = { id, product: btn.data('product'), amount: Number(btn.data('amount')), tenor: Number(btn.data('tenor')) };
      const newTenor = restore.tenor + fx.editDelta.tenorAdd;
      LoanPlanPage.openEdit(tr);
      LoanPlanPage.elements.modalTenor().clear().type(String(newTenor));
      LoanPlanPage.elements.modalSave().click();
      LoanPlanPage.assertSuccess(fx.messages.updated);
      cy.wait('@planData');
      LoanPlanPage.waitTable(T, fx.timeouts.table);
      LoanPlanPage.tableSearch(T).type(fx.qaPrefix);
      cy.wait('@planData');
      cy.get(`${T} tbody tr`).should(($r) => {
        const row = Cypress.$.makeArray($r).find((x) => cell(x, fx.col.id) === id);
        expect(row, `rencana ${id} masih tampil`).to.not.eq(undefined);
        expect(cell(row, fx.col.tenor)).to.eq(String(newTenor));
      });
    });
  });

  it('TC-RPJ-UBAH-002 | Positif | Batalkan rencana QA (konfirmasi OK) mengubah status menjadi Dibatalkan', () => {
    findQaOpenPlan().then((tr) => {
      const id = cell(tr, fx.col.id);
      const confirmStub = cy.stub().returns(true).as('confirm');
      cy.on('window:confirm', confirmStub);
      cy.wrap(tr).find('a[href*="/cancel"]').click();
      cy.get('@confirm').should('have.been.calledWith', fx.messages.confirmCancel);
      LoanPlanPage.assertSuccess(fx.messages.cancelled);
      cy.wait('@planData');
      LoanPlanPage.waitTable(T, fx.timeouts.table);
      LoanPlanPage.tableSearch(T).type(fx.qaPrefix);
      cy.wait('@planData');
      cy.get(`${T} tbody tr`).should(($r) => {
        const row = Cypress.$.makeArray($r).find((x) => cell(x, fx.col.id) === id);
        expect(row, `rencana ${id} masih tampil`).to.not.eq(undefined);
        expect(cell(row, fx.col.status)).to.eq(fx.status.cancelled);
        expect(Cypress.$(row).find('a.plan-edit').length, 'tombol Ubah hilang').to.eq(0);
      });
    });
  });
});
