// Simpanan Nasabah — buka rekening simpanan SUNGGUHAN pada CIF milik test (QA...).
// Rekening & permintaan Approval (WAITING_APPROVAL) TIDAK bisa dihapus dari UI.
// Butuh DUA flag: --env allowCreateSaving=true (rekening) dan allowCreateCif=true (CIF baru,
// karena rekening hanya boleh dibuka pada CIF milik test, bukan nasabah asli).
// TC sumber: docs/test-cases/src/TC_Simpanan_Buka.json
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifFormPage from '../../../../support/pageobjects/Nasabah/CifFormPage';
import CifDetailPage from '../../../../support/pageobjects/Nasabah/CifDetailPage';
import { describeIfFlag, flagOn } from '../../../../support/utils/flags';

describeIfFlag('allowCreateSaving', 'Nasabah - Simpanan - Buka Rekening (irreversible)', () => {
  let cfx;
  let sfx;

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      cfx = d;
    });
    cy.fixture('nasabah/saving').then((d) => {
      sfx = d;
    });
  });

  beforeEach(() => {
    if (!flagOn('allowCreateCif')) {
      throw new Error('Butuh juga --env allowCreateCif=true: rekening hanya dibuka pada CIF baru milik test (QA...).');
    }
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    CifListPage.visitList(cfx.paths.list, cfx.timeout);
    CifListPage.isUserPusat().then((pusat) => {
      if (pusat) throw new Error('Precondition tidak terpenuhi: akun test = user pusat (office_id 0). Butuh akun cabang.');
    });
  });

  it('TC-SMP-BUKA-005 | Happy | Buka rekening simpanan pada CIF milik test berstatus Menunggu Persetujuan', () => {
    cy.qaName().then((name) => {
      CifFormPage.visitCreate(cfx.paths.create, cfx.timeout);
      CifFormPage.fillValid({
        nik: CifFormPage.generateNik(cfx.testData.nikPrefix),
        name,
        placeOfBirth: cfx.testData.placeOfBirth,
        dateOfBirth: cfx.testData.dateOfBirth,
        gender: cfx.testData.gender,
        address: cfx.testData.address,
        provinceText: cfx.testData.provinceText,
        occupation: cfx.testData.occupation,
        annualIncome: cfx.testData.annualIncome,
        marital: cfx.testData.maritalSingle,
        motherName: cfx.testData.motherName,
        phone: cfx.testData.validPhone,
      }).submit();
      cy.location('pathname', { timeout: cfx.timeout }).should('match', /^\/cif\/[^/]+$/).and('not.eq', cfx.paths.create);
      CifDetailPage.fieldValue('Nama Lengkap').should('eq', name).and('match', /^QA/);

      CifDetailPage.openNewAccountModal();
      CifDetailPage.selectFirstProduct().then((product) => {
        CifDetailPage.elements.modalSubmit().click();
        cy.location('pathname', { timeout: sfx.timeout }).should('match', /^\/cif\/[^/]+$/);
        CifDetailPage.assertSuccess(sfx.open.successMsg);
        CifDetailPage.clickTab('Simpanan');
        CifDetailPage.elements.savingItems().should('have.length', 1).first()
          .should('contain.text', product)
          .and('contain.text', sfx.open.waitingLabel);
      });
    });
  });
});
