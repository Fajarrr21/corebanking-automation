// LoanListPage — daftar pinjaman: /loan (aktif), /loan/paid (lunas), /loan/blacklist (DH).
//
// Sumber markup (origin/develop):
//   resources/views/loan/index.blade.php      → #data-table (DataTables server-side, ajax GET /loan/data),
//                                                kartu ringkasan (#npl, #total_withdrawal, ...), filter
//                                                #filter_office (hanya user pusat), #filter_product, #filter_status,
//                                                tombol "Export Excel" (onclick exportLoan() → GET /export/loan → antrian).
//   resources/views/loan/paid.blade.php       → #data-table, ajax GET /loan/datapaid?date=&date2=&office_id=&type=
//   resources/views/loan/blacklist.blade.php  → tab "DH Aktif" (#data-table-active, GET /loan/datablacklist/active)
//                                                dan "DH Lunas" (#data-table-paid, GET /loan/datablacklist/paid).
// Kolom aksi LoanController@indexData: <a ... href="/loan/{refId}" target="_blank">Lihat</a>; untuk super-admin pusat
// juga ada <a href="/loan/delete2?loan_ref_id=..">Delete</a> — GET yang MENGHAPUS pinjaman. JANGAN PERNAH diklik
// (write-guard tidak memblok GET).
//
// Helper data: findLoan() memakai endpoint DataTables GET /loan/data lewat cy.request (read-only) untuk mencari
// pinjaman yang cocok (bulanan/mingguan/punya angsuran) supaya spec tidak bergantung pada data hardcode.

import BasePage from '../BasePage';

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class LoanListPage extends BasePage {
  elements = {
    card: (id) => cy.get(`#${id}`),
    filterOffice: () => cy.get('#filter_office'),
    filterProduct: () => cy.get('#filter_product'),
    filterStatus: () => cy.get('#filter_status'),
    exportBtn: (label) => cy.contains('a.btn', label),
    rowViewLinks: (table = '#data-table') => cy.get(`${table} tbody a.btn`).filter(':contains("Lihat")'),
    tab: (label) => cy.contains('ul.nav-pills a[data-toggle="tab"]', label),
    dateFrom: () => cy.get('#date'),
    dateTo: () => cy.get('#date2'),
  };

  /** Regex path endpoint DataTables (dipakai cy.intercept). */
  dataRe(path) {
    return new RegExp(`${escRe(path)}(\\?|$)`);
  }

  /** Buka halaman list dan tunggu ajax DataTables pertamanya selesai. */
  openList(path, dataPath, table = '#data-table', timeout = 60000) {
    cy.intercept('GET', this.dataRe(dataPath)).as('loanListData');
    this.open(path);
    this.assertNotRedirectedToLogin();
    cy.wait('@loanListData', { timeout }).its('response.statusCode').should('eq', 200);
    this.waitTable(table, timeout);
    return this;
  }

  /** Teks sel kolom tertentu dari semua baris data yang tampil. */
  columnTexts(colIdx, table = '#data-table') {
    return cy.get(`${table} tbody tr`).then(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
      return data.map((r) => Cypress.$(r).find('td').eq(colIdx).text().replace(/\s+/g, ' ').trim());
    });
  }

  /** Ambil baris pinjaman aktif via endpoint DataTables (GET, read-only). */
  fetchActiveLoans(dataPath, length = 100, timeout = 60000) {
    return cy
      .request({ url: dataPath, qs: { draw: 1, start: 0, length }, timeout, failOnStatusCode: false })
      .then((res) => {
        expect(res.status, `GET ${dataPath} harus 200`).to.eq(200);
        expect(res.body, 'response DataTables berupa JSON').to.have.property('data');
        return res.body.data;
      });
  }

  /** Ringkas satu baris /loan/data menjadi objek pinjaman. */
  toLoan(row) {
    let cif = {};
    try {
      cif = JSON.parse(row.cif_data || '{}');
    } catch (e) {
      cif = {};
    }
    const loan = row.loan || {};
    return {
      refId: row.ref_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      cifCode: cif.code,
      installmentType: loan.installment_type,
      amount: Number(loan.amount),
      tenor: Number(loan.tenor),
      paidPrincipal: Number(loan.paid_principal || 0),
      withdrawalAt: loan.withdrawal_at,
      officeId: row.office_id,
      saving: Number(loan.saving || 0),
    };
  }

  /**
   * Cari pinjaman aktif yang cocok.
   * @param {object} opt { fixtureRefId, type: 'MONTHLY'|'WEEKLY', withPayment: bool, dataPath, length, label }
   * Prioritas: refId dari fixture (bila diisi) → pinjaman terbaru (withdrawal_at terbesar) yang cocok.
   * Gagal dengan pesan jelas bila tidak ada (precondition data staging).
   */
  findLoan(opt) {
    const { fixtureRefId, type, withPayment, dataPath, length, label } = opt;
    return this.fetchActiveLoans(dataPath, length).then((rows) => {
      const loans = rows.map((r) => this.toLoan(r));
      if (fixtureRefId) {
        const hit = loans.find((l) => l.refId === fixtureRefId);
        return cy.then(() => hit || { refId: fixtureRefId, installmentType: type });
      }
      const match = loans
        .filter((l) => (!type || l.installmentType === type) && (!withPayment || l.paidPrincipal > 0))
        .sort((a, b) => String(b.withdrawalAt || '').localeCompare(String(a.withdrawalAt || '')));
      expect(
        match.length,
        `precondition: ada pinjaman aktif ${label || type || ''} di ${length} baris pertama /loan/data (atau isi refId di fixture)`,
      ).to.be.greaterThan(0);
      return cy.then(() => match[0]);
    });
  }
}

export default new LoanListPage();
