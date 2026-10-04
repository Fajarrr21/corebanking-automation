/// <reference types="cypress" />
import AoPage from '../../../support/pageobjects/RKA/RkaAccountOfficerPage';

// RKA > Account Officer — Setting, Edit, Status & Hapus target RKA AO.
// TC  : docs/test-cases/src/TC_RKAAO_Target.json
// PRD : "BKDP RKA - Setting Target AO", "BKDP RKA - Edit Setting Target AO",
//       "BKDP RKA - Delete Setting Target AO", "BKDP RKA - AO".
//
// DATA UJI: spec membuat SATU Account Officer khusus test (nama "QA<ts>... AO RKA",
// email qa+...@example.invalid) di before(). Semua target RKA hanya dibuat untuk
// officer itu (tahun berjalan). Cleanup column-scoped di afterEach: rka_entity yang
// kolom "Nama Account Officer"-nya PERSIS nama QA tsb dihapus; after() juga
// menghapus officer-nya. Write-guard per test hanya membuka endpoint yang diuji.

describe('RKA Account Officer - Setting, Edit & Hapus Target', () => {
  let fx;
  const year = new Date().getFullYear();
  const officer = {};
  const TARGET_PATH = /^\/rka\/accountofficer\/target$/;
  const TOGGLE_PATH = /^\/rka\/accountofficer\/\d+\/toggle-status$/;
  const DELETE_PATH = /^\/rka\/accountofficer\/\d+$/;

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
    cy.qaName('AO RKA').then((n) => (officer.name = n));
    cy.qaEmail().then((e) => (officer.email = e));
    cy.then(() => AoPage.seedOfficer(officer.name, officer.email)).then((id) => (officer.id = id));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.then(() => {
      cy.intercept('POST', fx.endpoints.aoTarget).as('postTarget');
      cy.intercept('GET', fx.endpoints.aoDetails).as('aoDetails');
    });
  });

  afterEach(() => {
    AoPage.cleanup(officer.name);
  });

  after(() => {
    AoPage.cleanup(officer.name, officer.id);
  });

  /** Seed target lalu buka daftar & filter ke baris officer QA. Yield id rka_entity. */
  const seedAndFind = (data = fx.target.increase) => {
    AoPage.seedTarget(officer.id, year, data);
    return AoPage.entityId(officer.name).then((id) => {
      AoPage.assertAccessible().searchList(officer.name);
      return cy.then(() => id);
    });
  };

  const fillAndSubmit = (data, opts) => {
    AoPage.selectOfficer(officer.name).selectYear(year).fillTargets(data, opts).goToTab('lainnya').submit();
  };

  describe('Setting target AO', () => {
    it('TC-RKAAO-TARGET-001 | Happy | simpan target AO baru tampil di daftar RKA', () => {
      cy.guardWrites({ allow: [TARGET_PATH] });
      AoPage.visit();
      fillAndSubmit(fx.target.increase);
      cy.wait('@postTarget').its('response.statusCode').should('eq', 302);
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
      AoPage.assertSuccess(fx.ao.messages.saved);
      AoPage.productRowCount().then((nProd) => {
        AoPage.rowsByName(officer.name).then((rows) => {
          expect(rows, 'baris RKA officer QA').to.have.length(1);
          const c = rows[0].cells;
          expect(c[fx.ao.col.year]).to.eq(String(year));
          expect(c[fx.ao.col.status]).to.eq(fx.toggle.badgeInactive);
          expect(c[fx.ao.col.produk]).to.eq(`${nProd} Produk`);
          expect(c[fx.ao.col.parameter]).to.eq(`${fx.form.othersCount} Parameter`);
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-002 | Positif | jenis Kenaikan menghitung Target Tahun Ini otomatis', () => {
      cy.guardWrites();
      AoPage.visit();
      AoPage.fillTargets(fx.target.increase);
      cy.get('#pinjaman tbody tr').first().within(() => {
        cy.get('input.target-result').should('have.value', String(fx.target.increase.expectedThisYear));
        cy.get('.idr-display').should('have.text', fx.target.increase.expectedDisplay);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-003 | Positif | jenis Penurunan menghitung Target Tahun Ini otomatis', () => {
      cy.guardWrites();
      AoPage.visit();
      AoPage.fillTargets(fx.target.decrease);
      cy.get('#pinjaman tbody tr').first().within(() => {
        cy.get('input.target-result').should('have.value', String(fx.target.decrease.expectedThisYear));
        cy.get('.idr-display').should('have.text', fx.target.decrease.expectedDisplay);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-004 | Negatif | simpan tanpa memilih Account Officer ditolak', () => {
      cy.guardWrites();
      AoPage.visit();
      AoPage.selectYear(year).fillTargets(fx.target.increase).goToTab('lainnya').submit();
      AoPage.elements.aoSelect().should(($s) => {
        expect($s[0].checkValidity(), 'select Account Officer valid?').to.eq(false);
        expect($s[0].validationMessage, 'pesan validasi').to.not.be.empty;
      });
      cy.location('pathname').should('eq', fx.ao.path);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-005 | Negatif | indikator Lainnya (NPL/Daftar Hitam/Laba) kosong ditolak dengan pesan error', () => {
      cy.guardWrites({ allow: [TARGET_PATH] });
      AoPage.visit();
      fillAndSubmit(fx.target.increase, { only: ['pinjaman', 'simpanan'] });
      cy.wait('@postTarget');
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
      AoPage.assertError();
      AoPage.rowsByName(officer.name).should('have.length', 0);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-006 | Negatif | AO yang sudah punya target tidak bisa diatur target kedua (pesan error)', () => {
      seedAndFind().then((id) => {
        cy.guardWrites({ allow: [TARGET_PATH] });
        AoPage.visit();
        fillAndSubmit(fx.target.decrease);
        cy.wait('@postTarget');
        cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
        AoPage.assertError();
        AoPage.details(id).then((body) => {
          body.data.details.forEach((d) => expect(d.change_type, 'target lama tidak berubah').to.eq('increase'));
        });
        AoPage.rowsByName(officer.name).should('have.length', 1);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-007 | Edge | persentase negatif ditolak validasi server', () => {
      cy.guardWrites({ allow: [TARGET_PATH] });
      AoPage.visit();
      fillAndSubmit(fx.target.increase, { overrideFirst: { percentage: fx.target.negativePercentage } });
      cy.wait('@postTarget');
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
      AoPage.common.validationItems().should('have.length.greaterThan', 0);
      AoPage.rowsByName(officer.name).should('have.length', 0);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Edit target AO & status', () => {
    it('TC-RKAAO-TARGET-008 | Happy | form edit menampilkan nilai target yang sudah tersimpan', () => {
      seedAndFind().then((id) => {
        cy.guardWrites();
        AoPage.clickRowAction('edit-rka', id);
        cy.wait('@aoDetails');
        AoPage.elements.editModal().should('be.visible');
        AoPage.elements.editTitle().should('contain.text', officer.name).and('contain.text', String(year));
        cy.get('#editLoansContainer tbody tr').first().within(() => {
          cy.get('select.target-type-select').should('have.value', fx.target.increase.type);
          cy.get('input.target-input').invoke('val').then((v) => expect(Number(v)).to.eq(fx.target.increase.lastYear));
          cy.get('input.percentage-input').invoke('val').then((v) => expect(Number(v)).to.eq(fx.target.increase.percentage));
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-009 | Happy | ubah persentase target lalu simpan memperbarui RKA', () => {
      seedAndFind().then((id) => {
        cy.guardWrites({ allow: [TARGET_PATH] });
        AoPage.clickRowAction('edit-rka', id);
        cy.wait('@aoDetails');
        AoPage.elements.editModal().should('be.visible');
        cy.get('#editLoansContainer tbody tr').should('have.length.greaterThan', 0);
        AoPage.fillTargetsInEdit(fx.target.edit);
        AoPage.elements.editSubmit().click();
        cy.wait('@postTarget');
        cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
        AoPage.assertSuccess(fx.ao.messages.updated);
        AoPage.details(id).then((body) => {
          expect(body.data.details.length).to.be.greaterThan(0);
          body.data.details.forEach((d) => {
            expect(Number(d.percentage), 'persentase baru').to.eq(fx.target.edit.percentage);
            expect(Number(d.target_value), 'target tahun ini baru').to.eq(fx.target.edit.expectedThisYear);
          });
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-010 | Positif | Account Officer tidak dapat diubah di form edit (read-only)', () => {
      seedAndFind().then((id) => {
        cy.guardWrites();
        AoPage.clickRowAction('edit-rka', id);
        cy.wait('@aoDetails');
        AoPage.elements.editForm().find('select[name="account_officer_id"]').should('not.exist');
        AoPage.elements.editForm().find('#edit_account_officer_id')
          .should('have.attr', 'type', 'hidden').and('have.value', String(officer.id));
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-011 | Happy | mengaktifkan status RKA AO lewat konfirmasi', () => {
      seedAndFind().then((id) => {
        cy.guardWrites({ allow: [TOGGLE_PATH] });
        cy.intercept('POST', fx.endpoints.aoToggle).as('toggle');
        AoPage.clickRowAction('toggle-status', id);
        AoPage.elements.toggleModal().should('be.visible');
        AoPage.elements.toggleMessage().should('contain.text', fx.toggle.activateText);
        AoPage.elements.toggleConfirm().should('contain.text', fx.toggle.confirm).click();
        cy.wait('@toggle').its('response.body.success').should('eq', true);
        cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
        AoPage.assertSuccess(fx.ao.messages.activated);
        AoPage.rowsByName(officer.name).then((rows) => {
          expect(rows[0].cells[fx.ao.col.status]).to.eq(fx.toggle.badgeActive);
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-012 | Positif | batal ubah status tidak mengubah RKA', () => {
      seedAndFind().then((id) => {
        cy.guardWrites();
        AoPage.clickRowAction('toggle-status', id);
        AoPage.elements.toggleModal().should('be.visible');
        AoPage.elements.toggleCancel().click();
        AoPage.elements.toggleModal().should('not.be.visible');
        AoPage.rowsByName(officer.name).then((rows) => {
          expect(rows[0].cells[fx.ao.col.status]).to.eq(fx.toggle.badgeInactive);
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-013 | Happy | lihat detail RKA AO menampilkan modal detail', () => {
      seedAndFind().then((id) => {
        cy.guardWrites();
        AoPage.clickRowAction('view-details', id);
        cy.wait('@aoDetails').its('response.body.success').should('eq', true);
        AoPage.elements.detailModal().should('be.visible');
        AoPage.elements.detailTitle().should('have.text', `Detail RKA - ${officer.name} (${year})`);
        AoPage.elements.detailContent().find('.alert-danger').should('not.exist');
        AoPage.elements.detailContent().should('not.contain.text', 'Memuat detail RKA');
      });
      cy.assertNoWritesLeaked();
    });
  });

  describe('Hapus target AO', () => {
    it('TC-RKAAO-TARGET-014 | Happy | hapus target AO dengan konfirmasi Ya', () => {
      seedAndFind().then((id) => {
        cy.guardWrites({ allow: [DELETE_PATH] });
        cy.intercept('DELETE', `**/rka/accountofficer/${id}`).as('deleteRka');
        AoPage.clickRowAction('delete-rka', id);
        AoPage.elements.deleteModal().should('be.visible')
          .and('contain.text', fx.delete.modalTitle).and('contain.text', fx.delete.question);
        AoPage.elements.deleteConfirm().should('contain.text', fx.delete.confirm).click();
        cy.wait('@deleteRka').its('response.body.success').should('eq', true);
        cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
        AoPage.assertSuccess(fx.ao.messages.deleted);
        AoPage.rowsByName(officer.name).should('have.length', 0);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-TARGET-015 | Positif | batal hapus menutup popup dan data tetap ada', () => {
      seedAndFind().then((id) => {
        cy.guardWrites();
        AoPage.clickRowAction('delete-rka', id);
        AoPage.elements.deleteModal().should('be.visible');
        AoPage.elements.deleteCancel().should('contain.text', fx.delete.cancel).click();
        AoPage.elements.deleteModal().should('not.be.visible');
        AoPage.rowsByName(officer.name).should('have.length', 1);
      });
      cy.assertNoWritesLeaked();
    });
  });
});
