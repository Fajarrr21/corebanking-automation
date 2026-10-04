/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import DownloadPage from '../../../support/pageobjects/Download/DownloadPage';

// Download (/downloads) — daftar file hasil export antrean (PRD "Download Pinjaman Aktif").
// READ-ONLY: hanya membaca daftar & mengunduh file (GET). Write-guard aktif tanpa allow.
// Data bergantung staging: tiap TC yang butuh baris tertentu menyebut precondition
// dan GAGAL dengan pesan jelas bila tidak terpenuhi (bukan lulus diam-diam).

describe('Download - Daftar file', () => {
  let fx;

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

  const fileUrl = (id) => fx.fileDownloadPath.replace('{id}', id);

  it('TC-DL-LIST-001 | Happy | membuka halaman Download lewat menu sidebar', () => {
    cy.visit('/home');
    cy.contains('ul.page-sidebar-menu span.title', new RegExp(`^\\s*${fx.menuLabel}\\s*$`)).click();
    cy.location('pathname').should('eq', fx.path);
    DownloadPage.assertBreadcrumb(fx.breadcrumb);
    DownloadPage.elements.table().should('be.visible');
  });

  it('TC-DL-LIST-002 | Positif | informasi Download File menjelaskan antrean & retensi 7 hari', () => {
    DownloadPage.visit(fx);
    DownloadPage.elements.note().should('contain.text', fx.noteTitle);
    fx.noteDeskripsi.forEach((t) => DownloadPage.elements.note().should('contain.text', t));
  });

  it('TC-DL-LIST-003 | Positif | tabel memuat kolom PRD: ID, File, Jadwal Hapus, Status', () => {
    DownloadPage.visit(fx);
    DownloadPage.tableHeaders('#data-table2').should(($th) => {
      const actual = Cypress.$.makeArray($th).map((th) => th.innerText.replace(/\s+/g, ' ').trim());
      fx.headersPrd.forEach((h) => expect(actual, `kolom "${h}"`).to.include(h));
      expect(actual, 'urutan kolom (source)').to.deep.eq(fx.headersSource);
    });
  });

  it('TC-DL-LIST-004 | Positif | status setiap file hanya Diproses, Selesai, atau Gagal', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      expect(rows.length, 'Precondition: minimal satu file di daftar Download').to.be.greaterThan(0);
      const allowed = Object.values(fx.statusPrd);
      rows.forEach((r) => expect(allowed, `status file #${r.id} "${r.status}"`).to.include(r.status));
    });
  });

  it('TC-DL-LIST-005 | Positif | file Selesai berupa tautan unduh, file Diproses/Gagal tidak bisa diklik', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      expect(rows.length, 'Precondition: minimal satu file di daftar Download').to.be.greaterThan(0);
      rows.forEach((r) => {
        if (r.status === fx.statusPrd.selesai) {
          expect(r.href, `file #${r.id} Selesai punya tautan`).to.match(new RegExp(`${fileUrl(r.id)}$`));
        } else {
          expect(r.href, `file #${r.id} (${r.status}) tanpa tautan`).to.eq(null);
        }
      });
    });
  });

  it('TC-DL-LIST-006 | Edge | nama file export berformat <Nama-Data>-YYYY-MM-DD HH:MM:SS.xlsx', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      const exportRows = rows.filter((r) => !new RegExp(fx.formatNamaFileAi).test(r.file));
      expect(exportRows.length, 'Precondition: minimal satu file export (non Laporan AI)').to.be.greaterThan(0);
      exportRows.forEach((r) => expect(r.file, `nama file #${r.id}`).to.match(new RegExp(fx.formatNamaFile)));
    });
  });

  it('TC-DL-LIST-007 | Negatif | jadwal hapus = 7 hari setelah tanggal export', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      expect(rows.length, 'Precondition: minimal satu file di daftar Download').to.be.greaterThan(0);
      rows.forEach((r) => {
        const dibuat = DownloadPage.parseDmy(r.dibuat);
        const hapus = DownloadPage.parseDmy(r.jadwalHapus);
        expect(dibuat && hapus, `tanggal file #${r.id} terbaca (${r.dibuat} / ${r.jadwalHapus})`).to.be.ok;
        expect(DownloadPage.daysBetween(dibuat, hapus), `jarak jadwal hapus file #${r.id}`).to.eq(fx.retensiHari);
      });
    });
  });

  it('TC-DL-LIST-008 | Positif | mengunduh file berstatus Selesai menghasilkan file Excel', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      const done = rows.filter((r) => r.status === fx.statusPrd.selesai && r.href);
      expect(done.length, 'Precondition: minimal satu file berstatus Selesai di /downloads').to.be.greaterThan(0);
      const target = done.sort((a, b) => Number(b.id) - Number(a.id))[0];
      cy.request({ url: target.href, encoding: 'binary', timeout: fx.timeout }).then((res) => {
        expect(res.status, 'status unduh').to.eq(200);
        const ct = String(res.headers['content-type'] || '');
        expect(
          fx.xlsxContentTypes.some((t) => ct.includes(t)),
          `content-type file (${ct})`,
        ).to.eq(true);
        expect(String(res.body).slice(0, 2), 'signature xlsx (zip)').to.eq('PK');
      });
    });
  });

  it('TC-DL-LIST-009 | Negatif | file yang belum Selesai tidak dapat diunduh lewat URL langsung', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      const notDone = rows.find((r) => r.status !== fx.statusPrd.selesai);
      if (notDone) {
        cy.log(`File #${notDone.id} berstatus ${notDone.status} → coba unduh langsung`);
        cy.request({ url: fileUrl(notDone.id), failOnStatusCode: false }).its('status').should('eq', 404);
      } else {
        // Kemungkinan kedua (eksplisit): tidak ada file non-Selesai di staging →
        // TC dinyatakan tidak dapat dieksekusi, bukan lulus.
        throw new Error('Precondition tidak terpenuhi: tidak ada file berstatus Diproses/Gagal di /downloads');
      }
    });
  });

  it('TC-DL-LIST-010 | Negatif | mengunduh ID file yang tidak ada menghasilkan 404', () => {
    DownloadPage.visit(fx);
    DownloadPage.allRows(fx).then((rows) => {
      const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      cy.request({ url: fileUrl(maxId + 100000), failOnStatusCode: false }).its('status').should('eq', 404);
    });
  });
});
