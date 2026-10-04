/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';
import { describeIfFlag } from '../../../support/utils/flags';

// ⚠️ IRREVERSIBLE — Setujui/Tolak perubahan status pinjaman SUNGGUHAN.
//   Setujui: loans.status ACTIVE → PAID (tidak ada jalur balik — PAID → ACTIVE sengaja
//   ditutup, lihat tests/Unit/LoanStatusChangeTransitionTest.php). Tolak: keputusan final.
//
// Hanya jalan dengan:  --env allowApproval=true --env approvalPin=<PIN akun test>
// Hanya memproses pengajuan MILIK TEST: kolom "Nama Nasabah" diawali "QA" (column-scoped,
// dicek ulang tepat sebelum klik). Kalau tidak ada → test GAGAL dengan pesan jelas.
// TC-APVSTS-IRR-001 & 002 adalah negatif (server menolak, data tidak berubah) tapi butuh PIN asli,
// jadi tetap ditaruh di sini.
// TC: docs/test-cases/src/TC_ApprovalStatus_Irreversible.json

const KEY = 'statusChange';

describeIfFlag('allowApproval', 'Approval Perubahan Status Pinjaman - Proses (irreversible)', () => {
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

  /**
   * Buka tab, filter Menunggu + cari "QA", pilih pengajuan milik test yang
   * memenuhi rowPred(cells, namaUserLogin). Yield { rek, me }.
   */
  const pickQaPending = (rowPred, why) => {
    ApprovalPage.openTab(fx, KEY).assertSuperAdmin(fx);
    return ApprovalPage.currentUserName().then((me) => {
      expect(me, 'nama user login').to.not.eq('');
      ApprovalPage.applyFilter(fx, KEY, flt.status, 'PENDING', 'status');
      ApprovalPage.search(fx, KEY, fx.testData.qaPrefix);
      return ApprovalPage.readRows(tab.table).then((rows) => {
        const target = rows.find((r) => isQa(r[col.nama]) && r[col.status].startsWith(fx.status.PENDING) && rowPred(r, me));
        if (!target) {
          throw new Error(
            `PRASYARAT DATA: tidak ada pengajuan perubahan status Menunggu Persetujuan milik test (Nama Nasabah diawali "QA") ${why}. `
            + 'Test sengaja GAGAL agar tidak memproses pinjaman nasabah asli.',
          );
        }
        return cy.then(() => ({ rek: target[col.rekening], me }));
      });
    });
  };

  /** Klik tombol pada baris (rek, QA), isi modal, kirim, tunggu redirect ke tab ini. */
  const submitOnRow = (rek, label, modal, notes) => {
    const pin = ApprovalPage.requirePin();
    cy.intercept('POST', modal.action).as('submitApproval');
    ApprovalPage.findRowIndex(tab.table, (c) => c[col.rekening] === rek && isQa(c[col.nama])).then((idx) => {
      expect(idx, 'baris target').to.be.greaterThan(-1);
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
  };

  /** Setelah redirect: muat ulang tabel lalu tampilkan baris rek dengan status `code`. */
  const showRows = (rek, code) => {
    cy.wait(`@data_${KEY}`, { timeout: fx.timeout.table });
    ApprovalPage.waitTable(tab.table, fx.timeout.table);
    ApprovalPage.applyFilter(fx, KEY, flt.status, code, 'status');
    ApprovalPage.search(fx, KEY, rek);
  };

  describe('Validasi server dengan PIN benar (data tidak berubah)', () => {
    it('TC-APVSTS-IRR-001 | Negatif | approver tidak dapat menyetujui pengajuan yang dibuatnya sendiri', () => {
      pickQaPending((r, me) => r[col.pengaju] === me, 'yang diajukan oleh akun test sendiri').then(({ rek }) => {
        submitOnRow(rek, fx.buttons.approve, mdl.approve, fx.testData.approveNote);
        ApprovalPage.assertError(fx.messages.statusOwnRequest);
        showRows(rek, 'PENDING');
        ApprovalPage.readRows(tab.table).should((rows) => {
          expect(rows.some((r) => r[col.rekening] === rek), `pengajuan ${rek} tetap Menunggu Persetujuan`).to.eq(true);
        });
      });
    });

    it('TC-APVSTS-IRR-002 | Negatif | Tolak dengan alasan berisi spasi saja ditolak server dan status tetap Menunggu', () => {
      pickQaPending(() => true, '').then(({ rek }) => {
        submitOnRow(rek, fx.buttons.reject, mdl.reject, fx.testData.blankNote);
        ApprovalPage.assertError(fx.messages.statusRejectReasonRequired);
        showRows(rek, 'PENDING');
        ApprovalPage.readRows(tab.table).should((rows) => {
          expect(rows.some((r) => r[col.rekening] === rek), `pengajuan ${rek} tetap Menunggu Persetujuan`).to.eq(true);
        });
      });
    });
  });

  describe('Keputusan sungguhan pada pengajuan milik test', () => {
    it('TC-APVSTS-IRR-003 | Happy | Setujui pengajuan milik test (diajukan user lain) mengubah status menjadi Disetujui', () => {
      const note = `${fx.testData.approveNote} ${Date.now()}`;
      pickQaPending((r, me) => r[col.pengaju] !== me, 'yang diajukan oleh user LAIN (aturan: tidak boleh menyetujui pengajuan sendiri)')
        .then(({ rek }) => {
          submitOnRow(rek, fx.buttons.approve, mdl.approve, note);
          ApprovalPage.assertSuccess(fx.messages.statusApproved);
          showRows(rek, 'APPROVED');
          ApprovalPage.readRows(tab.table).should((rows) => {
            expect(rows.some((r) => r[col.rekening] === rek && r[col.status].startsWith(fx.status.APPROVED)),
              `baris Disetujui untuk rekening ${rek}`).to.eq(true);
          });
          ApprovalPage.assertActionsForStatus(fx, tab.table, col, fx.status.APPROVED, false);
        });
    });

    it('TC-APVSTS-IRR-004 | Happy | Tolak pengajuan milik test dengan alasan mengubah status menjadi Ditolak beserta alasannya', () => {
      const note = `${fx.testData.rejectNote} ${Date.now()}`;
      pickQaPending(() => true, '').then(({ rek }) => {
        submitOnRow(rek, fx.buttons.reject, mdl.reject, note);
        ApprovalPage.assertSuccess(fx.messages.statusRejected);
        showRows(rek, 'REJECTED');
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
});
