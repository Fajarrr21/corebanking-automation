// CekNasabahPage — halaman Cek Nasabah (/check).
//
// Source develop: CustomerController@check (GET /check?data=<keyword>) dan
// @checkPost (POST /check → validasi CheckCustomerRequest → redirect ke
// GET /check?data=<keyword>). POST /check TIDAK menulis data (hanya redirect),
// jadi spec meng-allow path ini di cy.guardWrites.
//
// Pencarian (buildSummary): nik = kw OR code = kw OR card_no = kw; kalau tidak
// ketemu, dicoba sebagai accounts.account_number → CIF pemiliknya, dan baris
// rekening itu diberi class .cek-row-match.
//
// Data uji diambil dinamis dari endpoint DataTables (GET, read-only):
//   /cif/data    → kode CIF + NIK + nama
//   /saving/data → nomor rekening simpanan + cif pemiliknya

import BasePage from '../BasePage';
import LoginPage from '../LoginPage';

class CekNasabahPage extends BasePage {
  path = '/check';

  elements = {
    form: () => cy.get('#formCekNasabah'),
    keywordInput: () => cy.get('#formCekNasabah input[name="data"]'),
    helpText: () => cy.get('#formCekNasabah .help-block'),
    submitBtn: () => cy.get('#btnCekNasabah'),
    infoNote: () => cy.get('.page-content .note.note-info'),
    notFoundNote: () => cy.get('.page-content .note.note-danger'),
    cifName: () => cy.get('.cek-head h3'),
    officeTag: () => cy.get('.cek-head .cek-tag.tag-office'),
    metaValue: (label) => cy.contains('.cek-meta dt', new RegExp(`^\\s*${label}\\s*$`)).next('dd'),
    openCifDetailBtn: (text) => cy.contains('a.btn', text),
    savingTable: () => cy.get('#tblSaving'),
    loanTable: () => cy.get('#tblLoan'),
    savingRows: () => cy.get('#tblSaving tbody tr'),
    loanRows: () => cy.get('#tblLoan tbody tr'),
    captionHelper: (caption) =>
      cy.contains('.portlet-title .caption-subject', caption).siblings('.caption-helper'),
    portletActions: (caption) =>
      cy.contains('.portlet-title .caption-subject', caption).closest('.portlet-title'),
    matchedRows: () => cy.get('tr.cek-row-match'),
    headerUser: () => cy.get('.top-menu .dropdown-user .username'),
  };

  /** Login → guard tulis (POST /check di-allow) → visit. */
  openGuarded(allowRe, query = '') {
    LoginPage.loginViaSession();
    cy.guardWrites({ allow: [new RegExp(allowRe)] });
    cy.visit(`${this.path}${query}`);
    return this;
  }

  search(keyword) {
    this.elements.keywordInput().clear();
    if (keyword !== '') this.elements.keywordInput().type(keyword, { delay: 0 });
    this.elements.submitBtn().click();
    return this;
  }

  /** Ambil daftar CIF (GET /cif/data, DataTables server-side). Yield array baris. */
  fetchCifs(url, timeout) {
    return cy
      .request({ url, headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }, timeout })
      .then((res) => {
        expect(res.status, 'GET /cif/data').to.eq(200);
        expect(res.body.data, 'data CIF').to.be.an('array');
        return cy.then(() => res.body.data);
      });
  }

  /** Ambil rekening simpanan bersaldo (GET /saving/data). Yield array baris. */
  fetchSavings(url, timeout) {
    return cy
      .request({ url, headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }, timeout })
      .then((res) => {
        expect(res.status, 'GET /saving/data').to.eq(200);
        expect(res.body.data, 'data simpanan').to.be.an('array');
        return cy.then(() => res.body.data);
      });
  }

  /** Ringkasan nasabah tampil untuk CIF dengan kode tertentu. */
  assertSummaryFor(cif) {
    this.elements.cifName().should('be.visible').and(($h) => {
      expect($h.text().trim(), 'nama nasabah').to.eq(String(cif.name).trim());
    });
    this.elements.metaValue('Kode CIF').should(($dd) => {
      expect($dd.text().trim(), 'Kode CIF').to.eq(String(cif.code).trim());
    });
    return this;
  }
}

export default new CekNasabahPage();
