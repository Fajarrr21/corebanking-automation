// Import > Upload Neraca (/import/neraca) — halaman, template, struktur form, validasi file (server).
// TC sumber: docs/test-cases/src/TC_Import_Neraca.json
// Read-only: write-guard aktif. TC 004/005 mengizinkan POST endpoint import karena
// controller menolak (ekstensi / file kosong) SEBELUM Excel::import -> tanpa data baru.
import LoginPage from '../../../support/pageobjects/LoginPage';
import ImportPage from '../../../support/pageobjects/Import/ImportPage';

describe('Import - Upload Neraca (/import/neraca)', () => {
  let fx;
  let pg;

  before(() => {
    cy.fixture('import/import').then((d) => {
      fx = d;
      pg = d.pages.neraca;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-IMP-NRC-001 | Happy | Halaman Upload Neraca tampil', () => {
    ImportPage.scenarioPage(pg, fx);
  });

  it('TC-IMP-NRC-002 | Positif | Download template Excel', () => {
    ImportPage.scenarioTemplate(pg, fx);
  });

  it('TC-IMP-NRC-003 | Positif | Struktur form upload', () => {
    ImportPage.scenarioForm(pg, fx);
  });

  it('TC-IMP-NRC-004 | Negatif | Upload file selain Excel', () => {
    ImportPage.scenarioWrongType(pg, fx);
  });

  it('TC-IMP-NRC-005 | Negatif | Proses tanpa file', () => {
    ImportPage.scenarioEmpty(pg, fx);
  });
});
