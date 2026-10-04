// Import — PROSES IMPORT SUNGGUHAN (TIDAK BISA DIBATALKAN: CIF/rekening/saldo GL tercipta).
// TC sumber: docs/test-cases/src/TC_Import_Proses.json
//
// Default TIDAK jalan. Jalankan dengan --env allowImport=true.
// Precondition: file data uji QA disiapkan manual (tidak di-commit otomatis):
//   cypress/fixtures/import/data/qa-import-cif.xlsx      (nama nasabah diawali "QA")
//   cypress/fixtures/import/data/qa-import-saving.xlsx   (NIK milik CIF QA)
//   cypress/fixtures/import/data/qa-import-loan.xlsx     (NIK milik CIF QA)
//   cypress/fixtures/import/data/qa-import-neraca.xlsx   (!! menimpa saldo GL — hanya di staging terisolasi)
// File tidak ada -> cy.fixture gagal dengan pesan file tidak ditemukan.
import LoginPage from '../../../support/pageobjects/LoginPage';
import ImportPage from '../../../support/pageobjects/Import/ImportPage';
import { describeIfFlag } from '../../../support/utils/flags';

describeIfFlag('allowImport', 'Import - Proses import data (irreversible)', () => {
  let fx;

  before(() => {
    cy.fixture('import/import').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
  });

  const runImport = (key) => {
    const pg = fx.pages[key];
    cy.fixture(pg.dataFile, null).then((buf) => {
      ImportPage.openGuarded(pg.path, fx.roleHint);
      ImportPage.elements.fileInput().selectFile(
        { contents: buf, fileName: pg.dataFile.split('/').pop() },
        { force: true },
      );
      ImportPage.submit();
      cy.location('pathname', { timeout: 60000 }).should('eq', pg.successPath);
      ImportPage.assertSuccess(pg.successMessage);
    });
  };

  it('TC-IMP-PROSES-001 | Happy | Import CIF valid membuat CIF dan diarahkan ke daftar CIF', () => runImport('cif'));
  it('TC-IMP-PROSES-002 | Happy | Import Tabungan valid diarahkan ke Approval dengan pesan sukses', () => runImport('saving'));
  it('TC-IMP-PROSES-003 | Happy | Import Pinjaman valid masuk antrian dan diarahkan ke Approval', () => runImport('loan'));
  it('TC-IMP-PROSES-004 | Happy | Import Neraca valid diarahkan ke laporan General Ledger', () => runImport('neraca'));
});
