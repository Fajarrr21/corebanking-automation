/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LaporanSubPage from '../../../support/pageobjects/Laporan/LaporanSubPage';

// Laporan - Sub-laporan Pinjaman — TIDAK ada PRD (Sumber = Asumsi dari source origin/develop).
// Pemeriksaan standar per laporan: tidak dilempar ke /login, breadcrumb, header
// kolom persis (resources/views/report/**), request data GET 200, tabel selesai
// dimuat (baris data ATAU empty-state — keduanya sah), tombol export CSV & Excel.
// READ-ONLY: write-guard aktif tanpa allow.

describe('Laporan - Sub-laporan Pinjaman', () => {
  let fx;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    LoginPage.clearSession();
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-LPJ-VIEW-001 | Positif | Daftar Tagih Angsuran: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.dueDate;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-002 | Positif | Daftar Pinjaman Akan Lunas: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.paidOff;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-003 | Positif | Daftar Nasabah Jatuh Tempo: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.customerDue;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-004 | Positif | Lap Angsuran Pokok Pinjaman (tab Pokok Aktif): halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.principalInstallment;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-005 | Positif | Lap Rekap Pinjaman: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.loanRecap;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-006 | Positif | Lap Pembayaran Bunga: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.interestInstallment;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-007 | Positif | Lap Realisasi Pinjaman: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.loanRealization;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LPJ-VIEW-008 | Positif | Lap Statistik Pinjaman: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.loanStatistic;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });
});
