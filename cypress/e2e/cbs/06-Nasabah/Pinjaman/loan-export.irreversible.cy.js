/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Export.json
// PRD: "Download Pinjaman Aktif" & "BKDP Download Pinjaman Aktif".
// ⚠️ Export = GET /export/loan yang MENULIS data (baris tabel downloads + job antrian DownloadJob yang membuat
// berkas di storage). Tidak ada fitur hapus manual; server menghapus sendiri setelah jadwal hapus. Karena
// write-guard tidak memblok GET, spec ini dibungkus describeIfFlag('allowLoanExport') → default di-skip.
// Jalankan: npx cypress run --spec "cypress/e2e/cbs/06-Nasabah/Pinjaman/loan-export.irreversible.cy.js" --env allowLoanExport=true
import { describeIfFlag } from '../../../../support/utils/flags';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

const ddmmyyyy = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

describeIfFlag('allowLoanExport', 'Nasabah - Pinjaman - Export Pinjaman Aktif', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
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

  const exportNow = () => {
    LoanListPage.openList(fx.paths.list, fx.paths.data, fx.list.table, fx.timeout.table);
    cy.intercept('GET', new RegExp(`${fx.paths.exportLoan.replace(/\//g, '\\/')}\\?`)).as('export');
    LoanListPage.elements.exportBtn(fx.list.btnExport).click();
    cy.wait('@export', { timeout: fx.timeout.request }).then((i) => {
      expect(i.request.url).to.include('product=').and.include('status=');
    });
    cy.location('pathname').should('eq', fx.paths.list);
  };

  it('TC-LOAN-EXPORT-001 | Happy | Export Excel pinjaman aktif masuk antrian dan menampilkan pesan sesuai PRD', () => {
    exportNow();
    LoanListPage.assertSuccess(fx.export.alertKunci);
    LoanListPage.common.alertSuccess().invoke('text').then((t) => expect(norm(t)).to.include(fx.export.alertPrd));
  });

  it('TC-LOAN-EXPORT-002 | Positif | Halaman Download menampilkan berkas Daftar-Pinjaman dengan format nama & status sesuai PRD', () => {
    exportNow();
    LoanListPage.open(fx.paths.downloads);
    cy.get(`${fx.export.downloadsTable} tbody tr`).first().find('td').then(($td) => {
      const file = norm($td.eq(fx.export.colFile).text());
      const status = norm($td.eq(fx.export.colStatus).text()).replace(/lihat detail/i, '').trim();
      expect(file, 'nama berkas').to.match(new RegExp(fx.export.fileRegex));
      expect(fx.export.statusPrd, `status "${status}"`).to.include(status);
    });
  });

  it('TC-LOAN-EXPORT-003 | Negatif | Jadwal hapus berkas = 7 hari dari tanggal export', () => {
    exportNow();
    LoanListPage.open(fx.paths.downloads);
    const exp = new Date();
    exp.setDate(exp.getDate() + fx.export.jadwalHapusHari);
    cy.get(`${fx.export.downloadsTable} tbody tr`).first().find('td').eq(fx.export.colJadwalHapus)
      .invoke('text').then((t) => expect(norm(t)).to.eq(ddmmyyyy(exp)));
  });
});
