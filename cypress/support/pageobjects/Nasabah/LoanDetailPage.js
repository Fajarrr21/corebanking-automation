// LoanDetailPage — detail pinjaman /loan/{refId}?menu=<tab>.
//
// Sumber markup (origin/develop): resources/views/loan/detail.blade.php + partial di resources/views/loan/detail/**
//   Nav tab : ul.nav.nav-pills > li > a[data-toggle="tab"][href="#tab_*"]. Label per role:
//             super-admin/auditor → Data Pinjaman, Riwayat Angsuran, Jadwal Angsuran, Agunan, Pengaturan(super-admin)
//             role lain           → + Angsuran (bila can_act & ACTIVE/BLACKLIST), Pencairan (APPROVED),
//                                   Dokumen Pencairan, Surat Pengajuan.
//             Semua tab-pane TETAP dirender (kecuali installment/withdrawal/setting/history bersyarat), jadi
//             ?menu=disbursement-doc / ?menu=application tetap membuka panelnya walau link nav tidak ada.
//   Pane    : #tab_data, #tab_installment, #tab_detail-installment (#data-table-installment, GET /loan/installment/{ref}),
//             #tab_history (#data-table-history, GET /loan/{ref}/history), #tab_collateral,
//             #tab_disbursement_doc (#subtab_sph = SPK preview [_sph-body], #subtab_schedule = Jadwal Angsuran
//             [_disbursement-body]), #tab_application (Formulir Permohonan [_application-body]).
//   Cetak   : tombol "Print" memanggil window.open(url,'_blank') → /printSPH/{ref}?..., /loan/print/document/{ref}?...,
//             /loan/{ref}/collateral/print-new/?view=...; halaman cetak = HTML (onload window.print + html2pdf).
//             Di test: window.open di-stub, lalu URL-nya diambil via cy.request (GET, read-only).

import BasePage from '../BasePage';

export const norm = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
/** "Rp 1.234.567" / "IDR 1.234.567,00" → 1234567 (desimal ,00 dibuang). */
export const rupiah = (s) => {
  const t = String(s || '').replace(/,\d{1,2}\s*$/, '');
  const n = t.replace(/[^0-9-]/g, '');
  return n ? Number(n) : 0;
};

class LoanDetailPage extends BasePage {
  elements = {
    navTabs: () => cy.get('.credis-detail-modern ul.nav.nav-pills').first().find('a[data-toggle="tab"]'),
    pane: (sel) => cy.get(sel),
    historyTable: () => cy.get('#data-table-history'),
    scheduleTable: () => cy.get('#data-table-installment'),
    historyExportBtn: (label) => cy.get('#buttonexporthistoryloan a').filter(`:contains("${label}")`),
    sphPane: () => cy.get('#subtab_sph'),
    schedulePane: () => cy.get('#subtab_schedule'),
    subtab: (label) => cy.contains('#tab_disbursement_doc ul.nav-tabs a', label),
    printBtnIn: (paneSel) => cy.get(`${paneSel} a.print-btn`).first(),
    collateralSubtab: (label) => cy.contains('#tab_collateral ul.nav-pills a[data-toggle="tab"]', label),
    otherOfficeNote: () => cy.get('.tab-content .note.note-warning'),
  };

  /** Pasang intercept DataTables detail (jadwal & riwayat) sebelum visit. */
  interceptDetailTables() {
    cy.intercept('GET', /\/loan\/installment\/[^/?]+(\?|$)/).as('loanSchedule');
    cy.intercept('GET', /\/loan\/[^/]+\/history(\?|$)/).as('loanHistory');
    return this;
  }

  /** Buka detail (opsional ?menu=...). Menunggu tidak di-redirect ke /login. */
  openDetail(detailPath, refId, menu) {
    this.interceptDetailTables();
    const url = detailPath.replace('{refId}', refId) + (menu ? `?menu=${menu}` : '');
    this.open(url);
    this.assertNotRedirectedToLogin();
    this.assertUrl(detailPath.replace('{refId}', refId));
    return this;
  }

  waitHistory(timeout = 60000) {
    cy.wait('@loanHistory', { timeout }).its('response.statusCode').should('eq', 200);
    this.waitTable('#data-table-history', timeout);
    return this;
  }

