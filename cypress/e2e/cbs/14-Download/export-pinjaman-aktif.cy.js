/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import DownloadPage from '../../../support/pageobjects/Download/DownloadPage';
import PinjamanAktifExportPage from '../../../support/pageobjects/Download/PinjamanAktifExportPage';

// Export Pinjaman Aktif → antrean → Download (PRD "Download Pinjaman Aktif",
// "BKDP Download Pinjaman Aktif", "BKDP - Laporan Nominatif").
//
// EFEK SAMPING (dijelaskan, dianggap aman): klik "Export Excel" = GET /export/loan
// yang MEMBUAT 1 baris tabel downloads (status SCHEDULED) + 1 job antrean DownloadJob
// yang menulis file xlsx ke S3. TIDAK mengubah data keuangan/nasabah; baris &
// file otomatis dihapus server sesuai `deleted_time`. Tidak ada POST → write-guard
// tetap aktif tanpa allow (GET tidak diblok guard).
//
// TC berurutan: 001 membuat export, 002–005 memakai file yang sama (satu export
// per run, supaya tidak membanjiri antrean). Bila 001 gagal, 002–005 gagal dengan
// pesan jelas.

describe('Download - Export Pinjaman Aktif (Laporan Nominatif)', () => {
  let fx;
  const ctx = { maxIdBefore: null, file: null, row: null };

  before(() => {
    cy.fixture('download/download').then((d) => {
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

  const needExport = () =>
    cy.then(() => {
      expect(ctx.file, 'butuh hasil TC-DL-EXPORT-001/002 (file export dari run ini)').to.be.a('string');
    });

  it('TC-DL-EXPORT-001 | Happy | Export Excel di Pinjaman Aktif memasukkan file ke antrean dengan notifikasi', () => {
    const ex = fx.exportLoan;
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      ctx.maxIdBefore = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    });
    PinjamanAktifExportPage.visit(ex);
    PinjamanAktifExportPage.clickExport(ex);
    cy.wait('@exportLoan', { timeout: fx.timeout }).its('response.statusCode').should('be.oneOf', [301, 302, 303]);
    cy.location('pathname').should('eq', ex.loanPath);
    PinjamanAktifExportPage.assertSuccess(ex.suksesAlert);
  });

  it('TC-DL-EXPORT-002 | Positif | file export baru tampil di Download dengan nama Daftar-Pinjaman-<tanggal>.xlsx', () => {
    const ex = fx.exportLoan;
    cy.then(() => expect(ctx.maxIdBefore, 'butuh TC-DL-EXPORT-001').to.be.a('number'));
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      const baru = rows
        .filter((r) => Number(r.id) > ctx.maxIdBefore && r.file.startsWith(ex.prefixFile))
        .sort((a, b) => Number(b.id) - Number(a.id));
      expect(baru.length, 'file export Pinjaman baru di daftar Download').to.be.greaterThan(0);
      const r = baru[0];
      expect(r.file, 'format nama file').to.match(new RegExp(fx.formatNamaFile));
      expect(fx.statusSemuaLabel, `status awal "${r.status}"`).to.include(r.status);
      ctx.file = r.file;
    });
  });

  it('TC-DL-EXPORT-003 | Positif | file export selesai diproses dan dapat diunduh sebagai Excel', () => {
    needExport();
    DownloadPage.visit(fx);
    cy.then(() => DownloadPage.waitStatus(fx, ctx.file, fx.statusPrd.selesai, fx.exportLoan.tungguSelesaiMs)).then((row) => {
      expect(row.href, 'tautan unduh').to.be.a('string');
      ctx.row = row;
      cy.request({ url: row.href, encoding: 'binary', timeout: fx.timeout }).then((res) => {
        expect(res.status).to.eq(200);
        const ct = String(res.headers['content-type'] || '');
        expect(fx.xlsxContentTypes.some((t) => ct.includes(t)), `content-type (${ct})`).to.eq(true);
        expect(String(res.body).slice(0, 2), 'signature xlsx').to.eq('PK');
      });
    });
  });

  it('TC-DL-EXPORT-004 | Positif | file memuat seluruh kolom Laporan Nominatif PRD', () => {
    needExport();
    cy.then(() => expect(ctx.row, 'butuh TC-DL-EXPORT-003 (file Selesai)').to.exist);
    DownloadPage.visit(fx);
    cy.then(() => cy.request({ url: ctx.row.href, encoding: 'binary', timeout: fx.timeout })).then((res) => {
      DownloadPage.readXlsxHeader(res.body).then((headers) => {
        const norm = headers.map((h) => String(h).replace(/\s+/g, ' ').trim().toLowerCase());
        fx.kolomNominatifPrd.forEach((k) => {
          const ok = k.kunci.some((alias) => norm.includes(alias.toLowerCase()));
          expect(ok, `kolom PRD "${k.prd}" (alias: ${k.kunci.join(' / ')})`).to.eq(true);
        });
      });
    });
  });

  it('TC-DL-EXPORT-005 | Positif | header file export sama persis & berurutan dengan 33 kolom PRD Download Pinjaman Aktif', () => {
    needExport();
    cy.then(() => expect(ctx.row, 'butuh TC-DL-EXPORT-003 (file Selesai)').to.exist);
    DownloadPage.visit(fx);
    cy.then(() => cy.request({ url: ctx.row.href, encoding: 'binary', timeout: fx.timeout })).then((res) => {
      DownloadPage.readXlsxHeader(res.body).then((headers) => {
        const actual = headers.map((h) => String(h).replace(/\s+/g, ' ').trim());
        expect(actual).to.deep.eq(fx.kolomDownloadPinjamanPrd);
      });
    });
  });
});
