/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';
import { describeIfFlag } from '../../../support/utils/flags';

// ⚠️ IRREVERSIBLE — Approve/Reject penyesuaian pinjaman SUNGGUHAN.
//   Approve: menulis adjustment_principal/interest/saving ke tabel loans + rencana
//   pinjaman PENDING → OPEN. Reject: rencana pinjaman → CANCELLED. Tidak ada fitur undo.
//
// Hanya jalan dengan:  --env allowApproval=true --env approvalPin=<PIN akun test>
// Hanya memproses pengajuan MILIK TEST: kolom "Nama Nasabah" diawali "QA" (column-scoped,
// dicek ulang tepat sebelum klik). Kalau tidak ada → test GAGAL dengan pesan jelas,
// TIDAK pernah memproses data nasabah asli.
// TC: docs/test-cases/src/TC_ApprovalPenyesuaian_Irreversible.json

const KEY = 'adjustment';

describeIfFlag('allowApproval', 'Approval Penyesuaian Pinjaman - Proses (irreversible)', () => {
  let fx;
  let tab;
  let col;
  let flt;
  let mdl;

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

  const isQa = (name) => String(name || '').startsWith(fx.testData.qaPrefix);

  /** Jumlah baris PENDING untuk satu No Rekening (filter status + cari). */
  const countPending = (rek, applyStatus = true) => {
    if (applyStatus) ApprovalPage.applyFilter(fx, KEY, flt.status, 'PENDING', 'status');
    ApprovalPage.search(fx, KEY, rek);
    return ApprovalPage.readRows(tab.table).then((rows) => rows.filter((r) => r[col.rekening] === rek).length);
  };

  /**
   * Cari pengajuan PENDING milik test, proses lewat modal (PIN dari env), lalu
   * kembalikan { rek, nama, before } untuk verifikasi.
   */
  const processQaRequest = (label, modal, notes, expectedMsg) => {
    const pin = ApprovalPage.requirePin();
    cy.intercept('POST', modal.action).as('submitApproval');
    ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
    ApprovalPage.applyFilter(fx, KEY, flt.status, 'PENDING', 'status');
    ApprovalPage.search(fx, KEY, fx.testData.qaPrefix);

    return ApprovalPage.readRows(tab.table).then((rows) => {
      const target = rows.find((r) => isQa(r[col.nama]) && r[col.status].startsWith(fx.status.PENDING));
      if (!target) {
        throw new Error(
          'PRASYARAT DATA: tidak ada pengajuan penyesuaian Menunggu Persetujuan milik test (Nama Nasabah diawali "QA"). '
          + 'Test sengaja GAGAL agar tidak memproses pengajuan nasabah asli — buat pengajuan QA dulu dari detail pinjaman nasabah QA.',
        );
      }
      const rek = target[col.rekening];
      const nama = target[col.nama];

      // Filter PENDING sudah aktif → cukup cari No Rekening.
      return countPending(rek, false).then((before) => {
        expect(before, 'pengajuan PENDING untuk rekening QA').to.be.greaterThan(0);
        ApprovalPage.findRowIndex(tab.table, (c) => c[col.rekening] === rek && isQa(c[col.nama])).then((idx) => {
          expect(idx, 'baris target').to.be.greaterThan(-1);
          // Cek ulang column-scoped tepat sebelum aksi.
          ApprovalPage.dataRow(tab.table, idx).find('td').eq(col.nama).invoke('text').then((t) => {
            expect(isQa(t.trim()), `Nama Nasabah "${t.trim()}" harus diawali QA`).to.eq(true);
          });
          ApprovalPage.rowApprovalId(tab.table, idx, label).then((id) => {
            ApprovalPage.clickRowButton(tab.table, idx, label).assertModalOpen(modal);
            cy.get(modal.hiddenId).should('have.value', id);
          });
        });
        ApprovalPage.fillModal(modal, { pin, notes });
        ApprovalPage.submitModal(modal);
        cy.wait('@submitApproval');
        cy.location('search', { timeout: fx.timeout.redirect }).should('include', `menu=${tab.menu}`);
        ApprovalPage.assertSuccess(expectedMsg);
        // Halaman dimuat ulang → tunggu tabel lagi.
        cy.wait(`@data_${KEY}`, { timeout: fx.timeout.table });
        ApprovalPage.waitTable(tab.table, fx.timeout.table);
        return cy.then(() => ({ rek, nama, before }));
      });
    });
  };

  it('TC-APVADJ-IRR-001 | Happy | approve pengajuan penyesuaian milik test dengan PIN benar mengubah status menjadi Disetujui', () => {
    processQaRequest(fx.buttons.approve, mdl.approve, undefined, fx.messages.adjustmentApproved).then(({ rek, before }) => {
      countPending(rek).should('eq', before - 1);
      ApprovalPage.applyFilter(fx, KEY, flt.status, 'APPROVED', 'status');
      ApprovalPage.readRows(tab.table).should((rows) => {
        expect(rows.some((r) => r[col.rekening] === rek && r[col.status].startsWith(fx.status.APPROVED)),
          `baris Disetujui untuk rekening ${rek}`).to.eq(true);
      });
      ApprovalPage.assertActionsForStatus(fx, tab.table, col, fx.status.APPROVED, false);
    });
  });

  it('TC-APVADJ-IRR-002 | Happy | reject pengajuan penyesuaian milik test dengan PIN benar dan alasan mengubah status menjadi Ditolak', () => {
    const note = `${fx.testData.rejectNote} ${Date.now()}`;
    processQaRequest(fx.buttons.reject, mdl.reject, note, fx.messages.adjustmentRejected).then(({ rek, before }) => {
      countPending(rek).should('eq', before - 1);
      ApprovalPage.applyFilter(fx, KEY, flt.status, 'REJECTED', 'status');
      cy.get(`${tab.table} tbody tr`).should(($rows) => {
        const hit = Cypress.$.makeArray($rows).some((r) => {
          const $td = Cypress.$(r).find('td');
          return $td.eq(col.rekening).text().trim() === rek
            && $td.eq(col.status).find('a.reject-reason').attr('data-notes') === note;
        });
        expect(hit, `baris Ditolak rekening ${rek} dengan alasan "${note}"`).to.eq(true);
      });
    });
  });
});
