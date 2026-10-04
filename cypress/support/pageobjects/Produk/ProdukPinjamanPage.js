// ProdukPinjamanPage — /product/loan (form "Tambah Pinjaman" + tabel "Daftar Produk Pinjaman" + modal Edit).
//
// Sumber markup (origin/develop): resources/views/product/loan.blade.php
//   form tambah : <form action="{{route('product.loan.create')}}" method="POST">  → POST /product/loan
//                 field: name, code, installment_type(MONTHLY|WEEKLY|ONE_TIME), interest_rates,
//                 interest_type(FLAT|ANNUITY), collateral(YES|NO), need_saving(NO|YES) → #depositRate
//                 (saving_percent), online(NO|YES), descriptions (textarea#descriptions → CKEditor).
//   tabel       : table#sample_1 (DataTables client-side via table-datatables-managed.min.js).
//   tombol Edit : <a data-target="#edit" id="getLoanId" data-...> (id DUPLIKAT per baris → pakai data-target).
//   modal edit  : #edit, <form action="{{route('product.loan.edit')}}"> → POST /product/loan/edit
//                 field: id, name, code, installment_type(#installment_model), interest_rate,
//                 interest_count(#interest_count, HANYA opsi FLAT), collateral, need_saving(#needsaving),
//                 saving_percent, status, online, descriptions(#descriptions_edit → CKEditor).
// Validasi server tambah: CreateProductLoanRequest (name unique, code 2 char unique, interest_rates min:0).
// Validasi server edit  : TIDAK ADA (ProductController::loanEdit memakai Request polos).

import BasePage from '../BasePage';
import ProdukPage from './ProdukPage';

class ProdukPinjamanPage extends BasePage {
  table = '#sample_1';

  elements = {
    createForm: () => cy.get('form[action$="/product/loan"]'),
    createField: (name) => cy.get(`form[action$="/product/loan"] [name="${name}"]`),
    createSubmit: () => cy.get('form[action$="/product/loan"] button[type="submit"]'),
    savingPercentGroup: () => cy.get('#depositRate'),
    editButtons: () => cy.get(`${this.table} tbody a[data-target="#edit"]`),
    editModal: () => cy.get('#edit'),
    editForm: () => cy.get('#edit form[action$="/product/loan/edit"]'),
    editField: (name) => cy.get(`#edit form[action$="/product/loan/edit"] [name="${name}"]`),
    editSubmit: () => cy.get('#edit form button[type="submit"]'),
    editClose: () => cy.get('#edit .modal-footer button[data-dismiss="modal"]'),
    portletCaptions: () => cy.get('.portlet-title .caption-subject'),
  };

  openLoan(path) {
    this.open(path);
    this.assertNotRedirectedToLogin();
    this.waitClientTable();
    return this;
  }

  /** DataTables client-side: tunggu tbody terisi (baris data / empty-state). */
  waitClientTable(timeout = 30000) {
    cy.get(`${this.table} tbody`, { timeout }).should(($tb) => {
      expect($tb.find('tr').length, 'tbody punya baris').to.be.greaterThan(0);
    });
    return this;
  }

  search(text) {
    cy.get('body').then(($b) => {
      const sel = `${this.table}_filter input`;
      if ($b.find(sel).length) cy.get(sel).clear().type(text);
    });
    return this;
  }

