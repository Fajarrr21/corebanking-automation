/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LabaRugiPage from '../../../support/pageobjects/Laporan/LabaRugiPage';
import { normLower } from '../../../support/pageobjects/Laporan/ReportBasePage';

// Laporan Laba Rugi (PRD "Laporan Laba Rugi BKD Pekalongan").
// READ-ONLY: data via GET /profit-loss/data/. Write-guard aktif tanpa allow.
// Precondition umum: akun test = user pusat (office_id 0) dengan role laporan.

describe('Laporan - Laba Rugi', () => {
  let all;
  let fx;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      all = d;
      fx = d.labaRugi;
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

  const topRows = (body) => LabaRugiPage.flatten(body.data).filter((r) => !r.child);
  const near = (a, b, msg) => expect(Math.abs(a - b), `${msg}: ${a} vs ${b}`).to.be.lte(fx.toleransi);

  describe('Tampilan halaman', () => {
    it('TC-LR-VIEW-001 | Happy | membuka Laba Rugi lewat menu Laporan > Umum > Lap Laba/Rugi', () => {
      LabaRugiPage.interceptGet(fx.dataPath, 'labaRugi');
      cy.visit('/home');
      LabaRugiPage.openViaSidebar(all.menu.parent, all.indexPages.general.path);
      LabaRugiPage.openCard(fx.path);
      LabaRugiPage.assertBreadcrumb(fx.breadcrumb);
      LabaRugiPage.elements.caption().should('contain.text', fx.caption);
      LabaRugiPage.waitData();
      LabaRugiPage.waitTable(fx.table, all.timeout);
      LabaRugiPage.elements.parentRows().should('have.length.greaterThan', 0);
    });

    it('TC-LR-VIEW-002 | Positif | elemen halaman: filter kantor, filter bulan, export CSV/Excel, search, header tabel', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.assertUserPusat();
      LabaRugiPage.elements.filterBranch().find('option:selected').should('have.value', fx.akumulasiValue);
      LabaRugiPage.elements.date().should('have.value', LabaRugiPage.monthLabel(new Date()));
      LabaRugiPage.waitData().then(() => {
        LabaRugiPage.elements.buttonsBox().find('.buttons-csv').should('be.visible');
        LabaRugiPage.elements.buttonsBox().find('.buttons-excel').should('be.visible');
        LabaRugiPage.tableSearch(fx.table).should('be.visible');
      });
      LabaRugiPage.assertHeaders(fx.headers, fx.table);
    });

    it('TC-LR-VIEW-003 | Positif | template A s.d. I tampil berurutan dengan nomor akun sesuai PRD', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData().then((body) => {
        const top = topRows(body);
        const names = top.map((r) => normLower(r.name));
        let lastIdx = -1;
        fx.rowsWajib.forEach((w) => {
          const idx = names.indexOf(normLower(w.nama));
          expect(idx, `baris "${w.nama}" ada`).to.be.greaterThan(-1);
          expect(idx, `urutan "${w.nama}"`).to.be.greaterThan(lastIdx);
          lastIdx = idx;
          expect(top[idx].norek, `akun "${w.nama}"`).to.eq(w.norek);
        });
      });
    });
  });

  describe('Rumus laba rugi', () => {
    it('TC-LR-VIEW-004 | Positif | Jumlah Pendapatan Operasional = Pendapatan Bunga + Pendapatan Operasional Lainnya', () => {
      const r = fx.rumus;
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData().then((body) => {
        const top = topRows(body);
        near(
          LabaRugiPage.valueOf(top, r.jumlahPendapatan),
          LabaRugiPage.valueOf(top, r.pendapatanBunga) + LabaRugiPage.valueOf(top, r.pendapatanLain),
          'Jumlah Pendapatan Operasional',
        );
      });
    });

    it('TC-LR-VIEW-005 | Positif | Jumlah Beban Operasional = jumlah seluruh komponen beban operasional', () => {
      const r = fx.rumus;
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData().then((body) => {
        const top = topRows(body);
        const sum = r.bebanKomponen.reduce((s, n) => s + LabaRugiPage.valueOf(top, n), 0);
        near(LabaRugiPage.valueOf(top, r.jumlahBeban), sum, 'Jumlah Beban Operasional');
      });
    });

    it('TC-LR-VIEW-006 | Positif | C. Laba (Rugi) Operasional = Jumlah Pendapatan Operasional − Jumlah Beban Operasional', () => {
      const r = fx.rumus;
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData().then((body) => {
        const top = topRows(body);
        near(
          LabaRugiPage.valueOf(top, r.labaOperasional),
          LabaRugiPage.valueOf(top, r.jumlahPendapatan) - LabaRugiPage.valueOf(top, r.jumlahBeban),
          'C. Laba (Rugi) Operasional',
        );
      });
    });

    it('TC-LR-VIEW-007 | Positif | F. Laba (Rugi) Sebelum Pajak = C + D. Pendapatan Non Operasional − E. Beban Non Operasional', () => {
      const r = fx.rumus;
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData().then((body) => {
        const top = topRows(body);
        near(
          LabaRugiPage.valueOf(top, r.labaSebelumPajak),
          LabaRugiPage.valueOf(top, r.labaOperasional) +
            LabaRugiPage.valueOf(top, r.pendapatanNonOps) -
            LabaRugiPage.valueOf(top, r.bebanNonOps),
          'F. Laba (Rugi) Sebelum Pajak',
        );
      });
    });

    it('TC-LR-VIEW-008 | Positif | I. Laba (Rugi) Tahun Berjalan = F − G. Taksiran Pajak + H. Fee Based Income', () => {
      const r = fx.rumus;
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData().then((body) => {
        const top = topRows(body);
        near(
          LabaRugiPage.valueOf(top, r.labaBerjalan),
          LabaRugiPage.valueOf(top, r.labaSebelumPajak) -
            LabaRugiPage.valueOf(top, r.pajak) +
            LabaRugiPage.valueOf(top, r.feeBased),
          'I. Laba (Rugi) Tahun Berjalan',
        );
      });
    });
  });

  describe('Filter', () => {
    it('TC-LR-VIEW-009 | Positif | default memuat Akumulasi semua kantor pada bulan berjalan', () => {
      LabaRugiPage.visit(fx);
      cy.wait('@labaRugi', { timeout: 120000 }).then((i) => {
        LabaRugiPage.expectDataTablesOk(i);
        expect(LabaRugiPage.qp(i, 'office'), 'office default = Akumulasi').to.eq(fx.akumulasiValue);
        expect(LabaRugiPage.qp(i, 'date'), 'bulan default').to.eq(LabaRugiPage.monthLabel(new Date()));
      });
    });

    it('TC-LR-VIEW-010 | Positif | filter kantor: memilih satu kantor memuat Laba Rugi kantor tsb', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.assertUserPusat();
      LabaRugiPage.waitData();
      LabaRugiPage.selectFirstBranch(fx.akumulasiValue).then((branch) => {
        LabaRugiPage.waitForRequest('labaRugi', (i) => LabaRugiPage.qp(i, 'office') === branch.value).then((i) => {
          LabaRugiPage.expectDataTablesOk(i);
        });
        LabaRugiPage.waitTable(fx.table, all.timeout);
        LabaRugiPage.elements.parentRows().should('have.length.greaterThan', 0);
      });
    });

    it('TC-LR-VIEW-011 | Positif | filter bulan: memilih bulan lalu memuat Laba Rugi periode tsb', () => {
      const label = LabaRugiPage.monthLabel(LabaRugiPage.previousMonth());
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData();
      LabaRugiPage.setDateValue('#date', label);
      LabaRugiPage.waitForRequest('labaRugi', (i) => LabaRugiPage.qp(i, 'date') === label).then((i) => {
        const body = LabaRugiPage.expectDataTablesOk(i);
        expect(topRows(body).length, 'template tetap lengkap').to.be.at.least(fx.rowsWajib.length);
      });
      LabaRugiPage.waitTable(fx.table, all.timeout);
    });
  });

  describe('Pencarian', () => {
    it('TC-LR-VIEW-012 | Positif | search jenis data menampilkan baris yang dicari', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData();
      LabaRugiPage.waitTable(fx.table, all.timeout);
      LabaRugiPage.searchServer(fx.table, fx.searchKeyword);
      LabaRugiPage.waitForRequest('labaRugi', (i) => LabaRugiPage.qp(i, 'search[value]') === fx.searchKeyword);
      LabaRugiPage.waitTable(fx.table, all.timeout);
      cy.get(`${fx.table} tbody tr`).should(($rows) => {
        const parents = Cypress.$.makeArray($rows).filter(
          (r) => !Cypress.$(r).hasClass('child-row') && !Cypress.$(r).find('td.dataTables_empty').length,
        );
        expect(parents.length, 'ada baris hasil pencarian').to.be.greaterThan(0);
        parents.forEach((r) => {
          const name = Cypress.$(r).find('td').eq(0).text();
          expect(normLower(name), `baris "${name}" memuat kata kunci`).to.include(normLower(fx.searchKeyword));
        });
      });
    });

    it('TC-LR-VIEW-013 | Negatif | search jenis data yang tidak ada menampilkan tabel kosong', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData();
      LabaRugiPage.waitTable(fx.table, all.timeout);
      LabaRugiPage.searchServer(fx.table, fx.searchNotFound);
      LabaRugiPage.waitForRequest('labaRugi', (i) => LabaRugiPage.qp(i, 'search[value]') === fx.searchNotFound);
      LabaRugiPage.emptyState(fx.table).should('be.visible');
      LabaRugiPage.dataRows(fx.table).should('have.length', 0);
    });
  });

  describe('Export', () => {
    it('TC-LR-VIEW-014 | Positif | export CSV menghasilkan file CSV berisi header laporan', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData();
      LabaRugiPage.waitTable(fx.table, all.timeout);
      LabaRugiPage.spyBlobDownload().clickExport('csv').assertCsvExport(fx.csvHeaderCells);
    });

    it('TC-LR-VIEW-015 | Positif | export Excel menghasilkan file xlsx', () => {
      LabaRugiPage.visit(fx);
      LabaRugiPage.waitData();
      LabaRugiPage.waitTable(fx.table, all.timeout);
      LabaRugiPage.spyBlobDownload().clickExport('excel').assertExcelExport();
    });
  });
});
