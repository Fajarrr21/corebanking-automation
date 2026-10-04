// Transaksi — POSTING SUNGGUHAN ke endpoint transaksi (TIDAK BISA DIBATALKAN otomatis).
// TC sumber: docs/test-cases/src/TC_Transaksi_Posting.json
//
// Default TIDAK jalan. Jalankan hanya dengan:
//   npx cypress run --spec "cypress/e2e/cbs/10-Transaksi/transaksi.irreversible.cy.js" --env allowTransaction=true
// Butuh di cypress.env.json (RAHASIA, jangan commit):
//   trxSpvUserId : id user supervisor di kantor akun test
//   trxSpvPin    : PIN supervisor tsb
//   trxUserPin   : PIN akun test sendiri (Overbooking Massal / Transaksi Massal Simpanan)
// Data uji ditandai: Nama Transaksi & Catatan diawali "QA<timestamp>". Transaksi
// sukses TIDAK di-void otomatis — void manual via Riwayat Kasir (hari yang sama).
import LoginPage from '../../../support/pageobjects/LoginPage';
import GLPage from '../../../support/pageobjects/Transaksi/GeneralLedgerPage';
import { describeIfFlag } from '../../../support/utils/flags';

describeIfFlag('allowTransaction', 'Transaksi - Posting transaksi (irreversible)', () => {
  let fx;
  let p;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      p = d.posting;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
  });

  /** Ambil rahasia dari Cypress.env; gagal jelas bila belum diisi. */
  const secret = (key) => {
    const v = Cypress.env(key);
    if (v === undefined || v === null || v === '') {
      throw new Error(`Cypress.env('${key}') kosong — isi di cypress.env.json untuk spec irreversible ini`);
    }
    return String(v);
  };

  /** Isi form Overbooking GL lalu konfirmasi PIN supervisor (submit sungguhan). */
  const submitOverbooking = ({ name, debitIdx, creditIdx, debitMatch, creditMatch, amount, pin }) => {
    GLPage.openMenu('overbooking', fx.roleHint);
    GLPage.elements.obName().type(name);
    if (debitMatch) {
      cy.window().then((win) => {
        const v = win.$('#account_debit option').filter((_, o) => debitMatch.test(o.textContent.trim())).first().val();
        expect(v, 'akun debit ditemukan').to.not.eq(undefined);
        win.$('#account_debit').val(v).trigger('change');
      });
    } else GLPage.pickOptionByIndex('#account_debit', debitIdx);
    if (creditMatch) {
      cy.window().then((win) => {
        const v = win.$('#account_credit option').filter((_, o) => creditMatch.test(o.textContent.trim())).first().val();
        expect(v, 'akun kredit ditemukan').to.not.eq(undefined);
        win.$('#account_credit').val(v).trigger('change');
      });
    } else GLPage.pickOptionByIndex('#account_credit', creditIdx);
    GLPage.elements.obAmount().click().type(amount);
    GLPage.elements.obNotes().type(name);
    GLPage.elements.obSubmit().click();
    GLPage.elements.obPinModal().should('be.visible');
    GLPage.elements.obModalSpv().select(secret(p.envSpvId), { force: true });
    GLPage.elements.obModalPin().type(pin, { log: false }).trigger('change');
    GLPage.elements.obModalProcess().click();
    cy.location('pathname').should('eq', fx.gl.path);
  };

  describe('Overbooking GL (Pilih Kas Teller)', () => {
    it('TC-TRX-POST-001 | Happy | Overbooking GL valid tersimpan dan muncul di tab Riwayat', () => {
      cy.qaName('OB').then((name) => {
        submitOverbooking({ name, debitIdx: 1, creditIdx: 2, amount: p.amount, pin: secret(p.envSpvPin) });
        GLPage.assertSuccess(p.overbookingSuccess);
        cy.intercept('GET', fx.gl.historyDataUrl).as('glHistory');
        GLPage.openMenu('history', fx.roleHint);
        cy.wait('@glHistory');
        GLPage.waitTable('#data-table-history', fx.timeouts.table);
        GLPage.dataRows('#data-table-history').should(($r) => {
          const names = Cypress.$.makeArray($r).map((r) => Cypress.$(r).find('td').eq(1).text().trim());
          expect(names, 'Nama transaksi QA di Riwayat').to.include(name);
        });
      });
    });

    it('TC-TRX-POST-002 | Negatif | Posisi Debit sama dengan Posisi Kredit ditolak server', () => {
      cy.qaName('OB-SAMA').then((name) => {
        submitOverbooking({ name, debitIdx: 1, creditIdx: 1, amount: p.amount, pin: secret(p.envSpvPin) });
        GLPage.assertError(p.sameAccountError);
      });
    });

    it('TC-TRX-POST-003 | Negatif | PIN Supervisor salah menolak transaksi', () => {
      cy.qaName('OB-PIN').then((name) => {
        submitOverbooking({ name, debitIdx: 1, creditIdx: 2, amount: p.amount, pin: 'QA000000' });
        GLPage.assertError(p.wrongPinError);
      });
    });

    it('TC-TRX-POST-004 | Negatif | Nominal melebihi saldo Kas Teller (posisi kredit) ditolak dengan pesan saldo', () => {
      cy.qaName('OB-SALDO').then((name) => {
        submitOverbooking({
          name,
          debitIdx: 1,
          creditMatch: /- \d{4}111$/, // akun Kas Teller = kode kantor + '111' (Helpers::isTellerCashAccount)
          amount: '999999999999',
          pin: secret(p.envSpvPin),
        });
        GLPage.assertError(p.tellerInsufficientPrefix);
      });
    });
  });

  describe('Overbooking Massal', () => {
    it('TC-TRX-POST-005 | Happy | Overbooking Massal Debit ke 1 rekening tujuan berhasil dengan PIN pengguna', () => {
      GLPage.openMenu(fx.massGl.menu, fx.roleHint);
      GLPage.elements.massType().select('debit');
      GLPage.pickOptionByIndex('#main_debit_account', 1);
      GLPage.elements.massAddCredit().click();
      GLPage.pickOptionByIndex('#credit_row_1 select[name="credit_accounts[]"]', 2);
      cy.qaName('OBM').then((name) => {
        GLPage.elements.massCreditRows().first().find('input[name="credit_amounts[]"]').type(p.amount);
        GLPage.elements.massCreditRows().first().find('input[name="credit_notes[]"]').type(name);
      });
      cy.intercept('POST', '/transaction/general_ledger/mass-transaction').as('massPost');
      GLPage.elements.massProcess().click();
      GLPage.elements.massPinModal().should('be.visible');
      GLPage.elements.massPinInput().type(secret(p.envUserPin), { log: false });
      cy.get('#mass_transaction_form_pin button[type="submit"]').click();
      cy.wait('@massPost').its('response.statusCode').should('eq', 200);
      GLPage.elements.massAlert().find('.alert-success').should('contain.text', 'Berhasil memproses');
    });
  });

  describe('Transaksi Massal Simpanan (Tabungan to GL)', () => {
    const fillMassSaving = () => {
      GLPage.openMenu(fx.massSaving.menu, fx.roleHint);
      GLPage.elements.msType().select('deposit');
      GLPage.elements.msPosition().select('debit');
      GLPage.elements.msFile().selectFile(`cypress/fixtures/${p.massSavingFixture}`, { force: true });
      GLPage.elements.msOffice().then(($o) => {
        if ($o.is('select')) GLPage.pickOptionByIndex('#mass-saving-form #office', 1);
      });
      cy.get('#account_gl option', { timeout: fx.timeouts.table }).should('have.length.greaterThan', 1);
      GLPage.pickOptionByIndex('#account_gl', 1);
      cy.intercept('POST', '/transaction/mass_saving_transaction/import').as('msPost');
      GLPage.elements.msProcess().click();
      GLPage.elements.msPinModal().should('be.visible');
    };

    it('TC-TRX-POST-006 | Negatif | File berisi nomor rekening tidak terdaftar ditolak seluruhnya dengan pesan baris error', () => {
      fillMassSaving();
      GLPage.elements.msPinInput().type(secret(p.envUserPin), { log: false });
      cy.get('#mass_saving_pin_form button[type="submit"]').click();
      cy.wait('@msPost').its('response.statusCode').should('be.gte', 400);
      GLPage.elements.msAlert().find('.alert-danger').should('contain.text', p.massSavingInvalidAccount).and('contain.text', 'Baris');
    });

    it('TC-TRX-POST-007 | Negatif | PIN pengguna salah menolak transaksi massal simpanan', () => {
      fillMassSaving();
      GLPage.elements.msPinInput().type('QA000000', { log: false });
      cy.get('#mass_saving_pin_form button[type="submit"]').click();
      cy.wait('@msPost').its('response.statusCode').should('eq', 422);
      GLPage.elements.msAlert().find('.alert-danger').should('contain.text', 'PIN yang Anda masukkan salah!');
    });
  });
});
