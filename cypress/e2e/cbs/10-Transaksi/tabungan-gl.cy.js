// Transaksi > General Ledger > tab "Transaksi Massal Simpanan" (?menu=mass_saving_transaction)
// = fitur PRD "Transaksi Tabungan to GL" (2 halaman Notion, isi keduanya dipakai).
// TC sumber: docs/test-cases/src/TC_Transaksi_TabunganGL.json
// Read-only: write-guard aktif; tidak ada file yang diproses (modal PIN tidak disubmit).
import LoginPage from '../../../support/pageobjects/LoginPage';
import GLPage from '../../../support/pageobjects/Transaksi/GeneralLedgerPage';

describe('Transaksi - Tabungan to GL (Transaksi Massal Simpanan)', () => {
  let fx;
  let s;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      s = d.massSaving;
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

  const openTab = () => {
    GLPage.openMenu(s.menu, fx.roleHint);
    GLPage.elements.tabPane('#mass_saving_transaction').should('have.class', 'active');
  };

  /** Akun pusat (dropdown Kantor tampil) wajib memilih kantor dulu agar Account GL terisi. */
  const ensureAccountsLoaded = () => {
    GLPage.elements.msOffice().then(($o) => {
      if ($o.is('select')) GLPage.pickOptionByIndex('#mass-saving-form #office', 1);
    });
    cy.get('#account_gl option', { timeout: fx.timeouts.table }).should('have.length.greaterThan', 1);
  };

  describe('Tampilan form', () => {
    it('TC-TRX-TABGL-001 | Happy | Form memuat Jenis Transaksi, Posisi GL, File Excel, Account GL dan tombol proses', () => {
      openTab();
      GLPage.elements.caption('#mass_saving_transaction').should('contain.text', s.caption);
      GLPage.optionTexts('#mass-saving-form select[name="transaction_type"]').should('deep.eq', s.jenisOptions);
      GLPage.optionTexts('#mass-saving-form select[name="gl_position"]').should('deep.eq', s.posisiOptions);
      GLPage.elements.msFile().should('have.attr', 'required');
      GLPage.elements.msAccountGl().should('have.attr', 'required');
      GLPage.elements.msProcess().should('be.visible');
    });

    it('TC-TRX-TABGL-002 | Positif | Link Download template mengunduh file template Excel', () => {
      openTab();
      GLPage.elements.msTemplateLink().should('contain.text', s.templateText).and('have.attr', 'href').and('include', s.templateHref);
      GLPage.elements.msTemplateLink().invoke('prop', 'href').then((href) => GLPage.assertDownloadable(href));
    });

    it('TC-TRX-TABGL-003 | Positif | Pilih Jenis Transaksi Satuan/Massal tersedia (form satuan: pilih nasabah, nominal)', () => {
      openTab();
      cy.get('#mass-saving-form').should(($f) => {
        const text = $f.text().replace(/\s+/g, ' ');
        expect(text, 'opsi jenis transaksi Satuan').to.include(s.prdJenisSatuanLabel);
      });
    });

    it('TC-TRX-TABGL-004 | Positif | General Ledger dapat dicari berdasarkan nama', () => {
      openTab();
      ensureAccountsLoaded();
      cy.get('#account_gl option').eq(1).invoke('text').then((txt) => {
        // Format opsi: "<nomor> - <nama> (<posisi>) | Saldo: ..." -> kata pertama nama akun.
        const name = txt.split(' - ')[1].split(' (')[0].trim();
        GLPage.elements.msAccountGl().siblings('.select2-container').first().click();
        cy.get('.select2-container--open .select2-search__field').type(name);
        cy.get('.select2-results__option').should('contain.text', name);
        cy.get('.select2-container--open .select2-search__field').type('{esc}');
      });
    });

    it('TC-TRX-TABGL-005 | Edge | Opsi "Saldo Bisa Minus" default "Tidak"', () => {
      openTab();
      GLPage.elements.msAllowNegative().should('have.value', '0');
      GLPage.elements.msAllowNegative().find('option:selected').should('contain.text', 'Tidak');
    });
  });

  describe('Validasi client-side', () => {
    it('TC-TRX-TABGL-006 | Negatif | Proses tanpa mengisi field wajib menampilkan pesan error dan modal PIN tidak terbuka', () => {
      openTab();
      GLPage.elements.msProcess().click();
      GLPage.elements.msErrorFor('transaction_type').should('be.visible').and('contain.text', s.errors.jenis);
      GLPage.elements.msErrorFor('gl_position').should('be.visible').and('contain.text', s.errors.posisi);
      GLPage.elements.msErrorFor('file').should('be.visible');
      GLPage.elements.msPinModal().should('not.be.visible');
    });

    it('TC-TRX-TABGL-007 | Negatif | Upload file selain Excel ditolak dengan pesan format file', () => {
      openTab();
      GLPage.elements.msFile().selectFile(
        { contents: Cypress.Buffer.from(s.wrongFile.content), fileName: s.wrongFile.name, mimeType: s.wrongFile.mime },
        { force: true },
      );
      GLPage.elements.msProcess().click();
      GLPage.elements.msErrorFor('file').should('be.visible').and('contain.text', s.errors.extension);
      GLPage.elements.msPinModal().should('not.be.visible');
    });

    it('TC-TRX-TABGL-008 | Positif | Form lengkap membuka modal PIN; Batal menutup tanpa memproses', () => {
      openTab();
      GLPage.elements.msType().select('deposit');
      GLPage.elements.msPosition().select('debit');
      GLPage.elements.msFile().selectFile(
        { contents: Cypress.Buffer.from('dummy'), fileName: s.excelFile.name, mimeType: s.excelFile.mime },
        { force: true },
      );
      ensureAccountsLoaded();
      GLPage.pickOptionByIndex('#account_gl', 1);
      GLPage.elements.msProcess().click();
      GLPage.elements.msPinModal().should('be.visible');
      GLPage.elements.msPinInput().should('have.attr', 'type', 'password');
      cy.get('#mass_saving_pin_modal button[data-dismiss="modal"]').contains('Batal').click();
      GLPage.elements.msPinModal().should('not.be.visible');
    });
  });
});