  waitSchedule(timeout = 60000) {
    cy.wait('@loanSchedule', { timeout }).its('response.statusCode').should('eq', 200);
    this.waitTable('#data-table-installment', timeout);
    return this;
  }

  /** Label link nav tab yang tampil. */
  navLabels() {
    return this.elements.navTabs().then(($a) => Cypress.$.makeArray($a).map((a) => norm(a.innerText)));
  }

  /** Stub window.open supaya tombol Print tidak membuka tab baru; URL tertangkap di @winOpen. */
  stubWindowOpen() {
    cy.window().then((win) => {
      cy.stub(win, 'open').as('winOpen').returns({ focus: () => {} });
    });
    return this;
  }

  /** URL terakhir yang dipanggil ke window.open (relatif → absolut ke baseUrl). */
  lastOpenedUrl() {
    return cy.get('@winOpen').should('have.been.called').then((stub) => {
      const args = stub.lastCall.args;
      return String(args[0]);
    });
  }

  /** GET halaman cetak (HTML) dan kembalikan jQuery dokumen hasil parse (tanpa menjalankan script). */
  fetchHtml(url, timeout = 60000) {
    return cy.request({ url, timeout, failOnStatusCode: false }).then((res) => {
      expect(res.status, `GET ${url}`).to.eq(200);
      expect(String(res.headers['content-type'] || ''), 'content-type HTML').to.include('text/html');
      const doc = new DOMParser().parseFromString(res.body, 'text/html');
      return Cypress.$(doc);
    });
  }

  /** Baris data tabel HTML biasa (tbody tr) → array of array teks sel. */
  tableMatrix($table) {
    return Cypress.$.makeArray($table.find('tbody tr')).map((tr) =>
      Cypress.$.makeArray(Cypress.$(tr).find('td')).map((td) => norm(td.innerText || td.textContent)),
    );
  }

  /** Tabel Jadwal Angsuran pada dokumen (_disbursement-body): tabel kedua (punya thead "Total Angsuran"). */
  scheduleDocTable($root) {
    return $root.find('table').filter((i, t) => /Total Angsuran/.test(Cypress.$(t).find('thead').text())).first();
  }

  /**
   * Parse dokumen Jadwal Angsuran (_disbursement-body) dari root jQuery (preview #subtab_schedule atau hasil cetak).
   * @return {{headers:string[], rows:object[], info:string, hasFooter:boolean, $table}}
   */
  parseScheduleDoc($root) {
    const $table = this.scheduleDocTable($root);
    const headers = Cypress.$.makeArray($table.find('thead th')).map((th) => norm(th.textContent));
    const idx = (name) => headers.indexOf(name);
    const rows = this.tableMatrix($table).map((cells) => ({
      no: cells[idx('No')],
      pokok: idx('Pokok') >= 0 ? rupiah(cells[idx('Pokok')]) : 0,
      bunga: idx('Bunga') >= 0 ? rupiah(cells[idx('Bunga')]) : 0,
      simpanan: idx('Simwapin') >= 0 ? rupiah(cells[idx('Simwapin')]) : 0,
      total: idx('Total Angsuran') >= 0 ? rupiah(cells[idx('Total Angsuran')]) : 0,
      cells,
    }));
    const info = norm($table.prevAll('table').first().text());
    return { headers, rows, info, hasFooter: $table.find('tfoot tr').length > 0, $table };
  }

  /** Ambil SEMUA tagihan (LoanBill) pinjaman via endpoint DataTables GET /loan/installment/{ref} (read-only). */
  fetchBills(refId, timeout = 60000) {
    return cy
      .request({ url: `/loan/installment/${refId}`, qs: { draw: 1, start: 0, length: -1 }, timeout })
      .then((res) => {
        expect(res.status).to.eq(200);
        return res.body.data
          .map((b) => ({ no: Number(b.bill_no), pokok: Number(b.principal), bunga: Number(b.interest), simpanan: Number(b.saving) }))
          .sort((a, b) => a.no - b.no);
      });
  }
}

export default new LoanDetailPage();
