// LoanPlanPage — /loan-plan "Rencana Pinjaman" (LoanPlanController, tanpa cek role).
// View: resources/views/loanplan/index.blade.php
//   tabel #data-table-loan-plan (DataTables server-side GET /loan-plan/data)
//   NIK di-mask (span.nik-masked / span.nik-full + a.nik-toggle)
//   Aksi: Ajukan (/loan/create/{cif_code}) | "Belum bisa diajukan" (disabled);
//         status OPEN: Ubah (a.plan-edit -> modal #modal_edit_plan) + Batalkan
//         (GET /loan-plan/{id}/cancel dengan confirm()) — ⚠️ Batalkan = GET, tidak
//         terblok write-guard. Spec read-only TIDAK PERNAH mengklik Batalkan.
import BasePage from '../BasePage';

class LoanPlanPage extends BasePage {
  elements = {
    sidebarMenu: (title) =>
      cy
        .get('ul.page-sidebar-menu > li > a > span.title')
        .filter((_, el) => el.innerText.trim() === title),
    caption: () => cy.get('.portlet-title .caption-subject'),
    captionHelper: () => cy.get('.portlet-title .caption-helper'),
    modal: () => cy.get('#modal_edit_plan'),
    modalTitle: () => cy.get('#modal_edit_plan .modal-title'),
    modalName: () => cy.get('#edit_plan_name'),
    modalNik: () => cy.get('#edit_plan_nik'),
    modalCode: () => cy.get('#edit_plan_code'),
    modalOffice: () => cy.get('#edit_plan_office'),
    modalProduct: () => cy.get('#edit_plan_product'),
    modalAmount: () => cy.get('#edit_plan_amount'),
    modalTenor: () => cy.get('#edit_plan_tenor'),
    modalSave: () => cy.get('#form_edit_plan button[type="submit"]'),
    modalCancel: () => cy.get('#form_edit_plan button[data-dismiss="modal"]'),
  };

  /** Teks sel (trim) kolom col pada baris tr. */
  static cell(tr, col) {
    return Cypress.$(tr).find('td').eq(col).text().replace(/\s+/g, ' ').trim();
  }

  /** Baris data (array elemen) memenuhi predicate — tanpa empty-state. */
  rowsWhere(tableSel, pred) {
    return cy.get(`${tableSel} tbody tr`).then(($tr) =>
      Cypress.$.makeArray($tr).filter((tr) => !Cypress.$(tr).find('td.dataTables_empty').length && pred(tr)),
    );
  }

  /** Buka modal Ubah dari baris tr (tidak submit). */
  openEdit(tr) {
    cy.wrap(tr).find('a.plan-edit').click();
    this.elements.modal().should('be.visible');
    return this;
  }
}

export const cell = LoanPlanPage.cell;
export default new LoanPlanPage();
