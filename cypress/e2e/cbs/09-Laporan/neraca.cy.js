/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import NeracaPage from '../../../support/pageobjects/Laporan/NeracaPage';
import LabaRugiPage from '../../../support/pageobjects/Laporan/LabaRugiPage';
import { normLower, toNum } from '../../../support/pageobjects/Laporan/ReportBasePage';

// Laporan Neraca (PRD "Laporan Neraca BKD Pekalongan").
// READ-ONLY: semua data via GET /sheet-balance/data. Write-guard aktif di setiap
// test (tidak ada POST yang di-allow), export = Blob di browser.
// Precondition umum: akun test = user pusat (office_id 0) dengan role laporan.

describe('Laporan - Neraca', () => {
  let all;
  let fx;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      all = d;
      fx = d.neraca;
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

  describe('Tampilan halaman', () => {
    it('TC-NRC-VIEW-001 | Happy | membuka Neraca lewat menu Laporan > Umum > Neraca', () => {
      NeracaPage.interceptGet(fx.dataPath, 'neraca');
      cy.visit('/home');
      NeracaPage.openViaSidebar(all.menu.parent, all.indexPages.general.path);
      NeracaPage.openCard(fx.path);
      NeracaPage.assertBreadcrumb(fx.breadcrumb);
      NeracaPage.elements.caption().should('contain.text', fx.caption);
      NeracaPage.waitData();
      NeracaPage.waitTable(fx.table, all.timeout);
      NeracaPage.elements.parentRows().should('have.length.greaterThan', 0);
    });

    it('TC-NRC-VIEW-002 | Positif | elemen halaman: filter kantor, filter bulan, export CSV/Excel, search, header tabel', () => {
      NeracaPage.visit(fx);
      NeracaPage.assertUserPusat();
      NeracaPage.elements.filterBranch().find('option:selected').should('have.value', fx.akumulasiValue);
      NeracaPage.elements.filterBranch().find(`option[value="${fx.akumulasiValue}"]`).should('contain.text', fx.akumulasiLabel);
      NeracaPage.elements.date().should('have.value', NeracaPage.monthLabel(new Date()));
      NeracaPage.waitData().then(() => {
        NeracaPage.exportButton('csv').should('be.visible');
        NeracaPage.exportButton('excel').should('be.visible');
        NeracaPage.tableSearch(fx.table).should('be.visible');
      });
      NeracaPage.assertHeaders(fx.headers, fx.table);
    });

    it('TC-NRC-VIEW-003 | Positif | default memuat Akumulasi semua kantor pada bulan berjalan', () => {
      NeracaPage.visit(fx);
      cy.wait('@neraca', { timeout: 120000 }).then((i) => {
        NeracaPage.expectDataTablesOk(i);
        expect(NeracaPage.qp(i, 'office'), 'office default = Akumulasi').to.eq(fx.akumulasiValue);
        expect(NeracaPage.qp(i, 'date'), 'bulan default = bulan berjalan').to.eq(NeracaPage.monthLabel(new Date()));
      });
    });
  });

  describe('Template laporan', () => {
    it('TC-NRC-VIEW-004 | Positif | semua baris template PRD (Aset, Liabilitas, Ekuitas, Lain-lain) tampil', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const rows = NeracaPage.flatten(body.data).filter((r) => !r.child);
        fx.rowsWajib.forEach((name) => {
          const found = NeracaPage.findRow(rows, name, { prefix: name === 'NPL' });
          expect(found, `baris "${name}" ada di Neraca`).to.exist;
        });
      });
      NeracaPage.waitTable(fx.table, all.timeout);
      NeracaPage.elements.parentRows().should('have.length.at.least', fx.rowsWajib.length);
    });

    it('TC-NRC-VIEW-005 | Positif | kolom Akun sesuai nomor akun PRD (110, 122, 123, 131 ... 900, 800)', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const rows = NeracaPage.flatten(body.data).filter((r) => !r.child);
        Object.entries(fx.norekPrd).forEach(([name, norek]) => {
          const r = NeracaPage.findRow(rows, name);
          expect(r, `baris "${name}"`).to.exist;
          expect(r.norek, `akun "${name}"`).to.eq(norek);
        });
      });
    });

    it('TC-NRC-VIEW-006 | Negatif | Giro Pada Bank tampil di bawah Penempatan Dana dengan akun 124', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const rows = NeracaPage.flatten(body.data);
        const giro = NeracaPage.findRow(rows, fx.giroLabel, { childOnly: true, parent: fx.giroParent });
        expect(giro, `"${fx.giroLabel}" adalah anak "${fx.giroParent}"`).to.exist;
        expect(giro.norek, `akun ${fx.giroLabel} sesuai PRD`).to.match(new RegExp(`${fx.giroNorekPrd}$`));
      });
    });
  });

  describe('Total & rumus', () => {
    it('TC-NRC-VIEW-007 | Positif | JUMLAH ASET = jumlah seluruh komponen aset (termasuk Giro Pada Bank)', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const rows = NeracaPage.flatten(body.data);
        const top = rows.filter((r) => !r.child);
        let expected = fx.komponenAset.reduce((s, n) => s + NeracaPage.valueOf(top, n), 0);
        const giro = NeracaPage.findRow(rows, fx.giroLabel, { childOnly: true, parent: fx.giroParent });
        if (giro) expected += toNum(giro.balance);
        const actual = NeracaPage.valueOf(top, fx.totalAset);
        expect(Math.abs(actual - expected), `JUMLAH ASET ${actual} vs Σ komponen ${expected}`).to.be.lte(fx.toleransi);
      });
    });

    it('TC-NRC-VIEW-008 | Positif | JUMLAH LIABILITAS, JUMLAH EKUITAS, dan JUMLAH LIABILITAS DAN EKUITAS sesuai penjumlahan komponennya', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const top = NeracaPage.flatten(body.data).filter((r) => !r.child);
        const sum = (names) => names.reduce((s, n) => s + NeracaPage.valueOf(top, n), 0);
        const liab = NeracaPage.valueOf(top, fx.totalLiabilitas);
        const ekuitas = NeracaPage.valueOf(top, fx.totalEkuitas);
        const le = NeracaPage.valueOf(top, fx.totalLiabilitasEkuitas);
        expect(Math.abs(liab - sum(fx.komponenLiabilitas)), 'JUMLAH LIABILITAS').to.be.lte(fx.toleransi);
        expect(Math.abs(ekuitas - sum(fx.komponenEkuitas)), 'JUMLAH EKUITAS').to.be.lte(fx.toleransi);
        expect(Math.abs(le - (liab + ekuitas)), 'JUMLAH LIABILITAS DAN EKUITAS').to.be.lte(fx.toleransi);
      });
    });

    it('TC-NRC-VIEW-009 | Edge | neraca seimbang: JUMLAH ASET = JUMLAH LIABILITAS DAN EKUITAS (Akumulasi, bulan berjalan)', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const top = NeracaPage.flatten(body.data).filter((r) => !r.child);
        const aset = NeracaPage.valueOf(top, fx.totalAset);
        const le = NeracaPage.valueOf(top, fx.totalLiabilitasEkuitas);
        expect(Math.abs(aset - le), `JUMLAH ASET ${aset} vs JUMLAH LIABILITAS DAN EKUITAS ${le}`).to.be.lte(fx.toleransi);
      });
    });

    it('TC-NRC-VIEW-010 | Edge | Saldo Laba (Rugi) Tahun Berjalan di Neraca = I. LABA (RUGI) TAHUN BERJALAN di Laba Rugi (periode & Akumulasi sama)', () => {
      const lr = all.labaRugi;
      NeracaPage.visit(fx);
      NeracaPage.waitData().then((body) => {
        const top = NeracaPage.flatten(body.data).filter((r) => !r.child);
        const labaNeraca = NeracaPage.valueOf(top, fx.labaBerjalan);
        LabaRugiPage.visit(lr);
        LabaRugiPage.waitData().then((lrBody) => {
          const lrTop = LabaRugiPage.flatten(lrBody.data).filter((r) => !r.child);
          const labaLr = LabaRugiPage.valueOf(lrTop, lr.rumus.labaBerjalan);
          expect(Math.abs(labaNeraca - labaLr), `Neraca ${labaNeraca} vs Laba Rugi ${labaLr}`).to.be.lte(fx.toleransi);
        });
      });
    });
  });

  describe('Filter', () => {
    it('TC-NRC-VIEW-011 | Positif | filter kantor: memilih satu kantor memuat ulang Neraca untuk kantor tsb', () => {
      NeracaPage.visit(fx);
      NeracaPage.assertUserPusat();
      NeracaPage.waitData();
      NeracaPage.selectFirstBranch(fx.akumulasiValue).then((branch) => {
        NeracaPage.waitForRequest('neraca', (i) => NeracaPage.qp(i, 'office') === branch.value).then((i) => {
          NeracaPage.expectDataTablesOk(i);
        });
        NeracaPage.waitTable(fx.table, all.timeout);
        NeracaPage.elements.parentRows().should('have.length.greaterThan', 0);
      });
    });

    it('TC-NRC-VIEW-012 | Positif | filter bulan: memilih bulan lalu memuat Neraca periode tsb (NPL akhir bulan)', () => {
      const prev = NeracaPage.previousMonth();
      const label = NeracaPage.monthLabel(prev);
      NeracaPage.visit(fx);
      NeracaPage.waitData();
      NeracaPage.setDateValue('#date', label);
      NeracaPage.waitForRequest('neraca', (i) => NeracaPage.qp(i, 'date') === label).then((i) => {
        const body = NeracaPage.expectDataTablesOk(i);
        const top = NeracaPage.flatten(body.data).filter((r) => !r.child);
        const npl = NeracaPage.findRow(top, 'NPL', { prefix: true });
        expect(npl, 'baris NPL').to.exist;
        const [mon, , yr] = label.split(' ');
        expect(npl.name, 'label NPL mengikuti periode terpilih').to.include(`${mon} ${yr}`);
      });
      NeracaPage.waitTable(fx.table, all.timeout);
    });
  });

  describe('Pencarian', () => {
    it('TC-NRC-VIEW-013 | Positif | search jenis data menampilkan baris yang dicari', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData();
      NeracaPage.waitTable(fx.table, all.timeout);
      NeracaPage.searchServer(fx.table, fx.searchKeyword);
      NeracaPage.waitForRequest('neraca', (i) => NeracaPage.qp(i, 'search[value]') === fx.searchKeyword);
      NeracaPage.waitTable(fx.table, all.timeout);
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

    it('TC-NRC-VIEW-014 | Negatif | search jenis data yang tidak ada menampilkan tabel kosong', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData();
      NeracaPage.waitTable(fx.table, all.timeout);
      NeracaPage.searchServer(fx.table, fx.searchNotFound);
      NeracaPage.waitForRequest('neraca', (i) => NeracaPage.qp(i, 'search[value]') === fx.searchNotFound);
      NeracaPage.emptyState(fx.table).should('be.visible');
      NeracaPage.dataRows(fx.table).should('have.length', 0);
    });
  });

  describe('Export', () => {
    it('TC-NRC-VIEW-015 | Positif | export CSV menghasilkan file CSV berisi header laporan', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData();
      NeracaPage.waitTable(fx.table, all.timeout);
      NeracaPage.spyBlobDownload().clickExport('csv').assertCsvExport(fx.csvHeaderCells);
    });

    it('TC-NRC-VIEW-016 | Positif | export Excel menghasilkan file xlsx', () => {
      NeracaPage.visit(fx);
      NeracaPage.waitData();
      NeracaPage.waitTable(fx.table, all.timeout);
      NeracaPage.spyBlobDownload().clickExport('excel').assertExcelExport();
    });
  });
});
