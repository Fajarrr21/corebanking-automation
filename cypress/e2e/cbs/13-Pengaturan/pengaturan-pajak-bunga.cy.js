/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_PajakBunga.json
// Pengaturan GLOBAL (sistem bunga simpanan + tanggal pembukuan bunga/pajak). Semua test:
//   capture nilai asli (cy.request) → [ubah] → restore + verifikasi di afterEach.
// Tanggal pengganti di TC-SET-TAX-005 sengaja BUKAN hari ini / besok / nilai asli, supaya job
// pembukuan terjadwal tidak terpicu selama jendela perubahan.
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Pajak & Bunga', () => {
  let fx;
  let original = null;
  let names;

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
      names = [fx.tax.select, ...fx.tax.fields];
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    original = null;
    PengaturanPage.open('/home');
    PengaturanPage.capture('tax', fx.paths.tax, names).then((v) => {
      original = v;
    });
  });

  afterEach(() => {
    if (original) PengaturanPage.restore('tax', fx.paths.tax, original);
  });

  const allowTax = () => cy.guardWrites({ allow: [new RegExp(`^${fx.paths.tax}$`)] });

  it('TC-SET-TAX-001 | Happy | Form Pajak & Bunga menampilkan pilihan sistem bunga dan tanggal pembukuan tersimpan', () => {
    cy.guardWrites();
    PengaturanPage.openSetting('tax');
    cy.get('#tab_tax .caption-subject').should('contain.text', fx.tax.caption);
    PengaturanPage.elements.field(fx.paths.tax, fx.tax.select).find('option').then(($o) => {
      const map = {};
      Cypress.$.makeArray($o).forEach((o) => {
        map[o.value] = o.textContent.trim();
      });
      expect(map).to.deep.eq(fx.tax.options);
    });
    PengaturanPage.elements.field(fx.paths.tax, fx.tax.select).should('have.value', original[fx.tax.select]);
    fx.tax.fields.forEach((n) => {
      PengaturanPage.elements.field(fx.paths.tax, n).should('have.attr', 'required');
      PengaturanPage.elements.field(fx.paths.tax, n).should(($i) => expect(Number($i.val())).to.eq(Number(original[n])));
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-SET-TAX-002 | Negatif | Tanggal pembukuan bunga 32 ditolak dengan pesan maksimal 31', () => {
    allowTax();
    PengaturanPage.openSetting('tax');
    PengaturanPage.elements.field(fx.paths.tax, fx.tax.fields[0]).clear().type(fx.tax.overMax);
    PengaturanPage.elements.submit(fx.paths.tax).click();
    PengaturanPage.common.validationItems().should('contain.text', fx.tax.msgInterestMax);
    PengaturanPage.common.alertSuccess().should('not.exist');
  });

  it('TC-SET-TAX-003 | Negatif | Tanggal pembukuan pajak 0 ditolak dengan pesan minimal 1', () => {
    allowTax();
    PengaturanPage.openSetting('tax');
    PengaturanPage.elements.field(fx.paths.tax, fx.tax.fields[1]).clear().type(fx.tax.underMin);
    PengaturanPage.elements.submit(fx.paths.tax).click();
    PengaturanPage.common.validationItems().should('contain.text', fx.tax.msgTaxMin);
    PengaturanPage.common.alertSuccess().should('not.exist');
  });

  it('TC-SET-TAX-004 | Negatif | Tanggal pembukuan bunga dikosongkan — form tidak terkirim', () => {
    cy.guardWrites();
    PengaturanPage.openSetting('tax');
    PengaturanPage.elements.field(fx.paths.tax, fx.tax.fields[0]).clear();
    PengaturanPage.elements.submit(fx.paths.tax).click();
    PengaturanPage.firstInvalidName(fx.paths.tax).should('eq', fx.tax.fields[0]);
    cy.blockedWrites().should('deep.eq', []);
  });

  it('TC-SET-TAX-005 | Happy | Ubah tanggal pembukuan pajak tersimpan dan tampil kembali', () => {
    allowTax();
    PengaturanPage.openSetting('tax');
    cy.then(() => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
      const avoid = [Number(original[fx.tax.fields[1]]), now.getDate(), tomorrow.getDate()];
      let next = 28;
      while (avoid.includes(next)) next -= 1;
      PengaturanPage.elements.field(fx.paths.tax, fx.tax.fields[1]).clear().type(String(next));
      PengaturanPage.elements.submit(fx.paths.tax).click();
      PengaturanPage.assertSuccess(fx.tax.msgSuccess);
      cy.location('search').should('include', 'menu=tax');
      PengaturanPage.elements.field(fx.paths.tax, fx.tax.fields[1]).should(($i) => expect(Number($i.val())).to.eq(next));
      PengaturanPage.elements.field(fx.paths.tax, fx.tax.select).should('have.value', original[fx.tax.select]);
    });
  });
});
