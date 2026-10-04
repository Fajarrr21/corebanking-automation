/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_Jurnal.json
// Template jurnal (setting_journals) punya fitur tambah/ubah/hapus → reversible.
// Data uji bernama QA<ts> (cy.qaName); setiap nama yang dibuat dicatat lalu dihapus di afterEach
// lewat endpoint delete (hanya baris yang kolom "Nama Jurnal"-nya persis nama QA milik test ini).
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Jurnal', () => {
  let fx;
  let created = [];
  const J = '#tab_journal';

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    created = [];
  });

  afterEach(() => {
    PengaturanPage.cleanupByName({
      menu: 'journal',
      tableSel: fx.journal.table,
      nameCol: 1,
      names: created,
      idFromRow: (tr) => PengaturanPage.journalIdFromRow(tr),
      deletePath: fx.paths.journalDelete,
      idField: 'id',
    });
  });

  /** Buat jurnal QA lewat request (persiapan test ubah/hapus). */
  const seedJournal = () => cy.qaName('Jurnal').then((name) => {
    created.push(name);
    PengaturanPage.fetchDoc('/setting?menu=journal').then((doc) => {
      const debit = PengaturanPage.firstOptionValue(doc, fx.paths.journal, 'account_debit');
      const credit = PengaturanPage.firstOptionValue(doc, fx.paths.journal, 'account_credit');
      PengaturanPage.postForm(fx.paths.journal, { name, account_debit: debit, account_credit: credit })
        .its('status').should('eq', 200);
    });
    return cy.then(() => name);
  });

  describe('Tampilan & validasi klien (read-only)', () => {
    beforeEach(() => {
      cy.guardWrites();
      PengaturanPage.openSetting('journal');
    });

    afterEach(() => {
      cy.assertNoWritesLeaked();
    });

    it('TC-SET-JURNAL-001 | Happy | Form dan tabel Pengaturan Jurnal tampil lengkap', () => {
      PengaturanPage.elements.field(fx.paths.journal, 'name')
        .should('have.attr', 'required');
      PengaturanPage.elements.field(fx.paths.journal, 'name')
        .should('have.attr', 'placeholder', fx.journal.namePlaceholder);
      PengaturanPage.elements.field(fx.paths.journal, 'account_debit').find('option').should('have.length.greaterThan', 0);
      PengaturanPage.elements.field(fx.paths.journal, 'account_credit').find('option').should('have.length.greaterThan', 0);
      PengaturanPage.elements.submit(fx.paths.journal).should('contain.text', fx.journal.submitLabel);
      PengaturanPage.assertHeaders(fx.journal.headers, fx.journal.table);
    });

    it('TC-SET-JURNAL-002 | Positif | Kolom Akun Debit dan Akun Kredit menampilkan nama akun dengan posisi (DEBET/KREDIT)', () => {
      PengaturanPage.allRows(fx.journal.table).then((rows) => {
        const re = new RegExp(fx.journal.accountCellRegex);
        if (!rows.length) {
          cy.log('Belum ada template jurnal — hanya empty-state yang diverifikasi');
          PengaturanPage.emptyState(fx.journal.table).should('exist');
          return;
        }
        rows.forEach((r) => {
          expect(re.test(r[2]), `akun debit "${r[2]}"`).to.eq(true);
          expect(re.test(r[3]), `akun kredit "${r[3]}"`).to.eq(true);
        });
      });
    });

    it('TC-SET-JURNAL-003 | Negatif | Nama Jurnal kosong — form tidak terkirim', () => {
      PengaturanPage.elements.field(fx.paths.journal, 'name').clear();
      PengaturanPage.elements.submit(fx.paths.journal).click();
      PengaturanPage.firstInvalidName(fx.paths.journal).should('eq', 'name');
      cy.blockedWrites().should('deep.eq', []);
    });
  });

  describe('Tambah, ubah, hapus jurnal QA (dengan cleanup)', () => {
    it('TC-SET-JURNAL-004 | Happy | Tambah template jurnal QA berhasil dan tampil di tabel', () => {
      cy.guardWrites({ allow: [new RegExp(`^${fx.paths.journal}$`)] });
      PengaturanPage.openSetting('journal');
      cy.qaName('Jurnal').then((name) => {
        created.push(name);
        PengaturanPage.elements.field(fx.paths.journal, 'name').clear().type(name);
        PengaturanPage.elements.submit(fx.paths.journal).click();
        PengaturanPage.assertSuccess(fx.journal.msgCreate);
        cy.location('search').should('include', 'menu=journal');
        PengaturanPage.search(fx.journal.table, name);
        PengaturanPage.rowWhereColumn(fx.journal.table, 1, name).should('have.length', 1);
      });
    });

    it('TC-SET-JURNAL-005 | Positif | Ubah nama template jurnal QA berhasil', () => {
      seedJournal().then((name) => {
        const renamed = `${name} Ubah`;
        created.push(renamed);
        cy.guardWrites({ allow: [new RegExp(`^${fx.paths.journal}/update$`)] });
        PengaturanPage.openSetting('journal');
        PengaturanPage.search(fx.journal.table, name);
        PengaturanPage.rowWhereColumn(fx.journal.table, 1, name).find('button[data-target="#editjurnal"]').click();
        cy.get(fx.journal.editModal).should('be.visible');
        cy.get('#name_journal_edit').should('have.value', name).clear().type(renamed);
        cy.get(`${fx.journal.editModal} button[type="submit"]`).click();
        PengaturanPage.assertSuccess(fx.journal.msgUpdate);
        PengaturanPage.search(fx.journal.table, renamed);
        PengaturanPage.rowWhereColumn(fx.journal.table, 1, renamed).should('have.length', 1);
      });
    });

    it('TC-SET-JURNAL-006 | Positif | Hapus template jurnal QA lewat konfirmasi berhasil', () => {
      seedJournal().then((name) => {
        cy.guardWrites({ allow: [new RegExp(`^${fx.paths.journalDelete}$`)] });
        PengaturanPage.openSetting('journal');
        PengaturanPage.search(fx.journal.table, name);
        PengaturanPage.rowWhereColumn(fx.journal.table, 1, name).find('button[data-target="#deletejurnal"]').click();
        cy.get(fx.journal.deleteModal).should('be.visible');
        cy.get('#name_journal_delete').should('have.text', name);
        cy.get(`${fx.journal.deleteModal} button[type="submit"]`).click();
        PengaturanPage.assertSuccess(fx.journal.msgDelete);
        PengaturanPage.allRows(fx.journal.table).then((rows) => {
          expect(rows.filter((r) => r[1] === name), 'jurnal QA sudah terhapus').to.have.length(0);
        });
      });
    });

    it('TC-SET-JURNAL-007 | Negatif | Batal hapus (Close) tidak menghapus template jurnal', () => {
      seedJournal().then((name) => {
        cy.guardWrites();
        PengaturanPage.openSetting('journal');
        PengaturanPage.search(fx.journal.table, name);
        PengaturanPage.rowWhereColumn(fx.journal.table, 1, name).find('button[data-target="#deletejurnal"]').click();
        cy.get(fx.journal.deleteModal).should('be.visible');
        cy.get(`${fx.journal.deleteModal} button[data-dismiss="modal"]`).contains('Close').click();
        cy.get(fx.journal.deleteModal).should('not.be.visible');
        cy.assertNoWritesLeaked();
        PengaturanPage.rowWhereColumn(fx.journal.table, 1, name).should('have.length', 1);
      });
    });
  });
});
