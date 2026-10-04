// CifListPage — daftar CIF nasabah (/cif).
//
// Sumber: resources/views/cif/index.blade.php + CifController@cif/cifData.
// - Tabel `#data-table` DataTables server-side, ajax GET route('cif.data') = /cif/data.
// - Kolom: [aksi] | ID | Kantor Cabang | Kode CIF | Nama | No KTP | Alamat Lengkap | No Kartu.
// - Aksi baris: <a class="btn ... blue-steel" href="/cif/{code}"><i class="fa fa-eye"></i> Lihat</a>.
// - `#filter_office` (select2me, value = NAMA kantor) hanya dirender bila user pusat
//   (office_id == 0). Tombol "Buat CIF" (a[href=/cif/create]) hanya bila office_id != 0.
// - Tombol export DataTables (csvHtml5, excelHtml5) di-append ke `#buttonexportcif`.

import BasePage from '../BasePage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

class CifListPage extends BasePage {
  table = '#data-table';

  elements = {
    createBtn: () => cy.get('a[href$="/cif/create"]'),
    filterOffice: () => cy.get('#filter_office'),
    exportCsv: () => cy.get('#buttonexportcif .buttons-csv'),
    exportExcel: () => cy.get('#buttonexportcif .buttons-excel'),
    rows: () => cy.get(`${this.table} tbody tr`),
  };

  interceptData(alias = 'cifData') {
    cy.intercept({ method: 'GET', pathname: '/cif/data' }).as(alias);
    return this;
  }

  /** Login + buka /cif, tunggu ajax pertama DataTables selesai. */
  visitList(path = '/cif', timeout = 30000) {
    this.interceptData('cifData');
    this.open(path);
    cy.wait('@cifData', { timeout });
    this.waitTable(this.table, timeout);
    return this;
  }

  /** true bila user pusat (office_id == 0) — ditandai keberadaan #filter_office. */
  isUserPusat() {
    return cy.get('body').then(($b) => $b.find('#filter_office').length > 0);
  }

  /** Ketik di kotak search DataTables lalu tunggu request yang membawa keyword tsb. */
  search(text, timeout = 30000) {
    cy.intercept({ method: 'GET', pathname: '/cif/data', query: { 'search[value]': text } }).as('cifSearch');
    this.tableSearch(this.table).clear().type(text, { delay: 0 });
    cy.wait('@cifSearch', { timeout });
    this.waitTable(this.table, timeout);
    return this;
  }

  /** Pilih filter cabang (value = nama kantor) lalu tunggu reload tabel. */
  filterOffice(value, timeout = 30000) {
    this.interceptData('cifFilter');
    this.selectNative('#filter_office', value);
    cy.wait('@cifFilter', { timeout });
    this.waitTable(this.table, timeout);
    return this;
  }

  /**
   * Data baris pertama: { code, name, nik, office, href }.
   * Gagal jelas bila tabel kosong (precondition: staging punya data CIF).
   */
  firstRowData(col) {
    return cy.get(`${this.table} tbody tr`).first().then(($tr) => {
      expect($tr.find('td.dataTables_empty').length, 'precondition: tabel CIF punya minimal 1 data').to.eq(0);
      const td = (i) => norm($tr.find('td').eq(i).text());
      const data = {
        code: td(col.code),
        name: td(col.name),
        nik: td(col.nik),
        office: td(col.office),
        href: $tr.find('a[href*="/cif/"]').attr('href'),
      };
      return cy.then(() => data);
    });
  }

  /** Baris data yang kolom Nama-nya diawali prefix (column-scoped). */
  rowsWhereNameStartsWith(prefix, nameCol) {
    return cy.get(`${this.table} tbody tr`).then(($rows) =>
      Cypress.$.makeArray($rows).filter((r) => norm(Cypress.$(r).find('td').eq(nameCol).text()).startsWith(prefix)),
    );
  }
}

export default new CifListPage();
