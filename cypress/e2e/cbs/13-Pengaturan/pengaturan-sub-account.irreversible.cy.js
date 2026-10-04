/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_SubAccount.json (TC-SET-SUB-006)
//
// ⚠️ IRREVERSIBLE — hanya jalan dengan `--env allowSettingSubAccount=true`.
// SettingController::subAccount membuat 1 akun SUB per KANTOR (bagan akun GL produksi). UI tidak
// punya tombol hapus (dikomentari di sub_account.blade.php). Cleanup best-effort: POST ke endpoint
// /setting/subaccount/delete (route masih aktif) dengan nama QA persis — deleteSubAccount menghapus
// SEMUA akun ber-account_name itu, jadi nama WAJIB unik & diawali "QA" (dicek sebelum kirim).
// Bila kantor mana pun tidak punya akun GL induk, subAccount() bisa gagal di tengah loop → sebagian
// akun tetap tercipta; cleanup tetap dijalankan.
import { describeIfFlag } from '../../../support/utils/flags';
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describeIfFlag('allowSettingSubAccount', 'Pengaturan - Tambah Sub Account QA', () => {
  let fx;
  let qaName = null;

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
  });

  afterEach(() => {
    if (!qaName || !/^QA\d+/.test(qaName)) return;
    PengaturanPage.postForm(fx.paths.subAccountDelete, { name_subaccount: qaName }).its('status').should('eq', 200);
    PengaturanPage.fetchDoc('/setting?menu=sub_account').then((doc) => {
      const left = Cypress.$(doc).find(`${fx.subAccount.table} tbody tr`).toArray()
        .filter((tr) => Cypress.$(tr).find('td').eq(1).text().trim() === qaName);
      expect(left, `sub account ${qaName} sudah terhapus`).to.have.length(0);
    });
  });

  it('TC-SET-SUB-006 | Happy | Tambah sub account QA berhasil dan tampil di list dengan Akun GL yang dipilih', () => {
    PengaturanPage.openSetting('sub_account');
    PengaturanPage.elements.field(fx.paths.subAccount, 'account').find('option').first().then(($o) => {
      const glName = $o.text().replace(/\s*\((AKTIVA|PASSIVA)\)\s*$/, '').trim();
      cy.qaName('Sub').then((name) => {
        qaName = name;
        PengaturanPage.selectNative(`form[action$="${fx.paths.subAccount}"] select[name="account"]`, $o.val());
        PengaturanPage.elements.field(fx.paths.subAccount, 'name').type(name);
        PengaturanPage.elements.submit(fx.paths.subAccount).click();
        PengaturanPage.assertSuccess(fx.subAccount.msgCreate);
        PengaturanPage.allRows(fx.subAccount.table).then((rows) => {
          const r = rows.find((x) => x[1] === name);
          expect(r, 'sub account QA tampil di list').to.exist;
          expect(r[2]).to.eq(glName);
        });
      });
    });
  });
});
