/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_SubAccount.json
// READ-ONLY (tabel akun GL / sub account). Tambah sub account = membuat akun SUB di SETIAP kantor dan
// tombol hapus di UI dinonaktifkan → ada di pengaturan-sub-account.irreversible.cy.js (flag).
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Sub Account (read-only)', () => {
  let fx;

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
    PengaturanPage.openSetting('sub_account');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-SET-SUB-001 | Happy | Form tambah sub account dan tabel list sub account tampil', () => {
    PengaturanPage.elements.field(fx.paths.subAccount, 'account').should('have.attr', 'required');
    PengaturanPage.elements.field(fx.paths.subAccount, 'name').should('have.attr', 'required');
    PengaturanPage.elements.submit(fx.paths.subAccount).should('contain.text', 'Simpan');
    PengaturanPage.assertHeaders(fx.subAccount.headers, fx.subAccount.table);
  });

  it('TC-SET-SUB-002 | Positif | Pilihan Akun GL berformat nama akun dengan tipe (AKTIVA/PASSIVA)', () => {
    PengaturanPage.elements.field(fx.paths.subAccount, 'account').find('option').should(($o) => {
      expect($o.length, 'minimal 1 akun GL').to.be.greaterThan(0);
      const re = new RegExp(fx.subAccount.optionRegex);
      Cypress.$.makeArray($o).forEach((o) => {
        const t = o.textContent.replace(/\s+/g, ' ').trim();
        expect(re.test(t), `opsi "${t}"`).to.eq(true);
      });
    });
  });

  it('TC-SET-SUB-003 | Positif | Setiap baris list sub account punya nama dan Akun GL induk', () => {
    PengaturanPage.allRows(fx.subAccount.table).then((rows) => {
      expect(rows.length, 'precondition: minimal 1 sub account').to.be.greaterThan(0);
      rows.forEach((r) => {
        expect(r[0], 'tanggal pembuatan').to.match(/^\d{2} \w{3} \d{4}$/);
        expect(r[1], 'nama sub account').to.not.be.empty;
        expect(r[2], `akun GL untuk ${r[1]}`).to.not.be.empty;
      });
    });
  });

  it('TC-SET-SUB-004 | Negatif | Nama sub account kosong — form tidak terkirim', () => {
    PengaturanPage.elements.field(fx.paths.subAccount, 'name').clear();
    PengaturanPage.elements.submit(fx.paths.subAccount).click();
    PengaturanPage.firstInvalidName(fx.paths.subAccount).should('eq', 'name');
    cy.blockedWrites().should('deep.eq', []);
  });

  it('TC-SET-SUB-005 | Edge | List sub account bersifat read-only (tanpa aksi ubah/hapus)', () => {
    cy.get(`${fx.subAccount.table} tbody`).find('button[data-target="#editSubAccount"], button[data-target="#deleteSubAccount"]')
      .should('have.length', 0);
  });
});
