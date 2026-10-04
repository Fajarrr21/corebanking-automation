/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_Biaya.json
// Pengaturan GLOBAL (biaya transaksi simpanan antar cabang). Semua test di spec ini:
//   capture nilai asli (cy.request) → [ubah] → restore + verifikasi di afterEach (tetap jalan walau test gagal).
// Test 001-002 diblokir guardWrites; 003 mengirim nilai negatif yang PASTI ditolak SettingFeeRequest
// (min:0) — restore tetap dijalankan sebagai pengaman; 004 benar-benar menyimpan lalu di-restore.
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Biaya antar cabang', () => {
  let fx;
  let original = null;

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    original = null;
    PengaturanPage.open('/home');
    PengaturanPage.capture('fee', fx.paths.fee, fx.fee.fields).then((v) => {
      original = v;
    });
  });

  afterEach(() => {
    if (original) PengaturanPage.restore('fee', fx.paths.fee, original);
  });

  describe('Tampilan & validasi klien (tanpa request tulis)', () => {
    beforeEach(() => {
      cy.guardWrites();
      PengaturanPage.openSetting('fee');
    });

    afterEach(() => {
      cy.assertNoWritesLeaked();
    });

    it('TC-SET-FEE-001 | Happy | Form biaya menampilkan 3 field angka wajib yang terisi nilai tersimpan', () => {
      cy.get('#tab_fee .caption-subject').should('contain.text', fx.fee.caption);
      fx.fee.fields.forEach((n) => {
        PengaturanPage.elements.field(fx.paths.fee, n)
          .should('have.attr', 'type', 'number')
          .and('have.attr', 'required');
        PengaturanPage.elements.field(fx.paths.fee, n).should(($i) => {
          expect(Number($i.val())).to.eq(Number(original[n]));
        });
      });
      PengaturanPage.elements.submit(fx.paths.fee).should('contain.text', 'Simpan');
    });

    it('TC-SET-FEE-002 | Negatif | Tarik Tunai dikosongkan lalu Simpan — form tidak terkirim', () => {
      PengaturanPage.elements.field(fx.paths.fee, fx.fee.fields[0]).clear();
      PengaturanPage.elements.submit(fx.paths.fee).click();
      PengaturanPage.firstInvalidName(fx.paths.fee).should('eq', fx.fee.fields[0]);
      cy.blockedWrites().should('deep.eq', []);
    });
  });

  describe('Validasi server & simpan (dengan restore)', () => {
    it('TC-SET-FEE-003 | Negatif | Biaya bernilai negatif ditolak server dengan pesan error', () => {
      cy.guardWrites({ allow: [new RegExp(`^${fx.paths.fee}$`)] });
      PengaturanPage.openSetting('fee');
      PengaturanPage.elements.field(fx.paths.fee, fx.fee.fields[0]).clear().type(fx.fee.negative);
      PengaturanPage.elements.submit(fx.paths.fee).click();
      PengaturanPage.common.validationItems().should('contain.text', fx.fee.msgMin);
      PengaturanPage.common.alertSuccess().should('not.exist');
    });

    it('TC-SET-FEE-004 | Happy | Ubah biaya Tarik Tunai tersimpan dan tampil kembali', () => {
      cy.guardWrites({ allow: [new RegExp(`^${fx.paths.fee}$`)] });
      PengaturanPage.openSetting('fee');
      cy.then(() => {
        const next = String(Number(original[fx.fee.fields[0]]) + 1);
        PengaturanPage.elements.field(fx.paths.fee, fx.fee.fields[0]).clear().type(next);
        PengaturanPage.elements.submit(fx.paths.fee).click();
        PengaturanPage.assertSuccess(fx.fee.msgSuccess);
        cy.location('search').should('include', 'menu=fee');
        PengaturanPage.elements.field(fx.paths.fee, fx.fee.fields[0]).should(($i) => {
          expect(Number($i.val())).to.eq(Number(next));
        });
      });
    });
  });
});
