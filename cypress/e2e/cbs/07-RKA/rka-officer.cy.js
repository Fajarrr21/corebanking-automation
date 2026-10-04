/// <reference types="cypress" />
import AoPage from '../../../support/pageobjects/RKA/RkaAccountOfficerPage';

// RKA > Account Officer — tab "Account Officer" (CRUD officer + penugasan cabang).
// TC  : docs/test-cases/src/TC_RKAOfficer_CRUD.json
// PRD : TIDAK ADA PRD khusus CRUD officer (PRD "BKDP RKA - Unit" hanya menyebut
//       "Menambahkan AO pada setiap Unit"). Semua TC bersumber Asumsi dari source
//       (tabs/officer-management.blade.php + RkaAccountOfficerController).
//
// DATA UJI: officer bernama "QA<ts>..." + email qa+...@example.invalid. Setiap
// officer yang dibuat dicatat id-nya; afterEach menghapus (penugasan → officer).
// Penghapusan officer = soft delete (model AccountOfficer memakai SoftDeletes).

describe('RKA Account Officer - Kelola Account Officer', () => {
  let fx;
  let created = [];
  const OFFICER_STORE = /^\/rka\/accountofficer\/officers$/;
  const OFFICER_ID = /^\/rka\/accountofficer\/officers\/\d+$/;
  const ASSIGN = /^\/rka\/accountofficer\/officers\/assign$/;

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    created = [];
    cy.then(() => {
      cy.intercept('GET', fx.endpoints.officersTable).as('officersTable');
    });
  });

  afterEach(() => {
    created.forEach((o) => AoPage.cleanup(o.name, o.id));
  });

  const newOfficer = () => {
    const o = {};
    cy.qaName('AO').then((n) => (o.name = n));
    cy.qaEmail().then((e) => (o.email = e));
    return cy.then(() => o);
  };

  const seedOfficer = () => newOfficer().then((o) => AoPage.seedOfficer(o.name, o.email).then((id) => {
    o.id = id;
    created.push(o);
    return o;
  }));

  const openOfficerTab = () => {
    AoPage.visit(fx.ao.pills.officer.menu);
    AoPage.elements.pane('office_approval').should('have.class', 'active');
    cy.wait('@officersTable');
    AoPage.waitTable('#tableOfficers');
  };

  it('TC-RKAOFC-CRUD-001 | Happy | tambah Account Officer baru', () => {
    cy.guardWrites({ allow: [OFFICER_STORE] });
    cy.intercept('POST', `**${fx.endpoints.officers}`).as('storeOfficer');
    openOfficerTab();
    AoPage.assertHeaders(fx.officer.tableHeaders, '#tableOfficers');
    newOfficer().then((o) => {
      AoPage.elements.addOfficerBtn().click();
      AoPage.elements.officerModal().should('be.visible');
      AoPage.elements.officerModalTitle().should('have.text', fx.officer.addTitle);
      AoPage.elements.officerName().type(o.name);
      AoPage.elements.officerEmail().type(o.email);
      AoPage.elements.officerSave().click();
      cy.wait('@storeOfficer').then(({ response }) => {
        expect(response.statusCode).to.eq(200);
        created.push({ ...o, id: response.body.data.id });
      });
      AoPage.elements.swalTitle().should('have.text', fx.officer.swal.successTitle);
      AoPage.elements.swalText().should('contain.text', fx.officer.messages.created);
      AoPage.elements.swalConfirm().click();
      cy.wait('@officersTable');
      AoPage.sortOfficersNewestFirst();
      cy.then(() => AoPage.elements.officerBtn('btn-edit-officer', created[0].id)
        .closest('tr').find('td').eq(2).should('have.text', o.name));
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-002 | Negatif | nama Account Officer kosong tidak dapat disimpan', () => {
    cy.guardWrites();
    openOfficerTab();
    AoPage.elements.addOfficerBtn().click();
    AoPage.elements.officerModal().should('be.visible');
    cy.qaEmail().then((e) => AoPage.elements.officerEmail().type(e));
    AoPage.elements.officerSave().click();
    AoPage.elements.officerName().should(($i) => {
      expect($i[0].checkValidity()).to.eq(false);
      expect($i[0].validationMessage).to.not.be.empty;
    });
    AoPage.elements.officerModal().should('be.visible');
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-003 | Negatif | email yang sudah dipakai officer lain ditolak', () => {
    seedOfficer().then((existing) => {
      cy.guardWrites({ allow: [OFFICER_STORE] });
      cy.intercept('POST', `**${fx.endpoints.officers}`).as('storeOfficer');
      openOfficerTab();
      AoPage.elements.addOfficerBtn().click();
      cy.qaName('AO DUP').then((n) => AoPage.elements.officerName().type(n));
      AoPage.elements.officerEmail().type(existing.email);
      AoPage.elements.officerSave().click();
      cy.wait('@storeOfficer').its('response.statusCode').should('eq', 422);
      AoPage.elements.swalTitle().should('have.text', fx.officer.swal.errorTitle);
      AoPage.elements.swalText().should('contain.text', fx.officer.messages.emailTaken);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-004 | Happy | edit nomor telepon Account Officer', () => {
    seedOfficer().then((o) => {
      cy.guardWrites({ allow: [OFFICER_ID] });
      cy.intercept('POST', `**${fx.endpoints.officers}/${o.id}`).as('updateOfficer');
      openOfficerTab();
      AoPage.sortOfficersNewestFirst();
      AoPage.elements.officerBtn('btn-edit-officer', o.id).click();
      AoPage.elements.officerModal().should('be.visible');
      AoPage.elements.officerModalTitle().should('have.text', fx.officer.editTitle);
      AoPage.elements.officerName().should('have.value', o.name);
      AoPage.elements.officerEmail().should('have.value', o.email);
      AoPage.elements.officerPhone().clear().type(fx.officer.phoneEdit);
      AoPage.elements.officerSave().click();
      cy.wait('@updateOfficer').its('response.statusCode').should('eq', 200);
      AoPage.elements.swalTitle().should('have.text', fx.officer.swal.successTitle);
      AoPage.elements.swalText().should('contain.text', fx.officer.messages.updated);
      cy.request(`${fx.endpoints.officers}/${o.id}`).its('body.data.phone').should('eq', fx.officer.phoneEdit);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-005 | Happy | hapus Account Officer dengan konfirmasi', () => {
    seedOfficer().then((o) => {
      cy.guardWrites({ allow: [OFFICER_ID] });
      cy.intercept('DELETE', `**${fx.endpoints.officers}/${o.id}`).as('deleteOfficer');
      openOfficerTab();
      AoPage.sortOfficersNewestFirst();
      AoPage.elements.officerBtn('btn-delete-officer', o.id).click();
      AoPage.elements.swalText().should('contain.text', o.name);
      AoPage.elements.swalConfirm().should('have.text', fx.officer.swal.confirmDelete).click();
      cy.wait('@deleteOfficer').its('response.body.success').should('eq', true);
      AoPage.elements.swalTitle().should('have.text', fx.officer.swal.deletedTitle);
      AoPage.elements.swalText().should('contain.text', fx.officer.messages.deleted);
      cy.wait('@officersTable');
      AoPage.elements.officersTable().find(`.btn-edit-officer[data-id="${o.id}"]`).should('not.exist');
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-006 | Negatif | officer yang masih punya RKA tidak dapat dihapus', () => {
    const year = new Date().getFullYear();
    seedOfficer().then((o) => {
      AoPage.seedTarget(o.id, year, fx.target.increase);
      cy.guardWrites({ allow: [OFFICER_ID] });
      cy.intercept('DELETE', `**${fx.endpoints.officers}/${o.id}`).as('deleteOfficer');
      openOfficerTab();
      AoPage.sortOfficersNewestFirst();
      AoPage.elements.officerBtn('btn-delete-officer', o.id).click();
      AoPage.elements.swalConfirm().click();
      cy.wait('@deleteOfficer').its('response.statusCode').should('eq', 422);
      AoPage.elements.swalTitle().should('have.text', fx.officer.swal.errorTitle);
      AoPage.elements.swalText().should('contain.text', fx.officer.messages.hasRka);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-007 | Edge | berpindah tab bolak-balik lalu tambah officer hanya mengirim 1 request', () => {
    let posts = 0;
    cy.guardWrites({ allow: [OFFICER_STORE] });
    cy.intercept('POST', `**${fx.endpoints.officers}`, (req) => {
      posts += 1;
      req.continue((res) => {
        if (res.statusCode === 200 && res.body && res.body.data) created.push({ name: res.body.data.name, id: res.body.data.id });
      });
    }).as('storeOfficer');
    openOfficerTab();
    AoPage.elements.pill(fx.ao.pills.rka.href).click();
    AoPage.elements.pane('customer_approval').should('have.class', 'active');
    AoPage.elements.pill(fx.ao.pills.officer.href).click();
    AoPage.elements.pane('office_approval').should('have.class', 'active');
    cy.wait('@officersTable');
    newOfficer().then((o) => {
      AoPage.elements.addOfficerBtn().click();
      AoPage.elements.officerName().type(o.name);
      AoPage.elements.officerEmail().type(o.email);
      AoPage.elements.officerSave().click();
      cy.wait('@storeOfficer');
      AoPage.elements.swal().should('be.visible');
      cy.then(() => expect(posts, 'jumlah POST tambah officer').to.eq(1));
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAOFC-CRUD-008 | Positif | cabang yang ditugaskan tampil di "Penugasan Cabang Saat Ini"', () => {
    seedOfficer().then((o) => {
      cy.guardWrites({ allow: [ASSIGN] });
      cy.intercept('GET', fx.endpoints.officersOffices).as('officesList');
      cy.intercept('POST', `**${fx.endpoints.officersAssign}`).as('assign');
      openOfficerTab();
      AoPage.sortOfficersNewestFirst();
      AoPage.elements.officerBtn('btn-assign-offices', o.id).click();
      AoPage.elements.assignModal().should('be.visible');
      cy.wait('@officesList');
      AoPage.elements.assignSelect().find('option').first().then(($opt) => {
        const officeName = $opt.text().trim();
        AoPage.elements.assignSelect().select([$opt.val()], { force: true });
        AoPage.elements.assignSave().click();
        cy.wait('@assign').its('response.body.success').should('eq', true);
        AoPage.elements.swalTitle().should('have.text', fx.officer.swal.assignTitle);
        AoPage.elements.swalText().should('contain.text', fx.officer.messages.assigned);
        AoPage.elements.swalConfirm().click();
        cy.wait('@officersTable');
        AoPage.elements.officerBtn('btn-assign-offices', o.id).click();
        AoPage.elements.assignModal().should('be.visible');
        AoPage.elements.currentAssignBody().should('contain.text', officeName)
          .and('not.contain.text', fx.officer.noAssignment);
      });
    });
    cy.assertNoWritesLeaked();
  });
});
