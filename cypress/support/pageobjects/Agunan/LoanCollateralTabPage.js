// LoanCollateralTabPage — tab "Agunan" pada detail pinjaman /loan/{refId}?menu=collateral.
// View: resources/views/loan/detail/collateral.blade.php (+ document/new-collateral/*).
// Sub-tab (nav-pills, ?tab=): Dokumen (#tab_document), Surat Kuasa Menjual
// (#tab_sell_document), Surat Penyerahan (#tab_submission_document), Tanda Terima
// (#tab_receipt_document). Tombol "Print" memanggil printNewDocument() ->
// window.open('/loan/{refId}/collateral/print-new/?view=...&<param pihak>', '_blank').
// Test men-stub window.open (tidak membuka tab) lalu cy.request URL-nya.
import BasePage from '../BasePage';

class LoanCollateralTabPage extends BasePage {
  elements = {
    collateralPane: () => cy.get('#tab_collateral'),
    subTabLinks: () => cy.get('#tab_collateral ul.nav-pills > li > a'),
    subTabLink: (hash) => cy.get(`#tab_collateral ul.nav-pills a[href="${hash}"]`),
    subPane: (hash) => cy.get(`${hash}.tab-pane`),
    printButton: (hash) => cy.get(`${hash} a.print-btn`),
  };

  /** Pasang stub window.open SEBELUM halaman dimuat. */
  stubWindowOpen() {
    cy.on('window:before:load', (win) => {
      cy.stub(win, 'open').as('winOpen').returns({ focus: () => {} });
    });
    return this;
  }

  /** Pilih opsi pertama (bukan placeholder) dari <select> select2me lewat jQuery app. */
  pickFirstOption(sel) {
    return cy.get(`${sel} option`).then(($o) => {
      const opt = Cypress.$.makeArray($o).find((o, i) => i > 0);
      if (!opt) return cy.then(() => null);
      cy.window().then((win) => win.$(sel).val(opt.value).trigger('change'));
      return cy.then(() => opt.value);
    });
  }
}

export default new LoanCollateralTabPage();
