/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_LevelApproval.json
// READ-ONLY. ⚠️ Tombol "Reset" adalah link GET /setting/level_approval/reset yang MENGHAPUS pengaturan
// (guardWrites tidak memblokir GET) — spec ini hanya memeriksa href-nya, TIDAK pernah mengkliknya.
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Level Approval (read-only)', () => {
  let fx;
  const LA = '/setting/level_approval';

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    cy.guardWrites();
    PengaturanPage.openSetting('level_approval');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-SET-LA-001 | Happy | Form level approval menampilkan 6 field nominal wajib, tombol Simpan dan Reset', () => {
    cy.get('#tab_level_approval .caption-subject').should('contain.text', fx.levelApproval.caption);
    fx.levelApproval.fields.forEach((n) => PengaturanPage.elements.field(LA, n).should('have.attr', 'required'));
    PengaturanPage.elements.submit(LA).should('contain.text', 'Simpan');
    PengaturanPage.elements.form(LA).find('a.btn').contains('Reset')
      .should('have.attr', 'href', fx.paths.levelApprovalReset);
  });

  it('TC-SET-LA-002 | Positif | Nilai minimal/maksimal tersimpan tampil dengan format mata uang IDR', () => {
    fx.levelApproval.fields.forEach((n) => {
      PengaturanPage.elements.field(LA, n).invoke('val').should((v) => {
        expect(v, `${n} terisi (precondition: level approval sudah diset)`).to.not.match(/^-?$/);
        expect(v, `${n} format IDR`).to.match(new RegExp(`^${fx.levelApproval.maskPrefix}`));
      });
    });
  });

  it('TC-SET-LA-003 | Edge | Nilai maksimal setiap level tidak lebih kecil dari nilai minimal', () => {
    const num = (v) => Number(String(v).replace(/[^\d]/g, ''));
    [['unit_minimum_balance', 'unit_maximum_balance'], ['branch_minimum_balance', 'branch_maximum_balance'],
      ['center_minimum_balance', 'center_maximum_balance']].forEach(([mn, mx]) => {
      PengaturanPage.elements.field(LA, mn).invoke('val').then((a) => {
        PengaturanPage.elements.field(LA, mx).invoke('val').should((b) => {
          expect(num(b), `${mx} >= ${mn}`).to.be.at.least(num(a));
        });
      });
    });
  });

  it('TC-SET-LA-004 | Negatif | Field Kantor Pusat minimal dikosongkan — form tidak terkirim', () => {
    cy.window().then((win) => {
      // inputmask (jQuery milik aplikasi): lepas mask dulu agar nilai benar-benar kosong.
      const $el = win.jQuery('#center_minimum_balance');
      if ($el.inputmask) $el.inputmask('remove');
      $el.val('');
    });
    PengaturanPage.elements.submit(LA).click();
    PengaturanPage.firstInvalidName(LA).should('eq', 'center_minimum_balance');
    cy.blockedWrites().should('deep.eq', []);
  });
});
