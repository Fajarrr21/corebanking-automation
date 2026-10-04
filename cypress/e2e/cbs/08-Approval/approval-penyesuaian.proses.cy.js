/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';

// Approval Penyesuaian Pinjaman — PROSES (bagian yang AMAN / tidak mengubah data):
//   tombol aksi sesuai status, modal approve/reject bisa dibatalkan, validasi
//   client-side, dan validasi server "PIN salah".
//
// Uji "PIN salah" memang mengirim POST sungguhan, tapi DIJAMIN tidak mengubah data:
//   - id pengajuan = 0 (id serial Postgres tidak pernah 0) DAN
//   - PIN bukan angka ("QA-PIN-SALAH") → Hash::check pasti gagal lebih dulu
//     (ApprovalController@approvedLoanAdjustment / rejectedLoanAdjustment, di dalam DB transaction + rollback).
// Hanya endpoint itu yang di-allow oleh write-guard; request tulis lain tetap diblokir.
//
// Approve/Reject sungguhan ada di approval-penyesuaian.irreversible.cy.js (flag allowApproval).
// TC: docs/test-cases/src/TC_ApprovalPenyesuaian_Proses.json

const KEY = 'adjustment';

describe('Approval Penyesuaian Pinjaman - Proses (aman)', () => {
  let fx;
  let tab;
  let col;
  let flt;
  let mdl;

  const requirePending = () => {
    ApprovalPage.applyFilter(fx, KEY, flt.status, 'PENDING', 'status');
    ApprovalPage.readRows(tab.table).then((rows) => {
      if (!rows.length) {
        throw new Error('PRASYARAT DATA: tidak ada pengajuan penyesuaian berstatus Menunggu Persetujuan di staging');
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
    // Pengaman tambahan: kalau ada confirm() native, selalu batalkan.
    cy.on('window:confirm', () => false);
  });

  describe('Tombol aksi sesuai status', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-APVADJ-PROSES-001 | Positif | baris Menunggu Persetujuan menampilkan tombol Lihat, Disetujui, dan Ditolak', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.assertActionsForStatus(fx, tab.table, col, fx.status.PENDING, true);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-PROSES-002 | Positif | baris Disetujui/Ditolak hanya menampilkan tombol Lihat', () => {
      ApprovalPage.openTab(fx, KEY);
      // Dua kemungkinan eksplisit per status: ada baris → hanya Lihat; tidak ada → empty-state.
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

    it('TC-APVADJ-PROSES-003 | Positif | klik Disetujui membuka modal PIN berisi id pengajuan; Batal menutup tanpa request', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.rowApprovalId(tab.table, 0, fx.buttons.approve).then((id) => {
        expect(id, 'id pengajuan pada tombol').to.match(/^\d+$/);
        ApprovalPage.clickRowButton(tab.table, 0, fx.buttons.approve).assertModalOpen(mdl.approve);
        cy.get(mdl.approve.hiddenId).should('have.value', id);
      });
      cy.get(`${mdl.approve.id} label`).should('contain.text', fx.labels.pin);
      ApprovalPage.elements.modalPin(mdl.approve.id).should('have.value', '');
      ApprovalPage.cancelModal(mdl.approve);
      cy.location('pathname').should('eq', fx.path);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-PROSES-004 | Positif | klik Ditolak membuka modal PIN + Alasan Penolakan; Batal menutup tanpa request', () => {
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

    it('TC-APVADJ-PROSES-005 | Negatif | Proses pada modal Disetujui tanpa PIN tertahan validasi wajib isi', () => {
      ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
      requirePending();
      ApprovalPage.clickRowButton(tab.table, 0, fx.buttons.approve).assertModalOpen(mdl.approve);
      ApprovalPage.submitModal(mdl.approve);
      ApprovalPage.elements.modalPin(mdl.approve.id).then(($i) => {
        expect($i[0].validity.valueMissing, 'PIN wajib diisi').to.eq(true);
      });
      ApprovalPage.elements.modal(mdl.approve.id).should('be.visible');
      ApprovalPage.cancelModal(mdl.approve);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-PROSES-006 | Negatif | Proses pada modal Ditolak tanpa Alasan Penolakan tertahan validasi wajib isi', () => {
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
      ApprovalPage.assertError(fx.messages.adjustmentWrongPin);
      ApprovalPage.assertActiveTab(tab);
      cy.assertNoWritesLeaked();
    };

    it('TC-APVADJ-PROSES-007 | Negatif | approve dengan PIN salah ditolak dengan pesan error', () => {
      wrongPinCase(mdl.approve);
    });

    it('TC-APVADJ-PROSES-008 | Negatif | reject dengan PIN salah ditolak dengan pesan error', () => {
      wrongPinCase(mdl.reject, fx.testData.rejectNote);
    });
  });
});
