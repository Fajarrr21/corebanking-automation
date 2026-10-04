// SavingListPage — daftar simpanan nasabah (/saving).
//
// Sumber: resources/views/saving/index.blade.php + SavingController@index/indexData/
// filterCabangSaving + DownloadController@exportsaving.
// - Ringkasan (server-render): #count_all_account, #sum_all_account (JUMLAH NASABAH),
//   #sum_active_account/#count_active_account, #sum_dormant_account/#count_dormant_account,
//   kartu ON HOLD (tanpa id). Ringkasan hanya diperbarui saat #filter_office berubah
//   (GET /filterCabangSaving/{nama}).
// - Toolbar: #filter_office (hanya user pusat), #filter_product (value = nama produk),
//   #filter_status (ACTIVE/ON_HOLD/DORMANT/CLOSED/REJECTED), #filter_balance
//   (ALL/ZERO/NON_ZERO), input.balance-range: #balance_min/#balance_max (cabang) atau
//   #balance_min_ho/#balance_max_ho (pusat). Validasi min>max → div#balance-range-error.
//   Tombol refresh (fa-refresh) + "Export Excel" (window.location → /export/saving?...).
// - Tabel #data-table, ajax GET /saving/data (+ filter_balance, balance_min, balance_max).
//   Kolom: [aksi] | ID | Kantor Cabang | Account Officer | Produk | Suku Bunga | Kode CIF |
//   Nama | NIK | No Rekening | Saldo ("IDR 1.000,00") | Status (Aktif/Dorman/Dibekukan/Ditutup).
//   Aksi: <a ... href="/saving/{refId}" target="_blank"><i class="fa fa-eye"></i> Lihat</a>.

import BasePage from '../BasePage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** "IDR 1.234.567,89" → 1234567.89 */
export const parseIdr = (t) => {
  const s = String(t || '').replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return s === '' ? NaN : Number(s);
};

class SavingListPage extends BasePage {
  table = '#data-table';

  elements = {
    summaryCardLabels: () => cy.get('.page-content .portlet.light > div > span:first-child'),
    countAll: () => cy.get('#count_all_account'),
    sumAll: () => cy.get('#sum_all_account'),
    filterOffice: () => cy.get('#filter_office'),
    filterProduct: () => cy.get('#filter_product'),
    filterStatus: () => cy.get('#filter_status'),
    filterBalance: () => cy.get('#filter_balance'),
    balanceMin: () => cy.get('input.balance-range[placeholder="Saldo minimum"]'),
    balanceMax: () => cy.get('input.balance-range[placeholder="Saldo maksimum"]'),
    rangeError: () => cy.get('#balance-range-error'),
    toolbar: () => cy.get('.table-toolbar'),
    exportBtn: (label) => cy.get('.table-toolbar a').contains(label),
    viewLinks: () => cy.get(`${this.table} tbody a[href*="/saving/"]`),
  };

  interceptData(alias = 'savingData') {
    cy.intercept({ method: 'GET', pathname: '/saving/data' }).as(alias);
    return this;
  }

  visitList(path = '/saving', timeout = 30000) {
    this.interceptData('savingData');
    this.open(path);
    cy.wait('@savingData', { timeout });
    this.waitTable(this.table, timeout);
    return this;
  }

  isUserPusat() {
    return cy.get('body').then(($b) => $b.find('#filter_office').length > 0);
  }

  /** Isi saldo min/max (ketik + blur memicu event change → ajax.reload). */
  typeBalance(which, value) {
    const el = which === 'min' ? this.elements.balanceMin : this.elements.balanceMax;
    el().clear();
    if (value !== '') el().type(String(value), { delay: 0 });
    el().blur();
    return this;
  }

  /**
   * Terapkan rentang saldo. Tiap isian yang berubah memicu satu reload
   * (event change saat blur), jadi tiap isian ditunggu request-nya sendiri.
   * Pakai `undefined` untuk isian yang tidak disentuh.
   */
  applyBalanceRange(min, max, timeout = 30000) {
    this.interceptData('savingRange');
    if (min !== undefined) {
      this.typeBalance('min', min);
      cy.wait('@savingRange', { timeout });
    }
    if (max !== undefined) {
      this.typeBalance('max', max);
      cy.wait('@savingRange', { timeout });
    }
    this.waitTable(this.table, timeout);
    return this;
  }

  /** Pilih <select> filter (select2me, pakai select native → event change jQuery). */
  applySelectFilter(sel, value, timeout = 30000) {
    this.interceptData('savingFilter');
    this.selectNative(sel, value);
    cy.wait('@savingFilter', { timeout });
    this.waitTable(this.table, timeout);
    return this;
  }

  search(text, timeout = 30000) {
    cy.intercept({ method: 'GET', pathname: '/saving/data', query: { 'search[value]': text } }).as('savingSearch');
    this.tableSearch(this.table).clear().type(text, { delay: 0 });
    cy.wait('@savingSearch', { timeout });
    this.waitTable(this.table, timeout);
    return this;
  }

  /** Teks kolom (index) dari seluruh baris data. */
  columnTexts(colIdx) {
    return cy.get(`${this.table} tbody tr`).then(($rows) =>
      Cypress.$.makeArray($rows)
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .map((r) => norm(Cypress.$(r).find('td').eq(colIdx).text())),
    );
  }

  /** Data baris pertama: { refId, name, accountNumber, balance, href }. */
  firstRowData(col) {
    return cy.get(`${this.table} tbody tr`).first().then(($tr) => {
      expect($tr.find('td.dataTables_empty').length, 'precondition: tabel simpanan punya minimal 1 data').to.eq(0);
      const href = $tr.find('a[href*="/saving/"]').attr('href') || '';
      const refId = href.split('/saving/')[1] || '';
      const td = (i) => norm($tr.find('td').eq(i).text());
      const data = {
        refId: refId.split(/[?#/]/)[0],
        name: td(col.name),
        accountNumber: td(col.accountNumber),
        product: td(col.product),
        office: td(col.office),
        balance: parseIdr(td(col.balance)),
        href,
      };
      return cy.then(() => data);
    });
  }

  /** Nilai opsi pertama non-"ALL" dari select filter. */
  firstFilterOption(sel) {
    return cy.get(sel).find('option').then(($o) => {
      const opt = Cypress.$.makeArray($o).find((o) => o.value && o.value !== 'ALL');
      expect(opt, `precondition: ${sel} punya opsi selain ALL`).to.exist;
      return cy.then(() => opt.value);
    });
  }
}

export default new SavingListPage();
