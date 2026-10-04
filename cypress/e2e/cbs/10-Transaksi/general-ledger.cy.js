// Transaksi > General Ledger (/transaction/general_ledger) — tab Pembukuan,
// Overbooking GL (fitur "Pilih Kas Teller"), Riwayat, Riwayat Akun GL.
// TC sumber: docs/test-cases/src/TC_Transaksi_GL.json
// PRD: "Over Booking - Pilih Kas Teller", "Transaksi Massal GL to GL" (bagian Riwayat).
// Read-only: write-guard aktif, modal PIN TIDAK pernah disubmit.
import LoginPage from '../../../support/pageobjects/LoginPage';
import GLPage from '../../../support/pageobjects/Transaksi/GeneralLedgerPage';

describe('Transaksi - General Ledger (/transaction/general_ledger)', () => {
  let fx;
  let g;

  before(() => {
    cy.fixture('transaksi/transaksi').then((d) => {
      fx = d;
      g = d.gl;
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

  describe('Tampilan halaman', () => {
    it('TC-TRX-GL-001 | Happy | Halaman General Ledger tampil dengan 6 tab dan tab Pembukuan aktif default', () => {
      GLPage.openGuarded(g.path, fx.roleHint);
      GLPage.assertBreadcrumb(g.breadcrumb);
      cy.get('ul.nav-pills > li > a').should(($a) => {
        const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
        expect(labels).to.deep.eq(g.tabs.map((t) => t.label));
      });
      GLPage.elements.tabPane('#accounting').should('have.class', 'active');
      GLPage.elements.caption('#accounting').should('contain.text', g.accountingCaption);
    });
  });

  describe('Tab Pembukuan', () => {
    it('TC-TRX-GL-002 | Positif | Form Pembukuan memuat Jenis Transaksi, Teller, Jumlah, Catatan, Backdate dan tombol Submit', () => {
      GLPage.openMenu('accounting', fx.roleHint);
      GLPage.elements.accJournal().should('have.attr', 'required');
      GLPage.elements.accJournal().find('option').first().should('have.text', 'Pilih Jenis Transaksi');
      GLPage.elements.accTeller().should('have.attr', 'name', 'teller_user');
      GLPage.elements.accAmount().should('have.attr', 'required');
      GLPage.elements.accNotes().should('not.have.attr', 'required');
      GLPage.elements.accBackdateCheck().should('not.be.checked');
      GLPage.elements.accSubmit().should('be.visible').and('contain.text', 'Submit');
    });

    it('TC-TRX-GL-003 | Negatif | Submit Pembukuan tanpa Jumlah ditolak client-side dan modal PIN tidak terbuka', () => {
      GLPage.openMenu('accounting', fx.roleHint);
      GLPage.elements.accSubmit().click();
      GLPage.invalidField('#accounting_form', 'amount');
      GLPage.elements.accPinModal().should('not.be.visible');
    });
  });

  describe('Tab Overbooking GL — Pilih Kas Teller', () => {
    it('TC-TRX-GL-004 | Positif | Form Overbooking GL memuat Nama Transaksi, Posisi Debit/Kredit, Teller, Jumlah, Catatan', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      GLPage.elements.caption('#overbooking').should('contain.text', g.overbookingCaption);
      GLPage.elements.obName().should('have.attr', 'required');
      GLPage.elements.obDebit().should('have.attr', 'required');
      GLPage.elements.obCredit().should('have.attr', 'required');
      GLPage.elements.obTeller().should('have.attr', 'required');
      GLPage.elements.obAmount().should('have.attr', 'required');
      GLPage.elements.obNotes().should('not.have.attr', 'required');
      // Opsi akun GL berformat "<nama akun> - <nomor akun>".
      GLPage.elements.obDebit().find('option').not('[disabled]').each(($o) => {
        expect($o.text().trim()).to.match(/^.+ - \d+$/);
      });
    });

    it('TC-TRX-GL-005 | Negatif | Submit Overbooking kosong: Nama Transaksi & Jumlah ditandai wajib, modal PIN tidak terbuka', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      GLPage.elements.obSubmit().click();
      GLPage.invalidField('#overbooking_form', 'name');
      GLPage.invalidField('#overbooking_form', 'amount');
      GLPage.elements.obPinModal().should('not.be.visible');
    });

    it('TC-TRX-GL-006 | Positif | Pilihan Kas Teller menampilkan nama pengguna beserta saldo kas terkini', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      const re = new RegExp(g.tellerOptionPattern);
      GLPage.elements.obTeller().find('option').should(($o) => {
        expect($o.length, 'jumlah pilihan teller').to.be.greaterThan(0);
        Cypress.$.makeArray($o).forEach((o) => expect(o.textContent.replace(/\s+/g, ' ').trim()).to.match(re));
      });
      GLPage.elements.obTellerHelp().should('contain.text', g.tellerHelp);
    });

    it('TC-TRX-GL-007 | Positif | Kas Teller terisi default (pengguna login) dan dapat dicari berdasarkan nama', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      GLPage.elements.obTeller().find('option:selected').invoke('text').then((selectedText) => {
        expect(selectedText.trim(), 'teller default terpilih').to.not.eq('');
        const name = selectedText.split(' - ')[0].trim();
        GLPage.elements.obTeller().siblings('.select2-container').first().click();
        cy.get('.select2-container--open .select2-search__field').should('be.visible').type(name);
        cy.get('.select2-results__option').should('contain.text', name);
        cy.get('.select2-container--open .select2-search__field').type('{esc}');
      });
    });

    it('TC-TRX-GL-008 | Negatif | Jumlah hanya menerima angka positif (huruf & tanda minus diabaikan)', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      GLPage.elements.obAmount().click().type('-5000abc');
      GLPage.elements.obAmount().should(($i) => {
        const v = $i.val();
        expect(v, 'tanpa huruf').to.not.match(/[a-z]/i);
        expect(v, 'tanpa minus').to.not.include('-');
        expect(Number(v.replace(/[^0-9]/g, '')), 'nominal').to.eq(5000);
      });
    });

    it('TC-TRX-GL-009 | Edge | Tanggal transaksi (Backdate) tersembunyi default dan tidak bisa diisi tanggal masa depan', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      GLPage.elements.obBackdateDate().should('not.be.visible').and('be.disabled');
      GLPage.elements.obBackdateCheck().check();
      GLPage.elements.obBackdateDate().should('be.visible').and('not.be.disabled');
      GLPage.elements.obBackdateHelp().should('be.visible').and('contain.text', g.backdateHelp);
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      GLPage.elements.obBackdateDate().should(($d) => {
        const max = $d.attr('max');
        expect(max, 'atribut max berformat tanggal').to.match(/^\d{4}-\d{2}-\d{2}$/);
        expect(max <= iso, `max (${max}) tidak melewati hari ini (${iso})`).to.eq(true);
      });
    });

    it('TC-TRX-GL-010 | Positif | Form Overbooking valid membuka modal PIN Supervisor, Batal menutup tanpa mengirim', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      GLPage.elements.obName().type('QA overbooking tidak dikirim');
      GLPage.pickOptionByIndex('#account_debit', 1);
      GLPage.pickOptionByIndex('#account_credit', 2);
      GLPage.elements.obAmount().click().type('1000');
      GLPage.elements.obSubmit().click();
      GLPage.elements.obPinModal().should('be.visible').and('contain.text', g.pinModalTitle);
      GLPage.elements.obModalSpv().should('exist');
      GLPage.elements.obModalPin().should('have.attr', 'required');
      cy.get('#overbooking_pinspv button[data-dismiss="modal"]').contains('Batal').click();
      GLPage.elements.obPinModal().should('not.be.visible');
    });

    it('TC-TRX-GL-011 | Positif | Form Over Booking memiliki field Cabang, Kas Asal dan Kas Tujuan (pilihan kas teller)', () => {
      GLPage.openMenu('overbooking', fx.roleHint);
      cy.get('#overbooking_form label.control-label').should(($l) => {
        const labels = Cypress.$.makeArray($l).map((l) => l.innerText.replace(/[*\s]+/g, ' ').trim());
        expect(labels, 'label form Over Booking').to.include.members(['Cabang', 'Kas Asal', 'Kas Tujuan']);
      });
    });
  });

  describe('Tab Riwayat', () => {
    it('TC-TRX-GL-012 | Positif | Riwayat menampilkan kolom transaksi sesuai PRD', () => {
      cy.intercept('GET', g.historyDataUrl).as('glHistory');
      GLPage.openMenu('history', fx.roleHint);
      cy.wait('@glHistory').its('response.statusCode').should('eq', 200);
      GLPage.waitTable('#data-table-history', fx.timeouts.table).assertHeaders(g.historyHeaders, '#data-table-history');
    });

    it('TC-TRX-GL-013 | Positif | Filter Range Date mengirim tanggal awal-akhir dan baris berada dalam rentang', () => {
      cy.intercept('GET', g.historyDataUrl).as('glHistory');
      GLPage.openMenu('history', fx.roleHint);
      cy.wait('@glHistory');
      GLPage.waitTable('#data-table-history', fx.timeouts.table);
      cy.window().then((win) => {
        win.$('#date').val(g.historyRange.from);
        win.$('#date2').val(g.historyRange.to).trigger('change');
      });
      cy.wait('@glHistory').then(({ request, response }) => {
        expect(request.url).to.include(`date=${g.historyRange.from}`).and.include(`date2=${g.historyRange.to}`);
        expect(response.statusCode).to.eq(200);
      });
      GLPage.waitTable('#data-table-history', fx.timeouts.table);
      GLPage.assertEveryRowColumn(
        3,
        (t) => {
          const d = t.slice(0, 10);
          return d >= g.historyRange.from && d <= g.historyRange.to;
        },
        'Tgl Transaksi dalam rentang',
        '#data-table-history',
      );
    });

    it('TC-TRX-GL-014 | Positif | Tombol export CSV dan Excel tersedia di Riwayat', () => {
      GLPage.openMenu('history', fx.roleHint);
      cy.get('#buttonhistory').within(() => {
        cy.get('.buttons-csv').should('exist');
        cy.get('.buttons-excel').should('exist');
      });
    });

    it('TC-TRX-GL-015 | Edge | Pencarian Riwayat tanpa kecocokan menampilkan empty-state', () => {
      cy.intercept('GET', g.historyDataUrl).as('glHistory');
      GLPage.openMenu('history', fx.roleHint);
      cy.wait('@glHistory');
      GLPage.tableSearch('#data-table-history').type(g.searchNoMatch);
      cy.wait('@glHistory');
      GLPage.waitTable('#data-table-history', fx.timeouts.table);
      GLPage.emptyState('#data-table-history').should('be.visible');
    });
  });

  describe('Tab Riwayat Akun GL', () => {
    it('TC-TRX-GL-016 | Positif | Riwayat Akun GL menampilkan kolom saldo awal, debit, kredit, saldo akhir', () => {
      cy.intercept('GET', g.historyGlDataUrl).as('glHistory2');
      GLPage.openMenu('historygl', fx.roleHint);
      cy.wait('@glHistory2').its('response.statusCode').should('eq', 200);
      GLPage.waitTable('#data-table-history-gl', fx.timeouts.table).assertHeaders(g.historyGlHeaders, '#data-table-history-gl');
    });
  });
});
