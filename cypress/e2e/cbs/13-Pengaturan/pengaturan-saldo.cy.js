/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_Saldo.json
// READ-ONLY MUTLAK. Form "Edit Saldo Teller/User" MENIMPA saldo kas teller / saldo user secara langsung
// (tanpa jurnal) — tidak pernah di-submit. Modal hanya dibuka lalu ditutup; guardWrites aktif.
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Saldo Teller & Saldo Karyawan (read-only)', () => {
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
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Saldo Teller', () => {
    beforeEach(() => {
      PengaturanPage.openSetting('teller_balance');
    });

    it('TC-SET-SALDO-001 | Happy | Tabel saldo kas teller tampil dengan saldo berformat Rupiah', () => {
      PengaturanPage.assertHeaders(fx.saldo.tellerHeaders, fx.saldo.tellerTable);
      PengaturanPage.allRows(fx.saldo.tellerTable).then((rows) => {
        expect(rows.length, 'precondition: minimal 1 kas teller').to.be.greaterThan(0);
        const re = new RegExp(fx.saldo.rupiahRegex);
        rows.forEach((r) => expect(re.test(r[1]), `saldo "${r[1]}" (${r[0]})`).to.eq(true));
      });
    });

    it('TC-SET-SALDO-002 | Positif | Modal Edit Saldo Teller terisi saldo baris dan ditutup tanpa request', () => {
      cy.get(`${fx.saldo.tellerTable} tbody a[data-target="${fx.saldo.tellerModal}"]`).first().then(($a) => {
        const id = $a.attr('data-id-teller');
        const bal = $a.attr('data-balance-teller');
        cy.wrap($a).click();
        cy.get(fx.saldo.tellerModal).should('be.visible');
        cy.get('#account_id').should('have.value', id);
        // inputmask currency (prefix "IDR ", group ",", radix ".") → kembalikan ke angka.
        cy.get('#balance_teller').invoke('val').should((v) => {
          expect(Number(String(v).replace(/[^\d.-]/g, ''))).to.eq(Number(bal));
        });
        cy.get(`${fx.saldo.tellerModal} button[data-dismiss="modal"]`).contains('Close').click();
        cy.get(fx.saldo.tellerModal).should('not.be.visible');
        cy.blockedWrites().should('deep.eq', []);
      });
    });
  });

  describe('Saldo Karyawan', () => {
    beforeEach(() => {
      PengaturanPage.openSetting('employee_balance');
    });

    it('TC-SET-SALDO-003 | Happy | Tabel saldo karyawan tampil dengan kolom Nama, Kantor, Saldo, Action', () => {
      PengaturanPage.assertHeaders(fx.saldo.employeeHeaders, fx.saldo.employeeTable);
      PengaturanPage.allRows(fx.saldo.employeeTable).then((rows) => {
        expect(rows.length, 'precondition: minimal 1 user').to.be.greaterThan(0);
        const re = new RegExp(fx.saldo.rupiahRegex);
        rows.forEach((r) => expect(re.test(r[2]), `saldo "${r[2]}" (${r[0]})`).to.eq(true));
      });
    });

    it('TC-SET-SALDO-004 | Positif | Modal Edit Saldo User terisi id user dan ditutup tanpa request', () => {
      cy.get(`${fx.saldo.employeeTable} tbody a[data-target="${fx.saldo.employeeModal}"]`).first().then(($a) => {
        const id = $a.attr('data-id');
        cy.wrap($a).click();
        cy.get(fx.saldo.employeeModal).should('be.visible');
        cy.get('#user_id').should('have.value', id);
        cy.get('#balance').invoke('val').should('match', /\d/);
        cy.get(`${fx.saldo.employeeModal} button[data-dismiss="modal"]`).contains('Close').click();
        cy.get(fx.saldo.employeeModal).should('not.be.visible');
        cy.blockedWrites().should('deep.eq', []);
      });
    });
  });
});
