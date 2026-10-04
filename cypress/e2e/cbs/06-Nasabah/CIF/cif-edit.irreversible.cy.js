// CIF Nasabah — Edit CIF SUNGGUHAN. Hanya menyentuh CIF yang dibuat test ini sendiri
// (nama QA<timestamp><seq>), karena perlu membuat CIF dulu dan CIF tidak bisa dihapus,
// spec ini di-gate flag allowCreateCif (--env allowCreateCif=true).
// TC sumber: docs/test-cases/src/TC_CIF_Edit.json
//
// Precondition: akun test = user CABANG (office_id != 0); editSaving hanya menemukan CIF
// yang office_id-nya sama dengan kantor user.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifFormPage from '../../../../support/pageobjects/Nasabah/CifFormPage';
import CifDetailPage from '../../../../support/pageobjects/Nasabah/CifDetailPage';
import { describeIfFlag } from '../../../../support/utils/flags';

describeIfFlag('allowCreateCif', 'Nasabah - CIF - Edit CIF milik test (irreversible)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      fx = d;
    });
  });

  /** Buat CIF QA baru; yield { code, name, nik }. */
  const createQaCif = () =>
    cy.qaName().then((name) => {
      const nik = CifFormPage.generateNik(fx.testData.nikPrefix);
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.fillValid({
        nik,
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
      }).submit();
      cy.location('pathname', { timeout: fx.timeout }).should('match', /^\/cif\/[^/]+$/).and('not.eq', fx.paths.create);
      return cy.location('pathname').then((p) => {
        const code = p.split('/').pop();
        return cy.then(() => ({ code, name, nik }));
      });
    });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    CifListPage.visitList(fx.paths.list, fx.timeout);
    CifListPage.isUserPusat().then((pusat) => {
      if (pusat) throw new Error('Precondition tidak terpenuhi: akun test = user pusat (office_id 0). Edit CIF butuh akun cabang.');
    });
  });

  it('TC-CIF-EDIT-009 | Happy | Ubah Nama dan Nomor HP CIF milik test tersimpan', () => {
    createQaCif().then((c) => {
      expect(c.name.startsWith('QA'), 'hanya CIF milik test (QA...) yang boleh diubah').to.eq(true);
      const newName = `${c.name}${fx.testData.editSuffix}`;
      CifFormPage.visitEdit(c.code, fx.timeout);
      CifFormPage.typeField('name', newName);
      CifFormPage.typeField('phone', fx.testData.editedPhone);
      CifFormPage.submit();
      cy.location('pathname', { timeout: fx.timeout }).should('eq', `${fx.paths.detail}${c.code}`);
      CifDetailPage.assertSuccess(fx.form.messages.editSuccess);
      CifDetailPage.fieldValue('Nama Lengkap').should('eq', newName);
      CifDetailPage.fieldValue(fx.form.phoneLabel).should('eq', fx.testData.editedPhone);
      CifDetailPage.fieldValue('NIK').should('eq', c.nik);
    });
  });

  it('TC-CIF-EDIT-010 | Negatif | Ubah NIK menjadi NIK nasabah lain ditolak dan data tidak berubah', () => {
    CifListPage.firstRowData(fx.list.col).then((other) => {
      createQaCif().then((c) => {
        expect(other.code, 'NIK pembanding milik CIF lain').not.to.eq(c.code);
        CifFormPage.visitEdit(c.code, fx.timeout);
        CifFormPage.typeField('nik', other.nik);
        CifFormPage.submit();
        cy.location('pathname', { timeout: fx.timeout }).should('eq', `${fx.paths.detail}${c.code}`);
        CifDetailPage.assertError(fx.form.messages.nikUsedOnEdit);
        CifDetailPage.visitDetail(c.code);
        CifDetailPage.fieldValue('NIK').should('eq', c.nik);
      });
    });
  });
});
