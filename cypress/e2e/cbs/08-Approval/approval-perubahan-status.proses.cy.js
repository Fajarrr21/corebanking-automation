/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';

// Approval Perubahan Status Pinjaman — PROSES (bagian AMAN / tidak mengubah data):
//   tombol aksi sesuai status, modal Setujui/Tolak bisa dibatalkan, validasi
//   client-side, dan validasi server "PIN salah".
//
// Uji "PIN salah" mengirim POST sungguhan tapi DIJAMIN tidak mengubah data:
//   id pengajuan = 0 (tidak pernah ada) + PIN non-angka → Hash::check gagal sebelum
//   pengajuan dicari (ApprovalController@approvedLoanStatusChange / rejectedLoanStatusChange,
//   di dalam DB transaction + rollback). Hanya endpoint itu yang di-allow write-guard.
//
// Approve/Reject sungguhan: approval-perubahan-status.irreversible.cy.js (flag allowApproval).
// TC: docs/test-cases/src/TC_ApprovalStatus_Proses.json

const KEY = 'statusChange';

describe('Approval Perubahan Status Pinjaman - Proses (aman)', () => {
  let fx;
  let tab;
  let col;
  let flt;
  let mdl;

  const requirePending = () => {
    ApprovalPage.applyFilter(fx, KEY, flt.status, 'PENDING', 'status');
    ApprovalPage.readRows(tab.table).then((rows) => {
      if (!rows.length) {
        throw new Error('PRASYARAT DATA: tidak ada pengajuan perubahan status berstatus Menunggu Persetujuan di staging');
      }
    });
  };

  before(() => {
    cy.fixture('approval/approval').then((d) => {
      fx = d;
      tab = fx.tabs[KEY];
      col = fx.columns[KEY];
      flt = fx.filters[KEY];
      mdl = fx.modals[KEY];
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.on('window:confirm', () => false);
  });

  describe('Tombol aksi sesuai status', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-APVSTS-PROSES-001 | Positif | baris Menunggu Persetujuan menampilkan tombol Lihat, Disetujui, dan Ditolak untuk approver', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.assertActionsForStatus(fx, tab.table, col, fx.status.PENDING, true);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-PROSES-002 | Positif | baris yang sudah diputuskan (Disetujui/Ditolak) hanya menampilkan tombol Lihat', () => {
      ApprovalPage.openTab(fx, KEY);
      ['APPROVED', 'REJECTED'].forEach((code) => {
        ApprovalPage.applyFilter(fx, KEY, flt.status, code, 'status');
        ApprovalPage.readRows(tab.table).then((rows) => {
          if (rows.length) {
            ApprovalPage.assertActionsForStatus(fx, tab.table, col, fx.status[code], false);
          } else {
            ApprovalPage.emptyState(tab.table).should('be.visible');
          }
        });
      });
      cy.assertNoWritesLeaked();
    });
  });

  describe('Modal konfirmasi dapat dibatalkan', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-APVSTS-PROSES-003 | Positif | klik Disetujui membuka modal PIN + Alasan Persetujuan; Batal menutup tanpa request', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.rowApprovalId(tab.table, 0, fx.buttons.approve).then((id) => {
        expect(id, 'id pengajuan pada tombol').to.match(/^\d+$/);
        ApprovalPage.clickRowButton(tab.table, 0, fx.buttons.approve).assertModalOpen(mdl.approve);
        cy.get(mdl.approve.hiddenId).should('have.value', id);
      });
      cy.get(`${mdl.approve.id} label`).should('contain.text', fx.labels.pin).and('contain.text', fx.labels.approveReason);
      ApprovalPage.elements.modalPin(mdl.approve.id).should('have.attr', 'type', 'password');
      ApprovalPage.cancelModal(mdl.approve);
      cy.location('pathname').should('eq', fx.path);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-PROSES-004 | Positif | klik Ditolak membuka modal PIN + Alasan Penolakan; Batal menutup tanpa request', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.rowApprovalId(tab.table, 0, fx.buttons.reject).then((id) => {
        ApprovalPage.clickRowButton(tab.table, 0, fx.buttons.reject).assertModalOpen(mdl.reject);
        cy.get(mdl.reject.hiddenId).should('have.value', id);
      });
      cy.get(`${mdl.reject.id} label`).should('contain.text', fx.labels.pin).and('contain.text', fx.labels.rejectReason);
      ApprovalPage.cancelModal(mdl.reject);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-PROSES-005 | Negatif | Tolak tanpa Alasan Penolakan tertahan validasi wajib isi', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.clickRowButton(tab.table, 0, fx.buttons.reject).assertModalOpen(mdl.reject);
      ApprovalPage.fillModal(mdl.reject, { pin: fx.testData.wrongPin });
      ApprovalPage.submitModal(mdl.reject);
      ApprovalPage.elements.modalNotes(mdl.reject.id).then(($i) => {
        expect($i[0].validity.valueMissing, 'Alasan Penolakan wajib diisi').to.eq(true);
      });
      ApprovalPage.elements.modal(mdl.reject.id).should('be.visible');
      ApprovalPage.cancelModal(mdl.reject);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-PROSES-006 | Negatif | Setujui tanpa PIN tertahan validasi wajib isi', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.clickRowButton(tab.table, 0, fx.buttons.approve).assertModalOpen(mdl.approve);
      ApprovalPage.fillModal(mdl.approve, { notes: fx.testData.approveNote });
      ApprovalPage.submitModal(mdl.approve);
      ApprovalPage.elements.modalPin(mdl.approve.id).then(($i) => {
        expect($i[0].validity.valueMissing, 'PIN wajib diisi').to.eq(true);
      });
      ApprovalPage.elements.modal(mdl.approve.id).should('be.visible');
      ApprovalPage.cancelModal(mdl.approve);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Validasi server: PIN salah (id pengajuan fiktif)', () => {
    const wrongPinCase = (modal, notes) => {
      cy.guardWrites({ allow: [new RegExp(`^${modal.action}$`)] });
      cy.intercept('POST', modal.action).as('submitApproval');
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      ApprovalPage.openModalWithId(modal, fx.testData.bogusApprovalId);
      ApprovalPage.fillModal(modal, { pin: fx.testData.wrongPin, notes });
      ApprovalPage.submitModal(modal);
      cy.wait('@submitApproval').its('request.body').should('include', `pin=${fx.testData.wrongPin}`);
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.path);
      cy.location('search').should('include', `menu=${tab.menu}`);
      ApprovalPage.assertError(fx.messages.statusWrongPin);
      ApprovalPage.assertActiveTab(tab);
      cy.assertNoWritesLeaked();
    };

    it('TC-APVSTS-PROSES-007 | Negatif | Setujui dengan PIN salah ditolak dengan pesan error', () => {
      wrongPinCase(mdl.approve, fx.testData.approveNote);
    });

    it('TC-APVSTS-PROSES-008 | Negatif | Tolak dengan PIN salah ditolak dengan pesan error', () => {
      wrongPinCase(mdl.reject, fx.testData.rejectNote);
    });
  });
});
