/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Laporan.json
// Halaman laporan terkait pinjaman (ReportController): /paid-off, /principal-installment (Pokok Aktif & DH),
// /interest-installment, /loan-realization. Tidak ada PRD khusus → TC dasar (Sumber: Asumsi).
// Read-only: semua test memasang cy.guardWrites() dan diakhiri cy.assertNoWritesLeaked().
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describe('Nasabah - Pinjaman - Laporan Pinjaman', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const assertDateParams = (alias) => cy.get(alias).then((i) => {
    expect(i.request.url, 'ajax membawa rentang tanggal').to.match(/date=\d{4}-\d{2}-\d{2}/).and.match(/date2=\d{4}-\d{2}-\d{2}/);
  });

  it('TC-LOAN-LAPORAN-001 | Happy | Daftar Pinjaman Akan Lunas tampil dengan header kolom dan data rentang tanggal', () => {
    const r = fx.reports.paidOff;
    LoanListPage.openList(fx.paths.paidOff, r.data, r.table, fx.timeout.table);
    LoanListPage.assertDocumentTitle(r.title).assertBreadcrumb(r.breadcrumb).assertHeaders(r.headers, r.table);
    assertDateParams('@loanListData');
  });

  it('TC-LOAN-LAPORAN-002 | Happy | Laporan Angsuran Pokok menampilkan tab Pokok Aktif & Pokok DH beserta header kolom', () => {
    const r = fx.reports.principal;
    cy.intercept('GET', LoanListPage.dataRe(r.dataDh)).as('pokokDh');
    LoanListPage.openList(fx.paths.principalInstallment, r.data, r.table, fx.timeout.table);
    LoanListPage.assertDocumentTitle(r.title).assertBreadcrumb(r.breadcrumb).assertHeaders(r.headers, r.table);
    LoanListPage.elements.tab(r.tabActive).should('be.visible');
    LoanListPage.elements.tab(r.tabDh).should('be.visible').click();
    cy.wait('@pokokDh', { timeout: fx.timeout.table }).its('response.statusCode').should('eq', 200);
    LoanListPage.waitTable(r.tableDh, fx.timeout.table).assertHeaders(r.headers, r.tableDh);
  });

  it('TC-LOAN-LAPORAN-003 | Happy | Laporan Pembayaran Bunga tampil dengan header kolom', () => {
    const r = fx.reports.interest;
    LoanListPage.openList(fx.paths.interestInstallment, r.data, r.table, fx.timeout.table);
    LoanListPage.assertDocumentTitle(r.title).assertBreadcrumb(r.breadcrumb).assertHeaders(r.headers, r.table);
    assertDateParams('@loanListData');
  });

  it('TC-LOAN-LAPORAN-004 | Happy | Laporan Realisasi Pinjaman tampil dengan kolom utama', () => {
    const r = fx.reports.realization;
    LoanListPage.openList(fx.paths.loanRealization, r.data, r.table, fx.timeout.table);
    LoanListPage.assertDocumentTitle(r.title).assertBreadcrumb(r.breadcrumb);
    LoanListPage.tableHeaders(r.table).then(($th) => {
      const t = Cypress.$.makeArray($th).map((th) => norm(th.innerText));
      expect(t.slice(0, r.headersPrefix.length)).to.deep.eq(r.headersPrefix);
    });
  });

  it('TC-LOAN-LAPORAN-005 | Positif | Halaman Laporan Pinjaman menautkan keempat laporan', () => {
    LoanListPage.open(fx.paths.reportLoan);
    LoanListPage.assertNotRedirectedToLogin();
    [fx.paths.paidOff, fx.paths.principalInstallment, fx.paths.interestInstallment, fx.paths.loanRealization].forEach((p) => {
      cy.get(`a[href="${p}"]`).should('exist').and('contain.text', 'Lihat Detail');
    });
  });
});
