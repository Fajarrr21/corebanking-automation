/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Riwayat.json
// PRD: "Riwayat Transaksi Pinjaman". Read-only: export PDF/Excel & struk = GET (cy.request), write-guard aktif.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage, { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

/** "dd/mm/yyyy HH:MM" → epoch ms. */
const parseTgl = (s) => {
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : NaN;
};

describe('Nasabah - Pinjaman - Riwayat Transaksi', () => {
  let fx;
  let loan;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdDenganAngsuran, withPayment: true, dataPath: fx.paths.data, length: fx.data.scanLength, label: 'yang sudah ada angsurannya',
      }).then((l) => {
        loan = l;
      });
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

  describe('Tab riwayat di detail pinjaman', () => {
    beforeEach(() => {
      LoanDetailPage.openDetail(fx.paths.detail, loan.refId, 'history');
      LoanDetailPage.waitHistory(fx.timeout.table);
    });

    it('TC-LOAN-RIWAYAT-001 | Happy | Tab riwayat terbuka dan memuat transaksi pinjaman', () => {
      cy.get('#tab_history').should('have.class', 'active');
      LoanDetailPage.dataRows(fx.history.table).should('have.length.greaterThan', 0);
    });

    it('TC-LOAN-RIWAYAT-002 | Negatif | Nama tab adalah "Riwayat Transaksi"', () => {
      LoanDetailPage.navLabels().should('include', fx.detail.tabs.riwayatPrd);
    });

    it('TC-LOAN-RIWAYAT-003 | Negatif | Kolom riwayat sesuai PRD (tanggal, jenis, angsuran ke, pokok, bunga, simpanan, jumlah, keterangan, dibuat oleh)', () => {
      LoanDetailPage.tableHeaders(fx.history.table).then(($th) => {
        const t = Cypress.$.makeArray($th).map((th) => norm(th.innerText));
        fx.history.headersPrd
          .filter((h) => h !== 'Angsuran Simpanan' || loan.saving > 0)
          .forEach((h) => expect(t, `kolom ${h}`).to.include(h));
      });
    });

    it('TC-LOAN-RIWAYAT-004 | Negatif | Riwayat diurutkan dari transaksi terlama di posisi teratas', () => {
      LoanListPage.columnTexts(fx.history.colTanggal, fx.history.table).then((tgl) => {
        expect(tgl.length, 'precondition: minimal 2 transaksi').to.be.greaterThan(1);
        const ts = tgl.map(parseTgl);
        for (let i = 1; i < ts.length; i += 1) {
          expect(ts[i], `baris ${i + 1} (${tgl[i]}) tidak lebih lama dari baris ${i} (${tgl[i - 1]})`).to.be.at.least(ts[i - 1]);
        }
      });
    });

    it('TC-LOAN-RIWAYAT-005 | Positif | Transaksi pencairan berlabel "Pencairan", tidak ada istilah WD', () => {
      LoanListPage.columnTexts(fx.history.colTipe, fx.history.table).then((tipe) => {
        fx.history.labelTerlarang.forEach((x) => expect(tipe, `tidak ada label ${x}`).not.to.include(x));
      });
      cy.request({ url: fx.paths.history.replace('{refId}', loan.refId), qs: { draw: 1, start: 0, length: -1 } }).then((res) => {
        const types = res.body.data.map((r) => r.type);
        expect(types, 'ada transaksi Pencairan').to.include(fx.history.labelPencairan);
        fx.history.labelTerlarang.forEach((x) => expect(types).not.to.include(x));
      });
    });

    it('TC-LOAN-RIWAYAT-006 | Negatif | Footer menjumlahkan kolom tanpa Pencairan dan menampilkan keterangannya', () => {
      cy.get(`${fx.history.table} tfoot tr`).should('have.length.greaterThan', 0);
      cy.get('#tab_history').invoke('text').should('match', new RegExp(fx.history.footerKeteranganRegex, 'i'));
    });

    it('TC-LOAN-RIWAYAT-007 | Negatif | Tersedia filter rentang tanggal dan jenis transaksi', () => {
      cy.get('body').then(($b) => {
        expect($b.find(fx.history.filterTanggalSel).filter(':visible').length, 'filter rentang tanggal').to.be.greaterThan(0);
        expect($b.find(fx.history.filterJenisSel).filter(':visible').length, 'filter jenis transaksi').to.be.greaterThan(0);
      });
    });

    it('TC-LOAN-RIWAYAT-008 | Positif | Cetak riwayat menghasilkan berkas PDF', () => {
      const pdf = fx.paths.historyPdf.replace('{refId}', loan.refId);
      LoanDetailPage.elements.historyExportBtn(fx.history.btnPdf).should('have.attr', 'href').and('include', pdf);
      cy.request({ url: pdf, encoding: 'binary', timeout: fx.timeout.request }).then((res) => {
        expect(res.status).to.eq(200);
        expect(String(res.headers['content-type'])).to.include(fx.history.pdfContentType);
        expect(res.body.slice(0, 4), 'signature %PDF').to.eq('%PDF');
      });
    });

    it('TC-LOAN-RIWAYAT-009 | Positif | Export riwayat ke Excel menghasilkan berkas xlsx', () => {
      const xls = fx.paths.historyExcel.replace('{refId}', loan.refId);
      LoanDetailPage.elements.historyExportBtn(fx.history.btnExcel).should('have.attr', 'href').and('include', xls);
      cy.request({ url: xls, encoding: 'binary', timeout: fx.timeout.request }).then((res) => {
        expect(res.status).to.eq(200);
        expect(String(res.headers['content-type'])).to.include(fx.history.excelContentType);
      });
    });

    it('TC-LOAN-RIWAYAT-010 | Positif | Tombol Lihat pada baris membuka struk transaksi yang valid', () => {
      LoanDetailPage.stubWindowOpen();
      cy.get(`${fx.history.table} tbody tr`).first().find('.detail-btn').click();
      LoanDetailPage.lastOpenedUrl().then((url) => {
        expect(url).to.match(new RegExp(`/loan/${loan.refId}/\\d+/print_history$`));
        LoanDetailPage.fetchHtml(url, fx.timeout.request);
      });
    });
  });

  describe('Pinjaman lunas', () => {
    it('TC-LOAN-RIWAYAT-011 | Positif | Riwayat transaksi tetap dapat dibuka untuk pinjaman yang sudah lunas', () => {
      LoginPage.loginViaSession();
      const today = new Date().toISOString().slice(0, 10);
      const pick = fx.data.refIdLunas
        ? cy.wrap(fx.data.refIdLunas)
        : cy.request({
          url: fx.paths.dataPaid,
          qs: { date: fx.data.paidDateFrom, date2: today, office_id: 0, type: 'ALL', draw: 1, start: 0, length: 10 },
          timeout: fx.timeout.request,
        }).then((res) => {
          const row = (res.body.data || []).find((r) => r.account && r.account.ref_id);
          expect(row, 'precondition: ada pinjaman lunas (atau isi data.refIdLunas)').to.exist;
          return row.account.ref_id;
        });
      pick.then((refId) => {
        LoanDetailPage.openDetail(fx.paths.detail, refId, 'history');
        LoanDetailPage.waitHistory(fx.timeout.table);
        LoanDetailPage.dataRows(fx.history.table).should('have.length.greaterThan', 0);
      });
    });
  });
});
