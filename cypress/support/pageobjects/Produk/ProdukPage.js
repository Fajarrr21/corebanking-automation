// ProdukPage — halaman ringkasan produk (/product) + halaman Produk Simpanan (/product/saving).
//
// Sumber markup (origin/develop):
//   resources/views/product/index.blade.php  — 2 kartu "SIMPANAN" / "PINJAMAN" + tombol ke form tambah.
//   resources/views/product/saving.blade.php — form "Tambah Simpanan" + tabel #sample_1 (DataTables
//     client-side, diinisialisasi table-datatables-managed.min.js).
// Otorisasi: ProductController::__construct → hanya role super-admin.

import BasePage from '../BasePage';

class ProdukPage extends BasePage {
  elements = {
    sidebarMenu: (title) => cy.contains('ul.page-sidebar-menu span.title', title).closest('a'),
    noteInfo: () => cy.get('.page-content .note.note-info'),
    cardTitles: () => cy.get('.page-content .card-title span'),
    btnTambahSimpanan: () => cy.get('.page-content a[href$="/product/saving"]'),
    btnTambahPinjaman: () => cy.get('.page-content a[href$="/product/loan"]'),
    cardDesc: () => cy.get('.page-content .card-desc'),
    portletCaption: () => cy.get('.portlet-title .caption-subject'),
    savingCreateForm: () => cy.get('form[action$="/product/saving"]'),
  };

  openIndex(path) {
    this.open(path);
    this.assertNotRedirectedToLogin();
    return this;
  }

  /** Teks sel kolom `colIdx` untuk SEMUA baris tabel (lintas halaman DataTables bila sudah diinisialisasi). */
  allColumnTexts(tableSel, colIdx) {
    return cy.window().then((win) => {
      const $ = win.jQuery;
      let rows;
      if ($ && $.fn && $.fn.dataTable && $.fn.dataTable.isDataTable(tableSel)) {
        rows = $(tableSel).DataTable().rows().nodes().toArray();
      } else {
        rows = Cypress.$(`${tableSel} tbody tr`).toArray();
      }
      const texts = rows
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .map((r) => Cypress.$(r).find('td').eq(colIdx).text().replace(/\s+/g, ' ').trim());
      return cy.then(() => texts);
    });
  }
}

export default new ProdukPage();
