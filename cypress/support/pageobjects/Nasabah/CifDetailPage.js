// CifDetailPage — detail CIF (/cif/{code}).
//
// Sumber: resources/views/cif/detail.blade.php + partial cif/cif, cif/saving, cif/loan.
// - Tab pills: "Data CIF" (#tab_cif), "Simpanan" (#tab_saving), "Pinjaman" (#tab_loan).
// - Data CIF: input readonly per `.form-group` dengan <label> teks. ⚠️ Atribut `name`
//   di partial ini TIDAK unik (banyak yang name="address"), jadi field dicari via label.
// - "Kode CIF : <b>{code}</b>" di `.todo-username`.
// - Tombol "Edit Cif" (a[href=/cif/edit/{code}]) hanya dirender untuk role SELAIN
//   super-admin/auditor; "Download Cif" (a[href=/printCif/{code}], target=_blank) selalu.
// - Tab Simpanan: judul "DAFTAR REKENING SIMPANAN", tombol "BUAT REKENING BARU"
//   (data-target="#open_account") hanya bila user_office_id != 0. Modal #open_account:
//   select[name=product_id] + tombol "Batal" / "Oke" → POST /cif/{code}/saving.
// - Kode tidak ada → redirect ke /cif dengan flash error "Data CIF tidak ditemukan".

import BasePage from '../BasePage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const labelText = (el) => norm(Cypress.$(el).find('label').first().text()).replace(/\s*\*\s*$/, '');

class CifDetailPage extends BasePage {
  elements = {
    tabLinks: () => cy.get('ul.nav-pills a[data-toggle="tab"]'),
    tab: (label) => cy.get('ul.nav-pills a[data-toggle="tab"]').filter((i, el) => norm(el.innerText) === label),
    codeText: () => cy.get('#tab_cif .todo-username b'),
    dataPane: () => cy.get('#tab_cif'),
    savingPane: () => cy.get('#tab_saving'),
    loanPane: () => cy.get('#tab_loan'),
    fieldGroups: () => cy.get('#tab_cif .form-body .form-group'),
    field: (label) =>
      cy.get('#tab_cif .form-body .form-group').filter((i, el) => labelText(el) === label).find('input'),
    editBtn: () => cy.get('#tab_cif a[href*="/cif/edit/"]'),
    downloadBtn: () => cy.get('#tab_cif a[href*="/printCif/"]'),
    // Tab Simpanan + modal buka rekening
    savingItems: () => cy.get('#tab_saving .todo-tasklist-item'),
    openAccountBtn: () => cy.get('#tab_saving a[data-target="#open_account"]'),
    openModal: () => cy.get('#open_account'),
    productSelect: () => cy.get('#open_account select[name="product_id"]'),
    modalCancel: () => cy.get('#open_account .modal-footer button[data-dismiss="modal"]'),
    modalSubmit: () => cy.get('#open_account .modal-footer button[type="submit"]'),
  };

  visitDetail(code) {
    this.open(`/cif/${code}`);
    return this;
  }

  clickTab(label) {
    this.elements.tab(label).click();
    return this;
  }

  /** Daftar label field pada tab Data CIF (tanpa tanda *). */
  fieldLabels() {
    return this.elements.fieldGroups().then(($g) => Cypress.$.makeArray($g).map(labelText));
  }

  fieldValue(label) {
    return this.elements.field(label).invoke('val').then((v) => norm(v));
  }

  /** Tombol "BUAT REKENING BARU" → modal tampil. */
  openNewAccountModal() {
    this.clickTab('Simpanan');
    this.elements.openAccountBtn().should('be.visible').click();
    this.elements.openModal().should('be.visible');
    return this;
  }

  /** Pilih produk simpanan pertama yang aktif (bukan placeholder). Mengembalikan nama produk. */
  selectFirstProduct() {
    return this.elements.productSelect().find('option:not([disabled])').first().then(($o) => {
      expect($o.length, 'precondition: ada produk simpanan ACTIVE').to.eq(1);
      const value = $o.val();
      const text = norm($o.text());
      this.selectNative('#open_account select[name="product_id"]', value);
      return cy.then(() => text);
    });
  }
}

export default new CifDetailPage();
