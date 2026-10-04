/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LaporanSubPage from '../../../support/pageobjects/Laporan/LaporanSubPage';

// Laporan - Sub-laporan Umum — TIDAK ada PRD (Sumber = Asumsi dari source origin/develop).
// Pemeriksaan standar per laporan: tidak dilempar ke /login, breadcrumb, header
// kolom persis (resources/views/report/**), request data GET 200, tabel selesai
// dimuat (baris data ATAU empty-state — keduanya sah), tombol export CSV & Excel.
// READ-ONLY: write-guard aktif tanpa allow.

describe('Laporan - Sub-laporan Umum', () => {
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

  it('TC-LUM-VIEW-001 | Positif | Chart Of Accounts (COA): halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.coa;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LUM-VIEW-002 | Positif | Lap NPL dan PPAP Harian: halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.riskIndicator;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });

  it('TC-LUM-VIEW-003 | Positif | Saldo Kas Teller Kantor Cabang (tanpa tautan menu): halaman terbuka, header kolom, data termuat, tombol CSV/Excel', () => {
    const r = fx.reports.kasTeller;
    LaporanSubPage.visit(r);
    LaporanSubPage.assertStandardReport(r, fx.timeout);
  });
});
