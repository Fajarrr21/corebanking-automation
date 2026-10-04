/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_TabelAngsuran.json
// PRD: "Tabel Angsuran Pinjaman" (acuan tunggal perhitungan & pembulatan angsuran).
// Read-only: simulasi angsuran via GET /installment/detail (endpoint form pengajuan, tanpa menyimpan apa pun),
// dokumen Jadwal Angsuran di tab Dokumen Pencairan, dan tab Jadwal Angsuran. Semua test memakai write-guard.
// Expected angka: kasus tests/Unit/FlatInstallmentScheduleTest.php, dihitung ulang sesuai aturan PRD
// (SEMUA total dibulatkan ke atas kelipatan 1.000 — source membatasi ke total < Rp 500.000).
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage, { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

/** Aturan PRD Tabel Angsuran: total baris 1..n-1 kelipatan K; pokok+bunga+simpanan = total; Σpokok = jumlah pinjaman. */
const assertAturanPembulatan = (rows, amount, kelipatan) => {
  expect(rows.length, 'jumlah baris angsuran').to.be.greaterThan(0);
  rows.forEach((r, i) => {
    expect(r.pokok + r.bunga + r.simpanan, `baris ${i + 1}: pokok+bunga+simpanan = total`).to.eq(r.total);
    if (rows.length > 1 && i < rows.length - 1) {
      expect(r.total % kelipatan, `baris ${i + 1}: total ${r.total} kelipatan ${kelipatan}`).to.eq(0);
    }
  });
  const sumPokok = rows.reduce((s, r) => s + r.pokok, 0);
  expect(Math.round(sumPokok), 'Σ pokok = jumlah pinjaman (tidak ada kelebihan/kekurangan)').to.eq(Math.round(amount));
};

describe('Nasabah - Pinjaman - Tabel Angsuran', () => {
  let fx;
  let monthly;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdBulanan, type: 'MONTHLY', dataPath: fx.paths.data, length: fx.data.scanLength, label: 'bulanan',
      }).then((l) => {
        monthly = l;
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

  /** GET simulasi tabel angsuran (dipakai tombol "Lihat Angsuran Lengkap"). */
  const simulate = (kasus) => {
    LoginPage.loginViaSession();
    const k = fx.installmentApi.kunci;
    return cy
      .request({ url: fx.paths.installmentDetail, qs: { ...kasus.query, draw: 1, start: 0, length: -1 }, timeout: fx.timeout.request })
      .then((res) => {
        expect(res.status).to.eq(200);
        return res.body.data.map((r) => ({
          ke: Number(r[k.ke]),
          pokok: Number(r[k.pokok]),
          bunga: Number(r[k.bunga]),
          simpanan: Number(r[k.simpanan]),
          total: Number(r[k.pokok]) + Number(r[k.bunga]) + Number(r[k.simpanan]),
        }));
      });
  };

  describe('Perhitungan & pembulatan (simulasi form pengajuan)', () => {
    it('TC-LOAN-JADWAL-001 | Positif | Total angsuran < Rp 500.000 dibulatkan ke atas kelipatan 1.000, selisih ke pokok, angsuran terakhir menyerap', () => {
      const c = fx.installmentApi.kasusKecil;
      simulate(c).then((rows) => {
        expect(rows[0].pokok, 'pokok baris 1').to.eq(c.pokokBaris1);
        expect(rows[0].total, 'total baris 1').to.eq(c.totalBaris1);
        expect(rows[rows.length - 1].pokok, 'pokok angsuran terakhir').to.eq(c.pokokTerakhir);
        assertAturanPembulatan(rows, c.totalPokok, fx.schedule.kelipatan);
      });
    });

    it('TC-LOAN-JADWAL-002 | Positif | Total angsuran >= Rp 500.000 tetap dibulatkan ke atas kelipatan 1.000 (berlaku sama untuk semua nominal)', () => {
      const c = fx.installmentApi.kasusBesar;
      simulate(c).then((rows) => {
        expect(rows[0].total, 'total baris 1').to.eq(c.totalBaris1);
        expect(rows[0].pokok, 'pokok baris 1').to.eq(c.pokokBaris1);
        expect(rows[rows.length - 1].pokok, 'pokok angsuran terakhir').to.eq(c.pokokTerakhir);
        assertAturanPembulatan(rows, c.totalPokok, fx.schedule.kelipatan);
      });
    });

    it('TC-LOAN-JADWAL-003 | Edge | Jangka waktu satu periode tidak dibulatkan sama sekali', () => {
      const c = fx.installmentApi.kasusSatuPeriode;
      simulate(c).then((rows) => {
        expect(rows, 'jumlah baris').to.have.length(1);
        expect(rows[0].pokok).to.eq(c.pokokBaris1);
        expect(rows[0].total).to.eq(c.totalBaris1);
      });
    });

    it('TC-LOAN-JADWAL-004 | Positif | Jumlah baris = jangka waktu dan nomor angsuran berurutan 1..n', () => {
      const c = fx.installmentApi.kasusKecil;
      simulate(c).then((rows) => {
        expect(rows).to.have.length(c.query.tenor);
        expect(rows.map((r) => r.ke)).to.deep.eq(Array.from({ length: c.query.tenor }, (v, i) => i + 1));
      });
    });
  });

  describe('Tab Jadwal Angsuran di detail pinjaman', () => {
    beforeEach(() => {
      LoanDetailPage.openDetail(fx.paths.detail, monthly.refId, 'detail-installment');
      LoanDetailPage.waitSchedule(fx.timeout.table);
    });

    it('TC-LOAN-JADWAL-005 | Happy | Tab Jadwal Angsuran memuat data tagihan dengan status baku', () => {
      cy.get('#tab_detail-installment').should('have.class', 'active');
      LoanDetailPage.dataRows(fx.schedule.tabTable).should('have.length.greaterThan', 0);
      LoanDetailPage.assertEveryRowColumn(5, (t) => fx.schedule.statusLabels.includes(t), 'Status', fx.schedule.tabTable);
    });

    it('TC-LOAN-JADWAL-006 | Negatif | Kolom tabel angsuran di detail pinjaman sama dengan tabel acuan (Angsuran Ke, Pokok, Bunga, Simpanan, Total)', () => {
      LoanDetailPage.tableHeaders(fx.schedule.tabTable).then(($th) => {
        const t = Cypress.$.makeArray($th).map((th) => norm(th.innerText));
        fx.schedule.prdTabHeaders.forEach((h) => expect(t, `kolom ${h}`).to.include(h));
      });
    });
  });

  describe('Dokumen Jadwal Angsuran (tab Dokumen Pencairan)', () => {
    beforeEach(() => {
      LoanDetailPage.openDetail(fx.paths.detail, monthly.refId, fx.spk.menu);
      LoanDetailPage.elements.subtab(fx.schedule.docSubtab).click();
      LoanDetailPage.elements.schedulePane().should('have.class', 'active');
    });

    it('TC-LOAN-JADWAL-007 | Happy | Dokumen menampilkan judul, header ringkasan (jumlah, bunga + satuan periode, tenor) dan kolom tabel', () => {
      LoanDetailPage.elements.schedulePane().should('contain.text', fx.schedule.docTitle).then(($p) => {
        const doc = LoanDetailPage.parseScheduleDoc($p);
        expect(doc.info).to.include(fx.schedule.docJumlahPrefix).and.include(fx.schedule.docBungaPrefix);
        expect(doc.info, 'bunga beserta satuan periode').to.match(new RegExp(fx.schedule.satuanBungaRegex));
        ['No', 'Pokok', 'Bunga', 'Total Angsuran'].forEach((h) => expect(doc.headers).to.include(h));
      });
    });

    it('TC-LOAN-JADWAL-008 | Positif | Baris dokumen mengikuti aturan pembulatan dan Σ pokok = jumlah pinjaman', () => {
      LoanDetailPage.elements.schedulePane().then(($p) => {
        const doc = LoanDetailPage.parseScheduleDoc($p);
        const amount = Number(String(doc.info.match(/Jumlah Pinjaman\s*:\s*Rp\s*([\d.]+)/)[1]).replace(/\./g, ''));
        assertAturanPembulatan(doc.rows, amount, fx.schedule.kelipatan);
      });
    });

    it('TC-LOAN-JADWAL-009 | Negatif | Footer tabel menjumlahkan kolom dan mengulang keterangan bunga yang sama dengan header', () => {
      LoanDetailPage.elements.schedulePane().then(($p) => {
        const doc = LoanDetailPage.parseScheduleDoc($p);
        expect(doc.hasFooter, 'tabel punya footer (tfoot) penjumlahan').to.eq(true);
        const bunga = doc.info.match(new RegExp(fx.schedule.satuanBungaRegex))[0];
        expect(norm(doc.$table.find('tfoot').text()), 'footer mengulang keterangan bunga header').to.include(bunga);
      });
    });

    it('TC-LOAN-JADWAL-010 | Negatif | Angsuran terakhir ditandai berbeda dan ada keterangan penyesuaian sisa kewajiban', () => {
      LoanDetailPage.elements.schedulePane().then(($p) => {
        const doc = LoanDetailPage.parseScheduleDoc($p);
        const $rows = doc.$table.find('tbody tr');
        const last = $rows.last();
        const prev = $rows.eq($rows.length - 2);
        const beda = (last.attr('class') || '') !== (prev.attr('class') || '') || (last.attr('style') || '') !== (prev.attr('style') || '');
        expect(beda, 'baris terakhir punya penanda berbeda').to.eq(true);
        expect(norm($p.text()), 'keterangan di bawah tabel').to.match(new RegExp(fx.schedule.footerKeteranganRegex, 'i'));
      });
    });

    it('TC-LOAN-JADWAL-011 | Positif | Hasil cetak Jadwal Angsuran berisi baris yang sama persis dengan preview', () => {
      LoanDetailPage.elements.schedulePane().then(($p) => {
        const preview = LoanDetailPage.parseScheduleDoc($p).rows.map((r) => r.cells.join('|'));
        LoanDetailPage.fetchHtml(fx.paths.printSchedule.replace('{refId}', monthly.refId), fx.timeout.request).then(($doc) => {
          const printed = LoanDetailPage.parseScheduleDoc($doc).rows.map((r) => r.cells.join('|'));
          expect(printed).to.deep.eq(preview);
        });
      });
    });

    it('TC-LOAN-JADWAL-012 | Positif | Unduh Excel Jadwal Angsuran mengembalikan berkas xlsx', () => {
      cy.request({ url: fx.paths.downloadSchedule.replace('{refId}', monthly.refId), encoding: 'binary', timeout: fx.timeout.request })
        .then((res) => {
          expect(res.status).to.eq(200);
          expect(String(res.headers['content-type'])).to.include('spreadsheetml');
          expect(String(res.headers['content-disposition'] || '')).to.include('.xlsx');
        });
    });

    it('TC-LOAN-JADWAL-013 | Positif | Angka dokumen sama persis dengan jadwal angsuran yang ditagihkan (LoanBill) — pinjaman mingguan', () => {
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdMingguan, type: 'WEEKLY', dataPath: fx.paths.data, length: fx.data.scanLength, label: 'mingguan',
      }).then((weekly) => {
        LoanDetailPage.fetchBills(weekly.refId, fx.timeout.request).then((bills) => {
          LoanDetailPage.openDetail(fx.paths.detail, weekly.refId, fx.spk.menu);
          LoanDetailPage.elements.subtab(fx.schedule.docSubtab).click();
          LoanDetailPage.elements.schedulePane().then(($p) => {
            const doc = LoanDetailPage.parseScheduleDoc($p);
            expect(doc.rows.length, 'jumlah baris = jumlah tagihan').to.eq(bills.length);
            doc.rows.forEach((r, i) => {
              expect([r.pokok, r.bunga, r.simpanan], `baris ${i + 1} (pokok, bunga, simpanan) = tagihan`).to.deep.eq([
                bills[i].pokok, bills[i].bunga, bills[i].simpanan,
              ]);
            });
          });
        });
      });
    });
  });
});
