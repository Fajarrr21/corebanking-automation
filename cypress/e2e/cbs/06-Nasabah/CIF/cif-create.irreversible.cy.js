// CIF Nasabah — pembuatan CIF SUNGGUHAN (TIDAK BISA DIHAPUS: CIF tidak punya fitur hapus).
// Hanya jalan dengan --env allowCreateCif=true. Data uji bernama QA<timestamp><seq>
// dan NIK diawali "99" (lihat fixture) supaya mudah dikenali/dibersihkan manual oleh DBA.
// TC sumber: docs/test-cases/src/TC_CIF_Create.json
//
// Precondition: akun test = user CABANG (office_id != 0). Bila user pusat, CIF akan
// tercipta dengan office_id 0 — spec gagal lebih dulu dengan pesan jelas.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifFormPage from '../../../../support/pageobjects/Nasabah/CifFormPage';
import CifDetailPage from '../../../../support/pageobjects/Nasabah/CifDetailPage';
import { describeIfFlag } from '../../../../support/utils/flags';

describeIfFlag('allowCreateCif', 'Nasabah - CIF - Buat CIF (irreversible)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      fx = d;
    });
  });

  const dataFor = (name, overrides = {}) => ({
    nik: CifFormPage.generateNik(fx.testData.nikPrefix),
    name,
    placeOfBirth: fx.testData.placeOfBirth,
    dateOfBirth: fx.testData.dateOfBirth,
    gender: fx.testData.gender,
    address: fx.testData.address,
    provinceText: fx.testData.provinceText,
    occupation: fx.testData.occupation,
    annualIncome: fx.testData.annualIncome,
    marital: fx.testData.maritalSingle,
    motherName: fx.testData.motherName,
    phone: fx.testData.validPhone,
    ...overrides,
  });

  const assertUserCabang = () => {
    CifListPage.visitList(fx.paths.list, fx.timeout);
    CifListPage.isUserPusat().then((pusat) => {
      if (pusat) {
        throw new Error('Precondition tidak terpenuhi: akun test = user pusat (office_id 0). Buat CIF butuh akun cabang.');
      }
    });
  };

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    assertUserCabang();
  });

  it('TC-CIF-CREATE-016 | Happy | Buat CIF lengkap tersimpan dan Nomor HP tampil di detail', () => {
    cy.qaName().then((name) => {
      const d = dataFor(name);
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.fillValid(d).submit();
      cy.location('pathname', { timeout: fx.timeout }).should('match', /^\/cif\/[^/]+$/).and('not.eq', fx.paths.create);
      CifDetailPage.assertSuccess(fx.form.messages.createSuccess);
      CifDetailPage.fieldValue('Nama Lengkap').should('eq', d.name);
      CifDetailPage.fieldValue('NIK').should('eq', d.nik);
      CifDetailPage.fieldValue(fx.form.phoneLabel).should('eq', d.phone);
      CifDetailPage.fieldValue('Tempat Lahir').should('eq', d.placeOfBirth);
      CifDetailPage.fieldValue('Alamat Lengkap').should('eq', d.address);
    });
  });

  it('TC-CIF-CREATE-017 | Positif | CIF baru muncul di list CIF', () => {
    cy.qaName().then((name) => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.fillValid(dataFor(name)).submit();
      cy.location('pathname', { timeout: fx.timeout }).should('not.eq', fx.paths.create);
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.search(name, fx.timeout);
      CifListPage.dataRows(CifListPage.table).should('have.length', 1);
      CifListPage.assertEveryRowColumn(fx.list.col.name, (t) => t === name, 'Nama', CifListPage.table);
    });
  });

  it('TC-CIF-CREATE-018 | Negatif | Buat CIF tanpa Nomor HP ditolak', () => {
    // Perilaku benar (PRD): Nomor HP wajib → ditolak. Bila sistem menerima, CIF QA
    // tanpa HP tercipta (nama QA..., tidak bisa dihapus) dan test gagal = kandidat bug.
    cy.qaName().then((name) => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.elements.input('phone').invoke('removeAttr', 'required');
      CifFormPage.fillValid(dataFor(name, { phone: '' })).submit();
      cy.location('pathname', { timeout: fx.timeout }).should('eq', fx.paths.create);
      CifFormPage.elements.fieldError('phone').should('be.visible');
    });
  });

  it('TC-CIF-CREATE-019 | Positif | Nomor HP berawalan +62 diterima', () => {
    cy.qaName().then((name) => {
      const d = dataFor(name, { phone: '+6281234567890' });
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.fillValid(d).submit();
      cy.location('pathname', { timeout: fx.timeout }).should('not.eq', fx.paths.create);
      CifDetailPage.assertSuccess(fx.form.messages.createSuccess);
      CifDetailPage.fieldValue(fx.form.phoneLabel).should('eq', d.phone);
    });
  });

  it('TC-CIF-CREATE-020 | Negatif | Server menolak Tanggal Lahir di masa depan', () => {
    // Bila server menerima, CIF QA bertanggal lahir masa depan tercipta = kandidat bug.
    cy.qaName().then((name) => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.fillValid(dataFor(name, { dateOfBirth: fx.testData.futureDateOfBirth })).submit();
      cy.location('pathname', { timeout: fx.timeout }).should('eq', fx.paths.create);
      CifFormPage.elements.fieldError('date_of_birth').should('be.visible');
    });
  });
});
