/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LaporanSubPage from '../../../support/pageobjects/Laporan/LaporanSubPage';

// Laporan - Sub-laporan Simpanan — TIDAK ada PRD (Sumber = Asumsi dari source origin/develop).
// Pemeriksaan standar per laporan: tidak dilempar ke /login, breadcrumb, header
// kolom persis (resources/views/report/**), request data GET 200, tabel selesai
// dimuat (baris data ATAU empty-state — keduanya sah), tombol export CSV & Excel.
// READ-ONLY: write-guard aktif tanpa allow.

describe('Laporan - Sub-laporan Simpanan', () => {
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

  it('TC-LSP-VIEW-001 | Positif | Lap Transaksi Simpanan: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.savingTransaction;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LSP-VIEW-002 | Positif | Lap Statistik Simpanan: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.savingStatistic;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LSP-VIEW-003 | Positif | Lap Pembukuan Simpanan: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.savingBookkeeping;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });
});