  /** Semua baris data (lintas halaman DataTables) sebagai objek {nama, kode, status, ...}. */
  allProducts(col) {
    return cy.window().then((win) => {
      const $ = win.jQuery;
      const rows = $ && $.fn && $.fn.dataTable && $.fn.dataTable.isDataTable(this.table)
        ? $(this.table).DataTable().rows().nodes().toArray()
        : Cypress.$(`${this.table} tbody tr`).toArray();
      const cell = (r, i) => Cypress.$(r).find('td').eq(i).text().replace(/\s+/g, ' ').trim();
      const list = rows
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .map((r) => {
          const btn = Cypress.$(r).find('a[data-target="#edit"]');
          return {
            id: btn.attr('data-id'),
            nama: cell(r, col.nama),
            kode: cell(r, col.kode),
            status: cell(r, col.status),
            angsuran: cell(r, col.angsuran),
            bunga: cell(r, col.bunga),
            metode: cell(r, col.metode),
            agunan: cell(r, col.agunan),
            simpananWajib: cell(r, col.simpananWajib),
            online: cell(r, col.online),
            data: {
              agunan: btn.attr('data-agunan'),
              simpananWajib: btn.attr('data-simpanan-wajib'),
              online: btn.attr('data-online'),
              angsuran: btn.attr('data-model-angsuran'),
              metode: btn.attr('data-perhitungan-bunga'),
              bunga: btn.attr('data-suku-bunga'),
            },
          };
        });
      return cy.then(() => list);
    });
  }

  /** Kode 2 digit yang belum dipakai produk mana pun (pakai rentang 99 → 10 agar tidak bentrok kode bisnis rendah). */
  unusedCode(products) {
    const used = new Set(products.map((p) => p.kode));
    for (let n = 99; n >= 10; n -= 1) {
      const c = String(n);
      if (!used.has(c)) return c;
    }
    throw new Error('Semua kode 2 digit 10-99 sudah terpakai — tidak bisa membuat produk QA.');
  }

  /** Buka modal edit untuk produk dengan data-id tertentu (cari dulu lewat search box). */
  openEditById(id, nama) {
    if (nama) this.search(nama);
    cy.get(`${this.table} tbody a[data-target="#edit"][data-id="${id}"]`).first().click();
    this.elements.editModal().should('be.visible');
    return this;
  }

  closeEdit() {
    this.elements.editClose().click();
    this.elements.editModal().should('not.be.visible');
    return this;
  }

  /** Isi deskripsi: CKEditor bila ada (sinkron ke textarea), fallback textarea biasa. */
  setCkeditor(textareaId, text) {
    cy.window().then((win) => {
      const inst = win.CKEDITOR && win.CKEDITOR.instances && win.CKEDITOR.instances[textareaId];
      if (inst) {
        inst.setData(text);
        inst.updateElement();
      }
      win.document.getElementById(textareaId).value = text;
    });
    return this;
  }

  fillCreate(d) {
    const f = this.elements.createField;
    if (d.name !== undefined) f('name').clear().type(d.name);
    if (d.code !== undefined) f('code').clear().type(d.code);
    if (d.installment_type) f('installment_type').select(d.installment_type);
    if (d.interest_rates !== undefined) f('interest_rates').clear().type(d.interest_rates);
    if (d.interest_type) f('interest_type').select(d.interest_type);
    if (d.collateral) f('collateral').select(d.collateral);
    if (d.need_saving) f('need_saving').select(d.need_saving);
    if (d.saving_percent !== undefined) f('saving_percent').clear().type(d.saving_percent);
    if (d.online) f('online').select(d.online);
    if (d.descriptions !== undefined) this.setCkeditor('descriptions', d.descriptions);
    return this;
  }

  /** Submit form tambah MELEWATI validasi HTML5 (untuk menguji validasi SERVER). */
  submitCreateBypassHtml5() {
    this.elements.createForm().then(($f) => {
      $f[0].noValidate = true;
    });
    this.elements.createSubmit().click();
    return this;
  }

  /** Field pertama yang invalid menurut constraint validation browser (atau null). */
  firstInvalidName(formSel) {
    return cy.get(formSel).then(($f) => {
      const bad = Cypress.$($f).find(':input').toArray().find((el) => el.willValidate && !el.checkValidity());
      return cy.then(() => (bad ? bad.name : null));
    });
  }

  /** Dipakai ProdukPage untuk kolom tunggal. */
  columnTexts(colIdx) {
    return ProdukPage.allColumnTexts(this.table, colIdx);
  }
}

export default new ProdukPinjamanPage();
