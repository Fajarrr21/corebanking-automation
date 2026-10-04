/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';

// Approval Penyesuaian Pinjaman — LIST (tab ?menu=loan_adjustment_approval).
// READ-ONLY: semua request tulis diblokir (cy.guardWrites).
// PRD: Notion "Approval Penyesuaian Pinjaman". TC: docs/test-cases/src/TC_ApprovalPenyesuaian_List.json

const KEY = 'adjustment';

describe('Approval Penyesuaian Pinjaman - List', () => {
  let fx;
  let tab;
  let col;
  let flt;

  /** Gagal dengan pesan jelas bila staging belum punya data yang dibutuhkan. */
  const requireRows = (rows, what) => {
    if (!rows.length) {
      throw new Error(`PRASYARAT DATA: ${what} tidak ada di staging — buat pengajuan penyesuaian (modul Pinjaman) dulu`);
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
    it('TC-APVADJ-LIST-001 | Happy | tab Penyesuaian Pinjaman tampil dengan tabel dan filter default', () => {
      ApprovalPage.openTab(fx, KEY).assertActiveTab(tab);
      cy.get(tab.table).should('be.visible');
      cy.get(`${flt.office} option:selected`).should('have.text', fx.filters.allOfficeLabel);
      cy.get(`${flt.product} option:selected`).should('have.text', fx.filters.allProductLabel);
      cy.get(flt.status).should('have.value', 'ALL');
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-002 | Positif | tabel memuat seluruh kolom yang disyaratkan PRD', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.tableHeaders(tab.table).should(($th) => {
        const actual = Cypress.$.makeArray($th).map((th) => th.innerText.replace(/\s+/g, ' ').trim());
        expect(actual).to.include.members(fx.headers.adjustmentPrd);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-003 | Edge | format kolom nominal (IDR) dan Jangka Waktu (Bulan/Minggu/Hari) konsisten', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => requireRows(rows, 'pengajuan penyesuaian (status apa pun)'));
      const idr = (t) => /^IDR [\d.]+,\d{2}$/.test(t);
      ApprovalPage.assertEveryRowColumn(col.jumlah, idr, 'Jumlah Pinjaman', tab.table);
      ApprovalPage.assertEveryRowColumn(col.pokok, idr, 'Penyesuaian Pokok', tab.table);
      ApprovalPage.assertEveryRowColumn(col.bunga, idr, 'Penyesuaian Bunga', tab.table);
      ApprovalPage.assertEveryRowColumn(col.tenor, (t) => /^\d+ (Bulan|Minggu|Hari)$/.test(t), 'Jangka Waktu', tab.table);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Filter', () => {
    it('TC-APVADJ-LIST-004 | Positif | opsi filter status: Semua Status, Menunggu, Disetujui, Ditolak', () => {
      ApprovalPage.openTab(fx, KEY);
      cy.get(`${flt.status} option`).should(($o) => {
        const labels = Cypress.$.makeArray($o).map((o) => o.textContent.trim());
        expect(labels).to.deep.eq(fx.filters.statusOptions);
      });
      cy.assertNoWritesLeaked();
    });

    // Dua kemungkinan eksplisit: ada baris → semua berstatus sesuai; tidak ada → empty-state.
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

    it('TC-APVADJ-LIST-005 | Positif | filter status Menunggu hanya menampilkan baris Menunggu Persetujuan (atau empty-state)', () => {
      checkStatusFilter('PENDING');
    });

    it('TC-APVADJ-LIST-006 | Positif | filter status Disetujui hanya menampilkan baris Disetujui (atau empty-state)', () => {
      checkStatusFilter('APPROVED');
    });

    it('TC-APVADJ-LIST-007 | Positif | filter status Ditolak hanya menampilkan baris Ditolak (atau empty-state)', () => {
      checkStatusFilter('REJECTED');
    });

    it('TC-APVADJ-LIST-008 | Positif | filter kantor hanya menampilkan pengajuan dari kantor terpilih', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => {
        requireRows(rows, 'pengajuan penyesuaian');
        const kantor = rows[0][col.kantor];
        cy.get(`${flt.office} option`).then(($o) => {
          const opt = Cypress.$.makeArray($o).find((o) => o.textContent.trim() === kantor);
          expect(opt, `opsi filter kantor "${kantor}"`).to.exist;
          ApprovalPage.applyFilter(fx, KEY, flt.office, opt.value, 'office_id');
        });
        ApprovalPage.readRows(tab.table).its('length').should('be.greaterThan', 0);
        ApprovalPage.assertEveryRowColumn(col.kantor, (t) => t === kantor, 'Nama Kantor Asal', tab.table);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-009 | Positif | filter produk hanya menampilkan pengajuan dengan produk terpilih', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => {
        requireRows(rows, 'pengajuan penyesuaian');
        const produk = rows[0][col.produk];
        cy.get(`${flt.product} option`).then(($o) => {
          const opt = Cypress.$.makeArray($o).find((o) => o.textContent.trim() === produk);
          expect(opt, `opsi filter produk "${produk}" (produk ACTIVE)`).to.exist;
          ApprovalPage.applyFilter(fx, KEY, flt.product, opt.value, 'product_id');
        });
        // Baris yang tadi tampil memakai produk ini → hasil filter TIDAK boleh kosong.
        ApprovalPage.readRows(tab.table).its('length').should('be.greaterThan', 0);
        ApprovalPage.assertEveryRowColumn(col.produk, (t) => t === produk, 'Produk', tab.table);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-010 | Positif | tersedia filter tanggal pada toolbar list', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.elements
        .toolbar(tab.pane)
        .find('input[type="date"], input.date-picker, .date-picker input, .input-daterange input, input[name*="date"], input[name*="tanggal"]')
        .should('have.length.greaterThan', 0);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Pencarian', () => {
    it('TC-APVADJ-LIST-011 | Positif | cari berdasarkan No Rekening menampilkan data yang sesuai', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => {
        requireRows(rows, 'pengajuan penyesuaian');
        const rek = rows[0][col.rekening];
        ApprovalPage.search(fx, KEY, rek);
        ApprovalPage.readRows(tab.table).its('length').should('be.greaterThan', 0);
        ApprovalPage.assertEveryRowColumn(col.rekening, (t) => t.includes(rek), 'No Rekening', tab.table);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-012 | Positif | cari berdasarkan Nama Nasabah menampilkan data yang sesuai', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => {
        requireRows(rows, 'pengajuan penyesuaian');
        const nama = rows[0][col.nama];
        ApprovalPage.search(fx, KEY, nama);
        ApprovalPage.readRows(tab.table).its('length').should('be.greaterThan', 0);
        ApprovalPage.dataRows(tab.table).should(($r) => {
          const hit = Cypress.$.makeArray($r).some(
            (r) => Cypress.$(r).find('td').eq(col.nama).text().trim().toLowerCase() === nama.toLowerCase(),
          );
          expect(hit, `baris dengan Nama Nasabah "${nama}"`).to.eq(true);
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-013 | Negatif | cari kata kunci yang tidak ada menampilkan list kosong', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.search(fx, KEY, fx.testData.searchNotFound);
      ApprovalPage.emptyState(tab.table).should('be.visible');
      ApprovalPage.readRows(tab.table).should('have.length', 0);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Aksi baca (detail, alasan tolak, export)', () => {
    it('TC-APVADJ-LIST-014 | Positif | tombol Lihat mengarah ke halaman detail pinjaman yang dapat dibuka', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.readRows(tab.table).then((rows) => requireRows(rows, 'pengajuan penyesuaian'));
      ApprovalPage.dataRow(tab.table, 0)
        .find('a')
        .contains(fx.buttons.view)
        .closest('a')
        .should('have.attr', 'target', '_blank')
        .invoke('attr', 'href')
        .then((href) => {
          expect(new URL(href, Cypress.config('baseUrl')).pathname).to.match(/^\/loan\/[^/]+$/);
          // GET saja (tanpa membuka tab baru): harus 200, bukan redirect ke login/home.
          cy.request({ url: href, followRedirect: false }).its('status').should('eq', 200);
        });
      cy.assertNoWritesLeaked();
    });

    it('TC-APVADJ-LIST-015 | Edge | badge Ditolak menampilkan alasan penolakan dan dapat ditutup', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.applyFilter(fx, KEY, flt.status, 'REJECTED', 'status');
      cy.get(`${tab.table} tbody`).then(($tb) => {
        if (!$tb.find('a.reject-reason').length) {
          throw new Error('PRASYARAT DATA: tidak ada pengajuan penyesuaian berstatus Ditolak dengan catatan di staging');
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

    it('TC-APVADJ-LIST-016 | Positif | tombol export Excel tersedia dan mengunduh berkas .xlsx', () => {
      ApprovalPage.openTab(fx, KEY);
      ApprovalPage.elements.excelButton(tab.pane).should('be.visible').and('contain.text', fx.buttons.excel);
      cy.document().then((doc) => {
        // Nama berkas default DataTables Buttons = <title> halaman, karakter non-aman dibuang.
        const name = `${doc.title.replace(/[^a-zA-Z0-9_¡-￿.,\-_ !()]/g, '').trim()}.xlsx`;
        ApprovalPage.elements.excelButton(tab.pane).click();
        cy.readFile(`${Cypress.config('downloadsFolder')}/${name}`, 'binary', { timeout: fx.timeout.table })
          .should('have.length.greaterThan', 0);
      });
      cy.assertNoWritesLeaked();
    });
  });
});
