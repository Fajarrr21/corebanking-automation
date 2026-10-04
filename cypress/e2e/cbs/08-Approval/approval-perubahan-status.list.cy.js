/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';

// Approval Perubahan Status Pinjaman — LIST (tab ?menu=loan_status_change_approval).
// READ-ONLY: semua request tulis diblokir (cy.guardWrites).
// PRD: Notion "Approval Perubahan Status Pinjaman". Transisi yang diizinkan dikunci di
// tests/Unit/LoanStatusChangeTransitionTest.php (hanya ACTIVE -> PAID).
// TC: docs/test-cases/src/TC_ApprovalStatus_List.json

const KEY = 'statusChange';

describe('Approval Perubahan Status Pinjaman - List', () => {
  let fx;
  let tab;
  let col;
  let flt;

  const requireRows = (rows, what) => {
    if (!rows.length) {
      throw new Error(`PRASYARAT DATA: ${what} tidak ada di staging — ajukan perubahan status dari detail pinjaman dulu`);
    }
  };

  before(() => {
    cy.fixture('approval/approval').then((d) => {
      fx = d;
      tab = fx.tabs[KEY];
      col = fx.columns[KEY];
      flt = fx.filters[KEY];
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  describe('Tampilan list', () => {
    it('TC-APVSTS-LIST-001 | Happy | tab Perubahan Status Pinjaman tampil dengan tabel dan filter default', () => {
      ApprovalPage.openTab(fx, KEY).assertActiveTab(tab);
      cy.get(tab.table).should('be.visible');
      cy.get(`${flt.office} option:selected`).should('have.text', fx.filters.allOfficeLabel);
      cy.get(flt.status).should('have.value', 'ALL');
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-002 | Positif | tabel memuat kolom sesuai PRD', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.tableHeaders(tab.table).should(($th) => {
        const actual = Cypress.$.makeArray($th).map((th) => th.innerText.replace(/\s+/g, ' ').trim());
        expect(actual).to.include.members(fx.headers.statusChangePrd);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-003 | Edge | kolom Perubahan hanya berisi transisi yang diizinkan (ACTIVE → PAID)', () => {
      ApprovalPage.openTab(fx, KEY);
      // Dua kemungkinan eksplisit: ada data → semua transisi diizinkan; kosong → empty-state.
      ApprovalPage.readRows(tab.table).then((rows) => {
        if (rows.length) {
          ApprovalPage.assertEveryRowColumn(col.perubahan, (t) => fx.transitions.allowed.includes(t), 'Perubahan', tab.table);
        } else {
          ApprovalPage.emptyState(tab.table).should('be.visible');
        }
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-004 | Positif | setiap pengajuan menampilkan alasan perubahan dan nama pengaju', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => requireRows(rows, 'pengajuan perubahan status'));
      ApprovalPage.assertEveryRowColumn(col.alasan, (t) => t.length > 0, 'Alasan', tab.table);
      ApprovalPage.assertEveryRowColumn(col.pengaju, (t) => t.length > 0 && t !== '-', 'Pengaju', tab.table);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Filter', () => {
    it('TC-APVSTS-LIST-005 | Positif | opsi filter status: Semua Status, Menunggu, Disetujui, Ditolak', () => {
      ApprovalPage.openTab(fx, KEY);
      cy.get(`${flt.status} option`).should(($o) => {
        const labels = Cypress.$.makeArray($o).map((o) => o.textContent.trim());
        expect(labels).to.deep.eq(fx.filters.statusOptions);
      });
      cy.assertNoWritesLeaked();
    });

    const checkStatusFilter = (code) => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.applyFilter(fx, KEY, flt.status, code, 'status');
      ApprovalPage.readRows(tab.table).then((rows) => {
        if (rows.length) {
          ApprovalPage.assertEveryRowColumn(col.status, (t) => t.startsWith(fx.status[code]), 'Status', tab.table);
        } else {
          ApprovalPage.emptyState(tab.table).should('be.visible');
        }
      });
      cy.assertNoWritesLeaked();
    };

    it('TC-APVSTS-LIST-006 | Positif | filter status Menunggu hanya menampilkan baris Menunggu Persetujuan (atau empty-state)', () => {
      checkStatusFilter('PENDING');
    });

    it('TC-APVSTS-LIST-007 | Positif | filter status Disetujui hanya menampilkan baris Disetujui (atau empty-state)', () => {
      checkStatusFilter('APPROVED');
    });

    it('TC-APVSTS-LIST-008 | Positif | filter status Ditolak hanya menampilkan baris Ditolak (atau empty-state)', () => {
      checkStatusFilter('REJECTED');
    });

    it('TC-APVSTS-LIST-009 | Positif | filter cabang hanya menampilkan pengajuan dari cabang terpilih', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => {
        requireRows(rows, 'pengajuan perubahan status');
        const kantor = rows[0][col.kantor];
        cy.get(`${flt.office} option`).then(($o) => {
          const opt = Cypress.$.makeArray($o).find((o) => o.textContent.trim() === kantor);
          expect(opt, `opsi filter cabang "${kantor}"`).to.exist;
          ApprovalPage.applyFilter(fx, KEY, flt.office, opt.value, 'office_id');
        });
        ApprovalPage.readRows(tab.table).its('length').should('be.greaterThan', 0);
        ApprovalPage.assertEveryRowColumn(col.kantor, (t) => t === kantor, 'Nama Kantor Asal', tab.table);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-010 | Positif | tersedia filter rentang tanggal pengajuan', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.elements
        .toolbar(tab.pane)
        .find('input[type="date"], input.date-picker, .date-picker input, .input-daterange input, input[name*="date"], input[name*="tanggal"]')
        .should('have.length.greaterThan', 0);
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-011 | Positif | tersedia penanda jumlah pengajuan yang belum diputuskan', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.elements.tabLink(tab.menu).find('.badge').should('exist').invoke('text').should('match', /^\s*\d+\s*$/);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Pencarian', () => {
    it('TC-APVSTS-LIST-012 | Positif | cari berdasarkan No Rekening menampilkan data yang sesuai', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => {
        requireRows(rows, 'pengajuan perubahan status');
        const rek = rows[0][col.rekening];
        ApprovalPage.search(fx, KEY, rek);
        ApprovalPage.readRows(tab.table).its('length').should('be.greaterThan', 0);
        ApprovalPage.assertEveryRowColumn(col.rekening, (t) => t.includes(rek), 'No Rekening', tab.table);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-013 | Negatif | cari kata kunci yang tidak ada menampilkan list kosong', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.search(fx, KEY, fx.testData.searchNotFound);
      ApprovalPage.emptyState(tab.table).should('be.visible');
      ApprovalPage.readRows(tab.table).should('have.length', 0);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Aksi baca (detail, alasan tolak)', () => {
    it('TC-APVSTS-LIST-014 | Positif | tombol Lihat mengarah ke halaman detail pinjaman yang dapat dibuka', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => requireRows(rows, 'pengajuan perubahan status'));
      ApprovalPage.dataRow(tab.table, 0)
        .find('a')
        .contains(fx.buttons.view)
        .closest('a')
        .invoke('attr', 'href')
        .then((href) => {
          expect(new URL(href, Cypress.config('baseUrl')).pathname).to.match(/^\/loan\/[^/]+$/);
          cy.request({ url: href, followRedirect: false }).its('status').should('eq', 200);
        });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVSTS-LIST-015 | Edge | badge Ditolak menampilkan alasan penolakan dan dapat ditutup', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.applyFilter(fx, KEY, flt.status, 'REJECTED', 'status');
      cy.get(`${tab.table} tbody`).then(($tb) => {
        if (!$tb.find('a.reject-reason').length) {
          throw new Error('PRASYARAT DATA: tidak ada pengajuan perubahan status berstatus Ditolak di staging');
        }
      });
      cy.get(`${tab.table} tbody a.reject-reason`).first().then(($a) => {
        const notes = String($a.attr('data-notes'));
        cy.wrap($a).click();
        ApprovalPage.elements.modal(fx.modals.rejectReason.id).should('be.visible');
        cy.get(fx.modals.rejectReason.text).should('have.text', notes);
      });
      cy.get(`${fx.modals.rejectReason.id} .modal-footer button`).contains(fx.buttons.close).click();
      ApprovalPage.elements.modal(fx.modals.rejectReason.id).should('not.be.visible');
      cy.assertNoWritesLeaked();
    });
  });
});
