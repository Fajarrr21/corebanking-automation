/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_TandaTangan.json
// Tab "Tanda Tangan SPH" (/setting?menu=signature). Data penanda tangan punya fitur tambah/ubah/hapus
// → reversible. Nama QA<ts>; semua nama yang dibuat dihapus di afterEach lewat endpoint delete
// (hanya baris yang kolom "Nama"-nya persis nama QA milik test ini).
// Catatan koordinasi: pengaturan penanda tangan per cabang di /office dipegang agent modul Kantor.
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Tanda Tangan SPH', () => {
  let fx;
  let created = [];
  const F = () => fx.paths.signature;

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    created = [];
  });

  afterEach(() => {
    PengaturanPage.cleanupByName({
      menu: 'signature',
      tableSel: fx.signature.table,
      nameCol: 0,
      names: created,
      idFromRow: (tr) => PengaturanPage.signatureIdFromRow(tr),
      deletePath: fx.paths.signatureDelete,
      idField: 'id_signature',
    });
  });

  /** Buat penanda tangan QA lewat request. officeIds opsional. Mengembalikan {name, officeId, officeName}. */
  const seedSignature = (withOffice) => cy.qaName('TTD').then((name) => {
    created.push(name);
    return PengaturanPage.fetchDoc('/setting?menu=signature').then((doc) => {
      const opt = Cypress.$(doc).find(`form[action$="${F()}"] select[name="office_ids[]"] option`).first();
      const body = { name, occupation: fx.signature.occupation };
      if (withOffice) body['office_ids[]'] = opt.val();
      PengaturanPage.postForm(F(), body).its('status').should('eq', 200);
      return cy.then(() => ({ name, officeId: opt.val(), officeName: opt.text().trim() }));
    });
  });

  const openRowButton = (name, target) => {
    PengaturanPage.search(fx.signature.table, name);
    PengaturanPage.rowWhereColumn(fx.signature.table, 0, name).find(`button[data-target="${target}"]`).click();
    cy.get(target).should('be.visible');
  };

  describe('Tampilan & validasi klien (read-only)', () => {
    beforeEach(() => {
      PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
      cy.guardWrites();
      PengaturanPage.openSetting('signature');
    });

    afterEach(() => {
      cy.assertNoWritesLeaked();
    });

    it('TC-SET-TTD-001 | Happy | Form dan tabel penanda tangan tampil lengkap', () => {
      cy.get('#tab_signature .caption-subject').first().should('contain.text', fx.signature.caption);
      PengaturanPage.elements.field(F(), 'name').should('have.attr', 'required');
      PengaturanPage.elements.field(F(), 'occupation').should('exist');
      PengaturanPage.elements.field(F(), 'office_ids[]').should('have.attr', 'multiple');
      PengaturanPage.elements.form(F()).find('.help-block').should('contain.text', fx.signature.officeHelp);
      PengaturanPage.assertHeaders(fx.signature.headers, fx.signature.table);
    });

    it('TC-SET-TTD-002 | Negatif | Nama penanda tangan kosong — tombol Simpan tidak bekerja', () => {
      PengaturanPage.elements.field(F(), 'name').clear();
      PengaturanPage.elements.field(F(), 'occupation').clear().type(fx.signature.occupation);
      PengaturanPage.elements.submit(F()).click();
      PengaturanPage.firstInvalidName(F()).should('eq', 'name');
      cy.blockedWrites().should('deep.eq', []);
    });

    it('TC-SET-TTD-003 | Positif | Jabatan penanda tangan bersifat opsional', () => {
      PengaturanPage.elements.field(F(), 'name').clear().type('QA-cek-validitas');
      PengaturanPage.elements.field(F(), 'occupation').clear();
      PengaturanPage.firstInvalidName(F()).should('eq', null);
    });

    it('TC-SET-TTD-004 | Positif | Pilihan Kantor memakai select2 dengan placeholder Semua kantor', () => {
      PengaturanPage.elements.field(F(), 'office_ids[]').should('have.class', 'select2-hidden-accessible');
      PengaturanPage.elements.form(F()).find('.select2-container').should('contain.text', 'Semua kantor');
    });
  });

  describe('Tambah, ubah, hapus penanda tangan QA (dengan cleanup)', () => {
    beforeEach(() => {
      PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    });

    it('TC-SET-TTD-005 | Happy | Tambah penanda tangan QA tanpa kantor berlaku untuk Semua Kantor', () => {
      cy.guardWrites({ allow: [new RegExp(`^${F()}$`)] });
      PengaturanPage.openSetting('signature');
      cy.qaName('TTD').then((name) => {
        created.push(name);
        PengaturanPage.elements.field(F(), 'name').type(name);
        PengaturanPage.elements.field(F(), 'occupation').type(fx.signature.occupation);
        PengaturanPage.elements.submit(F()).click();
        PengaturanPage.assertSuccess(fx.signature.msgCreate);
        cy.location('search').should('include', 'menu=signature');
        PengaturanPage.search(fx.signature.table, name);
        PengaturanPage.rowWhereColumn(fx.signature.table, 0, name).within(() => {
          cy.get('td').eq(1).should('have.text', fx.signature.occupation);
          cy.get('td').eq(2).should('have.text', fx.signature.allOffices);
        });
      });
    });

    it('TC-SET-TTD-006 | Positif | Tambah penanda tangan QA untuk satu kantor menampilkan nama kantor tersebut', () => {
      cy.guardWrites({ allow: [new RegExp(`^${F()}$`)] });
      PengaturanPage.openSetting('signature');
      PengaturanPage.elements.field(F(), 'office_ids[]').find('option').first().then(($o) => {
        const officeName = $o.text().trim();
        cy.qaName('TTD').then((name) => {
          created.push(name);
          PengaturanPage.elements.field(F(), 'name').type(name);
          PengaturanPage.elements.field(F(), 'occupation').type(fx.signature.occupation);
          PengaturanPage.elements.field(F(), 'office_ids[]').select([$o.val()], { force: true });
          PengaturanPage.elements.submit(F()).click();
          PengaturanPage.assertSuccess(fx.signature.msgCreate);
          PengaturanPage.search(fx.signature.table, name);
          PengaturanPage.rowWhereColumn(fx.signature.table, 0, name).find('td').eq(2).should('have.text', officeName);
        });
      });
    });

    it('TC-SET-TTD-007 | Positif | Modal Edit memuat nama, jabatan, dan kantor penanda tangan QA', () => {
      seedSignature(true).then((s) => {
        cy.guardWrites();
        PengaturanPage.openSetting('signature');
        openRowButton(s.name, fx.signature.editModal);
        cy.get('#name_signature').should('have.value', s.name);
        cy.get('#occupation_signature').should('have.value', fx.signature.occupation);
        cy.get('#signature_offices_edit').should(($sel) => expect($sel.val()).to.deep.eq([s.officeId]));
        cy.assertNoWritesLeaked();
      });
    });

    it('TC-SET-TTD-008 | Positif | Ubah nama penanda tangan QA tidak mengubah kantornya', () => {
      seedSignature(true).then((s) => {
        const renamed = `${s.name} Ubah`;
        created.push(renamed);
        cy.guardWrites({ allow: [new RegExp(`^${F()}/update$`)] });
        PengaturanPage.openSetting('signature');
        openRowButton(s.name, fx.signature.editModal);
        cy.get('#name_signature').clear().type(renamed);
        cy.get(`${fx.signature.editModal} button[type="submit"]`).click();
        PengaturanPage.assertSuccess(fx.signature.msgUpdate);
        PengaturanPage.search(fx.signature.table, renamed);
        PengaturanPage.rowWhereColumn(fx.signature.table, 0, renamed).find('td').eq(2).should('have.text', s.officeName);
      });
    });

    it('TC-SET-TTD-009 | Positif | Hapus penanda tangan QA berhasil', () => {
      seedSignature(false).then((s) => {
        cy.guardWrites({ allow: [new RegExp(`^${fx.paths.signatureDelete}$`)] });
        PengaturanPage.openSetting('signature');
        openRowButton(s.name, fx.signature.deleteModal);
        cy.get(`${fx.signature.deleteModal} button[type="submit"]`).click();
        PengaturanPage.assertSuccess(fx.signature.msgDelete);
        PengaturanPage.allRows(fx.signature.table).then((rows) => {
          expect(rows.filter((r) => r[0] === s.name), 'penanda tangan QA terhapus').to.have.length(0);
        });
      });
    });

    it('TC-SET-TTD-010 | Negatif | Batal hapus (Close) tidak menghapus penanda tangan', () => {
      seedSignature(false).then((s) => {
        cy.guardWrites();
        PengaturanPage.openSetting('signature');
        openRowButton(s.name, fx.signature.deleteModal);
        cy.get(`${fx.signature.deleteModal} button[data-dismiss="modal"]`).contains('Close').click();
        cy.get(fx.signature.deleteModal).should('not.be.visible');
        cy.assertNoWritesLeaked();
        PengaturanPage.rowWhereColumn(fx.signature.table, 0, s.name).should('have.length', 1);
      });
    });
  });
});
