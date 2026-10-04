/// <reference types="cypress" />
import UnitPage from '../../../support/pageobjects/RKA/RkaUnitPage';
import { describeIfFlag } from '../../../support/utils/flags';

// RKA > Cabang — Setting, Edit, Status & Hapus target RKA Unit.
// TC  : docs/test-cases/src/TC_RKAUnit_Target.json
// PRD : "BKDP RKA - Setting Target Unit", "BKDP RKA - Edit Setting Target Unit",
//       "BKDP RKA - Delete Setting Target Unit".
//
// ⚠️ DI-GATE FLAG `allowRkaTarget` (jalankan: --env allowRkaTarget=true).
// Target unit menempel ke kantor ASLI dan tidak punya kolom nama yang bisa ditandai
// "QA". Data uji dikenali dari kombinasi (Nama Cabang, Tahun = tahun berjalan + 2,
// lihat fixture unit.testYearOffset). before() MEMASTIKAN kombinasi itu belum punya
// RKA — kalau sudah ada, suite gagal (tidak akan menimpa/menghapus data orang lain,
// karena setTarget pada kombinasi yang sudah ada = mode UPDATE).
// Cleanup afterEach: hapus rka_entity (Nama Cabang, Tahun) uji tsb.

describeIfFlag('allowRkaTarget', 'RKA Cabang - Setting, Edit & Hapus Target', () => {
  let fx;
  let office;
  let year;
  const TARGET_PATH = /^\/rka\/unit\/target$/;
  const TOGGLE_PATH = /^\/rka\/unit\/\d+\/toggle-status$/;
  const DELETE_PATH = /^\/rka\/unit\/\d+$/;

  before(() => {
    cy.fixture('rka/rka').then((d) => {
      fx = d;
      year = new Date().getFullYear() + fx.unit.testYearOffset;
    });
    cy.then(() => cy.intercept('GET', fx.endpoints.unitsByBranch).as('unitsByBranch'));
    cy.then(() => UnitPage.visit());
    cy.then(() => UnitPage.resolveTestOffice(fx)).then((ctx) => {
      office = ctx;
    });
    cy.then(() => UnitPage.rowsFor(office.officeName, year)).then((rows) => {
      expect(
        rows,
        `Precondition: kombinasi "${office.officeName}" tahun ${year} BELUM punya RKA (ubah fixture unit.testOfficeName/testYearOffset bila sudah ada)`,
      ).to.have.length(0);
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.intercept('GET', fx.endpoints.unitsByBranch).as('unitsByBranch');
    cy.intercept('POST', fx.endpoints.unitTarget).as('postTarget');
    cy.intercept('GET', fx.endpoints.unitDetails).as('unitDetails');
  });

  afterEach(() => {
    if (office) UnitPage.cleanup(office.officeName, year);
  });

  const pickOfficeAndYear = () => {
    UnitPage.selectBranch(office.branchValue).selectOffice(office.officeValue).selectYear(year);
  };

  const seedAndFind = () => {
    UnitPage.seedTarget(office.officeValue, year, fx.target.increase);
    return UnitPage.entityId(office.officeName, year).then((id) => {
      UnitPage.assertAccessible().searchList(office.officeName);
      return cy.then(() => id);
    });
  };

  it('TC-RKAUNIT-TARGET-001 | Happy | simpan target unit baru tampil di daftar RKA Cabang', () => {
    cy.guardWrites({ allow: [TARGET_PATH] });
    UnitPage.visit();
    pickOfficeAndYear();
    UnitPage.fillTargets(fx.target.increase).goToTab('lainnya').submit();
    cy.wait('@postTarget').its('response.statusCode').should('eq', 302);
    cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.unit.path);
    UnitPage.assertSuccess(fx.unit.messages.saved);
    UnitPage.productRowCount().then((nProd) => {
      UnitPage.rowsFor(office.officeName, year).then((rows) => {
        expect(rows).to.have.length(1);
        expect(rows[0].cells[fx.unit.col.produk]).to.eq(`${nProd} Produk`);
        expect(rows[0].cells[fx.unit.col.parameter]).to.eq(`${fx.form.othersCount} Parameter`);
      });
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-TARGET-002 | Negatif | indikator Lainnya kosong ditolak server dan data tidak tersimpan', () => {
    cy.guardWrites({ allow: [TARGET_PATH] });
    UnitPage.visit();
    pickOfficeAndYear();
    UnitPage.fillTargets(fx.target.increase, { only: ['pinjaman', 'simpanan'] }).goToTab('lainnya').submit();
    cy.wait('@postTarget');
    cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.unit.path);
    UnitPage.common.validationItems().should('contain.text', fx.unit.messages.nplRequired);
    UnitPage.rowsFor(office.officeName, year).should('have.length', 0);
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-TARGET-003 | Happy | edit target unit: nilai lama tampil lalu persentase baru tersimpan', () => {
    seedAndFind().then((id) => {
      cy.guardWrites({ allow: [TARGET_PATH] });
      UnitPage.clickRowAction('edit-rka', id);
      cy.wait('@unitDetails');
      UnitPage.elements.editModal().should('be.visible');
      cy.get('#editLoansContainer tbody tr').first().within(() => {
        cy.get('select.target-type-select').should('have.value', fx.target.increase.type);
        cy.get('input.percentage-input').invoke('val').then((v) => expect(Number(v)).to.eq(fx.target.increase.percentage));
      });
      UnitPage.fillTargetsInEdit(fx.target.edit);
      UnitPage.elements.editSubmit().click();
      cy.wait('@postTarget');
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.unit.path);
      UnitPage.assertSuccess(fx.unit.messages.updated);
      UnitPage.details(id).then((body) => {
        body.data.details.forEach((d) => {
          expect(Number(d.percentage)).to.eq(fx.target.edit.percentage);
          expect(Number(d.target_value)).to.eq(fx.target.edit.expectedThisYear);
        });
      });
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-TARGET-004 | Positif | nama unit tidak dapat diubah di form edit', () => {
    seedAndFind().then((id) => {
      cy.guardWrites();
      UnitPage.clickRowAction('edit-rka', id);
      cy.wait('@unitDetails');
      UnitPage.elements.editForm().find('select[name="office_id"]').should('not.exist');
      UnitPage.elements.editForm().find('#edit_office_id')
        .should('have.attr', 'type', 'hidden').and('have.value', String(office.officeValue));
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-TARGET-005 | Happy | mengaktifkan status RKA unit', () => {
    seedAndFind().then((id) => {
      cy.guardWrites({ allow: [TOGGLE_PATH] });
      cy.intercept('POST', fx.endpoints.unitToggle).as('toggle');
      UnitPage.clickRowAction('toggle-status', id);
      UnitPage.elements.toggleModal().should('be.visible');
      UnitPage.elements.toggleConfirm().click();
      cy.wait('@toggle').its('response.body.success').should('eq', true);
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.unit.path);
      UnitPage.assertSuccess(fx.unit.messages.activated);
      UnitPage.rowsFor(office.officeName, year).then((rows) => {
        expect(rows[0].cells[fx.unit.col.status]).to.eq(fx.toggle.badgeActive);
      });
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-TARGET-006 | Happy | hapus target unit dengan konfirmasi Ya', () => {
    seedAndFind().then((id) => {
      cy.guardWrites({ allow: [DELETE_PATH] });
      cy.intercept('DELETE', `**/rka/unit/${id}`).as('deleteRka');
      UnitPage.clickRowAction('delete-rka', id);
      UnitPage.elements.deleteModal().should('be.visible').and('contain.text', fx.delete.question);
      UnitPage.elements.deleteConfirm().click();
      cy.wait('@deleteRka').its('response.body.success').should('eq', true);
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.unit.path);
      UnitPage.assertSuccess(fx.unit.messages.deleted);
      UnitPage.rowsFor(office.officeName, year).should('have.length', 0);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-TARGET-007 | Positif | batal hapus menutup popup dan data tetap ada', () => {
    seedAndFind().then((id) => {
      cy.guardWrites();
      UnitPage.clickRowAction('delete-rka', id);
      UnitPage.elements.deleteModal().should('be.visible');
      UnitPage.elements.deleteCancel().click();
      UnitPage.elements.deleteModal().should('not.be.visible');
      UnitPage.rowsFor(office.officeName, year).should('have.length', 1);
    });
    cy.assertNoWritesLeaked();
  });
});
