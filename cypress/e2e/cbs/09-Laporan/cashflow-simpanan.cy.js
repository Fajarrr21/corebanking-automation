/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import CashflowSimpananPage from '../../../support/pageobjects/Laporan/CashflowSimpananPage';
import { toNum } from '../../../support/pageobjects/Laporan/ReportBasePage';

// Laporan Cashflow Simpanan (PRD "Laporan Cashflow Simpanan").
// READ-ONLY: data via GET /saving-cashflow/data. Write-guard aktif tanpa allow.

describe('Laporan - Cashflow Simpanan', () => {
  let all;
  let fx;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      all = d;
      fx = d.cashflow;
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

  it('TC-CFS-VIEW-001 | Happy | membuka Lap Cashflow lewat menu Laporan > Simpanan', () => {
    CashflowSimpananPage.interceptGet(fx.dataPath, 'cashflow');
    cy.visit('/home');
    CashflowSimpananPage.openViaSidebar(all.menu.parent, all.indexPages.saving.path);
    CashflowSimpananPage.openCard(fx.path);
    CashflowSimpananPage.assertBreadcrumb(fx.breadcrumb);
    CashflowSimpananPage.waitData();
    CashflowSimpananPage.waitTable(fx.table, all.timeout);
  });

  it('TC-CFS-VIEW-002 | Positif | header kolom sesuai PRD (Nama Produk s.d. Saldo Akhir)', () => {
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.assertHeaders(fx.headers, fx.table);
    CashflowSimpananPage.waitData();
    CashflowSimpananPage.waitTable(fx.table, all.timeout);
  });

  it('TC-CFS-VIEW-003 | Positif | default menampilkan laporan hari ini', () => {
    const today = CashflowSimpananPage.ymd(new Date());
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.elements.date().should('have.value', today);
    cy.wait('@cashflow', { timeout: 120000 }).then((i) => {
      CashflowSimpananPage.expectDataTablesOk(i);
      expect(CashflowSimpananPage.qp(i, 'date'), 'tanggal default request').to.eq(today);
    });
  });

  it('TC-CFS-VIEW-004 | Positif | filter harian: memilih tanggal kemarin memuat laporan tanggal tsb', () => {
    const kemarin = CashflowSimpananPage.ymd(CashflowSimpananPage.daysAgo(fx.selisihHari));
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.waitData();
    CashflowSimpananPage.setDateValue('#date', kemarin);
    CashflowSimpananPage.waitForRequest('cashflow', (i) => CashflowSimpananPage.qp(i, 'date') === kemarin).then((i) => {
      CashflowSimpananPage.expectDataTablesOk(i);
    });
    CashflowSimpananPage.waitTable(fx.table, all.timeout);
  });

  it('TC-CFS-VIEW-005 | Positif | filter kantor (user pusat) memuat laporan kantor terpilih', () => {
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.assertUserPusat();
    CashflowSimpananPage.waitData();
    CashflowSimpananPage.selectFirstOffice(fx.semuaCabangValue).then((office) => {
      CashflowSimpananPage.waitForRequest('cashflow', (i) => CashflowSimpananPage.qp(i, 'office_id') === office.value).then(
        (i) => CashflowSimpananPage.expectDataTablesOk(i),
      );
    });
    CashflowSimpananPage.waitTable(fx.table, all.timeout);
  });

  it('TC-CFS-VIEW-006 | Edge | setiap baris produk berisi angka valid (nominal ≥ 0, jumlah orang bilangan bulat ≥ 0)', () => {
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.waitData().then((body) => {
      expect(body.data.length, 'Precondition: ada produk simpanan (type SAVING)').to.be.greaterThan(0);
      body.data.forEach((row) => {
        expect(String(row.Product || '').trim(), 'Nama Produk terisi').to.not.eq('');
        ['Deposit', 'Kredit'].forEach((k) => {
          expect(toNum(row[k]), `${row.Product} ${k}`).to.be.at.least(0);
        });
        ['Jml_Orang_Deposit', 'Jml_Orang_Kredit'].forEach((k) => {
          const n = Number(row[k]);
          expect(Number.isInteger(n) && n >= 0, `${row.Product} ${k}=${row[k]}`).to.eq(true);
        });
        ['Saldo_Awal', 'Saldo_Akhir'].forEach((k) => {
          expect(Number.isNaN(Number(row[k])), `${row.Product} ${k} numerik`).to.eq(false);
        });
      });
    });
  });

  it('TC-CFS-VIEW-007 | Edge | Saldo Awal hari ini = Saldo Akhir kemarin untuk setiap produk', () => {
    const kemarin = CashflowSimpananPage.ymd(CashflowSimpananPage.daysAgo(fx.selisihHari));
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.waitData().then((todayBody) => {
      const awalHariIni = {};
      todayBody.data.forEach((r) => {
        awalHariIni[r.Product] = toNum(r.Saldo_Awal);
      });
      CashflowSimpananPage.setDateValue('#date', kemarin);
      CashflowSimpananPage.waitForRequest('cashflow', (i) => CashflowSimpananPage.qp(i, 'date') === kemarin).then((i) => {
        const body = CashflowSimpananPage.expectDataTablesOk(i);
        body.data.forEach((r) => {
          expect(awalHariIni, `produk ${r.Product} ada di kedua hari`).to.have.property(r.Product);
          expect(
            Math.abs(awalHariIni[r.Product] - toNum(r.Saldo_Akhir)),
            `${r.Product}: Saldo Awal hari ini vs Saldo Akhir kemarin`,
          ).to.be.lte(1);
        });
      });
    });
  });

  it('TC-CFS-VIEW-008 | Positif | export CSV menghasilkan file CSV berisi header laporan', () => {
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.waitData();
    CashflowSimpananPage.waitTable(fx.table, all.timeout);
    CashflowSimpananPage.spyBlobDownload().clickExport('csv').assertCsvExport(fx.csvHeaderCells);
  });

  it('TC-CFS-VIEW-009 | Positif | export Excel menghasilkan file xlsx', () => {
    CashflowSimpananPage.visit(fx);
    CashflowSimpananPage.waitData();
    CashflowSimpananPage.waitTable(fx.table, all.timeout);
    CashflowSimpananPage.spyBlobDownload().clickExport('excel').assertExcelExport();
  });
});
