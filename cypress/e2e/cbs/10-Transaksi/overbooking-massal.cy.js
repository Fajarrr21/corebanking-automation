// Transaksi > General Ledger > tab "Overbooking Massal" (?menu=masstransaction).
// TC sumber: docs/test-cases/src/TC_Transaksi_OverbookingMassal.json
// PRD: "Transaksi Overbooking Masal", "Transaksi Massal GL to GL".
// Read-only: write-guard aktif; modal PIN tidak pernah disubmit.
import LoginPage from '../../../support/pageobjects/LoginPage';
import GLPage from '../../../support/pageobjects/Transaksi/GeneralLedgerPage';

describe('Transaksi - Overbooking Massal (GL to GL)', () => {
  let fx;
  let m;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      m = d.massGl;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openMass = () => {
    GLPage.openMenu(m.menu, fx.roleHint);
    GLPage.elements.tabPane('#masstransaction').should('have.class', 'active');
  };

  describe('Tampilan form', () => {
    it('TC-TRX-OBM-001 | Happy | Tab Overbooking Massal tampil dengan pilihan jenis Debit/Kredit dan tombol proses', () => {
      openMass();
      GLPage.elements.caption('#masstransaction').should('contain.text', m.caption);
      GLPage.optionTexts('#transaction_type').should('deep.eq', m.typeOptions);
      GLPage.elements.massProcess().should('be.visible').and('contain.text', m.processButton);
    });

    it('TC-TRX-OBM-002 | Positif | Jenis transaksi Debit aktif secara default saat form dibuka', () => {
      openMass();
      GLPage.elements.massType().should('have.value', 'debit');
      GLPage.elements.massDebitSection().should('be.visible');
    });

    it('TC-TRX-OBM-003 | Positif | Memilih Debit menampilkan Sumber Rekening (Debit) & Rekening Tujuan (Kredit); Kredit sebaliknya', () => {
      openMass();
      GLPage.elements.massType().select('debit');
      GLPage.elements.massDebitSection().should('be.visible').and('contain.text', 'Akun Debit (Sumber Rekening)')
        .and('contain.text', 'Akun Kredit (Rekening Tujuan)');
      GLPage.elements.massCreditSection().should('not.be.visible');
      GLPage.elements.massType().select('credit');
      GLPage.elements.massCreditSection().should('be.visible').and('contain.text', 'Akun Kredit (Sumber Rekening)')
        .and('contain.text', 'Akun Debit (Rekening tujuan)');
      GLPage.elements.massDebitSection().should('not.be.visible');
    });

    it('TC-TRX-OBM-004 | Positif | Tombol Tambah menambah baris Rekening Tujuan (akun + nominal + keterangan) dan tombol hapus menghapusnya', () => {
      openMass();
      GLPage.elements.massType().select('debit');
      GLPage.elements.massAddCredit().click();
      GLPage.elements.massAddCredit().click();
      GLPage.elements.massCreditRows().should('have.length', 2);
      GLPage.elements.massCreditRows().first().within(() => {
        cy.get('select[name="credit_accounts[]"]').should('exist');
        cy.get('input[name="credit_amounts[]"]').should('exist');
        cy.get('input[name="credit_notes[]"]').should('exist');
      });
      GLPage.elements.massCreditRows().last().find('button.red').click();
      GLPage.elements.massCreditRows().should('have.length', 1);
    });

    it('TC-TRX-OBM-005 | Positif | Form memiliki field Nama Transaksi (wajib) sesuai PRD GL to GL', () => {
      openMass();
      cy.get('#masstransaction label').should(($l) => {
        const labels = Cypress.$.makeArray($l).map((l) => l.innerText.replace(/[:*\s]+/g, ' ').trim());
        expect(labels, 'label form Overbooking Massal').to.include(m.prdNamaTransaksiLabel);
      });
    });
  });

  describe('Validasi client-side', () => {
    it('TC-TRX-OBM-006 | Negatif | Proses tanpa memilih jenis transaksi menampilkan pesan error dan modal PIN tidak terbuka', () => {
      openMass();
      GLPage.elements.massType().select('');
      GLPage.elements.massProcess().click();
      GLPage.elements.massFieldErrors().should('contain.text', m.errors.jenis);
      GLPage.elements.massPinModal().should('not.be.visible');
    });

    it('TC-TRX-OBM-007 | Negatif | Jenis Debit tanpa akun sumber dan tanpa rekening tujuan menampilkan pesan error', () => {
      openMass();
      GLPage.elements.massType().select('debit');
      GLPage.elements.massProcess().click();
      GLPage.elements.massFieldErrors().should('contain.text', m.errors.akunDebitUtama);
      // Pesan "Tambah minimal satu akun kredit" WAJIB terlihat oleh user (PRD: field
      // required tidak diisi -> tampil pesan error).
      cy.get('#masstransaction').should('contain.text', m.errors.minKredit);
      GLPage.elements.massPinModal().should('not.be.visible');
    });

    it('TC-TRX-OBM-008 | Negatif | Baris rekening tujuan berisi nominal tanpa akun menampilkan "Pilih akun kredit"', () => {
      openMass();
      GLPage.elements.massType().select('debit');
      GLPage.pickOptionByIndex('#main_debit_account', 1);
      GLPage.elements.massAddCredit().click();
      GLPage.elements.massCreditRows().first().find('input[name="credit_amounts[]"]').type(m.sampleAmount);
      GLPage.elements.massProcess().click();
      GLPage.elements.massCreditRows().first().should('contain.text', m.errors.akunKredit);
      GLPage.elements.massPinModal().should('not.be.visible');
    });

    it('TC-TRX-OBM-009 | Positif | Form lengkap membuka modal PIN; Batal menutup modal tanpa mengirim transaksi', () => {
      openMass();
      GLPage.elements.massType().select('debit');
      GLPage.pickOptionByIndex('#main_debit_account', 1);
      GLPage.elements.massAddCredit().click();
      GLPage.pickOptionByIndex('#credit_row_1 select[name="credit_accounts[]"]', 2);
      GLPage.elements.massCreditRows().first().find('input[name="credit_amounts[]"]').then(($i) => {
        // Bila akun tujuan punya sub-account, nominal dibuat readonly oleh app -> isi via sub detail tidak diuji di sini.
        if (!$i.prop('readonly')) cy.wrap($i).type(m.sampleAmount);
      });
      GLPage.elements.massProcess().click();
      GLPage.elements.massPinModal().should('be.visible').and('contain.text', m.pinTitle);
      GLPage.elements.massPinInput().should('have.attr', 'type', 'password');
      cy.get('#mass_transaction_pinspv button[data-dismiss="modal"]').contains('Batal').click();
      GLPage.elements.massPinModal().should('not.be.visible');
    });
  });
});
