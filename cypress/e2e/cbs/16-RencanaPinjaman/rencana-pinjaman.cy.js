// Rencana Pinjaman (/loan-plan) — daftar, masking NIK, aksi per status, modal Ubah. Read-only.
// TC sumber: docs/test-cases/src/TC_RencanaPinjaman_List.json
// Tidak ada PRD di Notion (Sumber = Asumsi dari source). Tombol "Batalkan" (GET) TIDAK diklik.
import LoginPage from '../../../support/pageobjects/LoginPage';
import LoanPlanPage, { cell } from '../../../support/pageobjects/RencanaPinjaman/LoanPlanPage';

describe('Rencana Pinjaman - Daftar (/loan-plan)', () => {
  let fx;
  let T;

  before(() => {
    cy.fixture('rencanapinjaman/rencana-pinjaman').then((d) => {
      fx = d;
      T = d.table;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', fx.dataUrl).as('planData');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openList = () => {
    LoanPlanPage.open(fx.path).assertUrl(fx.path).assertNotRedirectedToLogin();
    cy.wait('@planData').its('response.statusCode').should('eq', 200);
    LoanPlanPage.waitTable(T, fx.timeouts.table);
  };

  it('TC-RPJ-LIST-001 | Happy | Menu Rencana Pinjaman membuka halaman daftar rencana', () => {
    LoanPlanPage.open(fx.home);
    LoanPlanPage.elements.sidebarMenu(fx.menuTitle).should('have.length', 1).click();
    cy.location('pathname').should('eq', fx.path);
    LoanPlanPage.assertBreadcrumb(fx.breadcrumb).assertDocumentTitle(fx.title);
    LoanPlanPage.elements.caption().should('contain.text', fx.caption);
    LoanPlanPage.elements.captionHelper().should('contain.text', fx.captionHelper);
  });

  it('TC-RPJ-LIST-002 | Positif | Tabel rencana pinjaman memuat kolom lengkap', () => {
    openList();
    LoanPlanPage.assertHeaders(fx.headers, T);
  });

  it('TC-RPJ-LIST-003 | Positif | Status rencana hanya Menunggu Pengajuan / Sudah Diajukan / Dibatalkan', () => {
    openList();
    const allowed = Object.values(fx.status);
    LoanPlanPage.assertEveryRowColumn(fx.col.status, (t) => allowed.includes(t), 'status', T);
  });

  it('TC-RPJ-LIST-004 | Positif | NIK ditampilkan tersamar dan tombol mata menampilkan NIK lengkap', () => {
    openList();
    LoanPlanPage.rowsWhere(T, (tr) => Cypress.$(tr).find('.nik-toggle').length > 0).then((rows) => {
      if (!rows.length) {
        cy.log('Tidak ada data rencana dengan NIK — cek empty-state');
        LoanPlanPage.emptyState(T).should('be.visible');
        return;
      }
      const tr = rows[0];
      const full = Cypress.$(tr).find('.nik-full').text().trim();
      const masked = Cypress.$(tr).find('.nik-masked').text().trim();
      if (full.length > 10) {
        expect(masked, 'NIK tersamar').to.eq(`${full.slice(0, 4)}${'*'.repeat(full.length - 10)}${full.slice(-6)}`);
      }
      cy.wrap(tr).find('.nik-full').should('not.be.visible');
      cy.wrap(tr).find('.nik-toggle').click();
      cy.wrap(tr).find('.nik-full').should('be.visible').and('have.text', full);
      cy.wrap(tr).find('.nik-masked').should('not.be.visible');
    });
  });

  it('TC-RPJ-LIST-005 | Positif | Aksi sesuai status: OPEN punya Ubah & Batalkan; selain OPEN tidak', () => {
    openList();
    cy.get(`${T} tbody tr`).should(($rows) => {
      Cypress.$.makeArray($rows)
        .filter((tr) => !Cypress.$(tr).find('td.dataTables_empty').length)
        .forEach((tr) => {
          const status = cell(tr, fx.col.status);
          const aksi = Cypress.$(tr).find('td').eq(fx.col.aksi);
          const hasEdit = aksi.find('a.plan-edit').length === 1;
          const hasCancel = aksi.find('a[href*="/cancel"]').length === 1;
          if (status === fx.status.open) {
            expect(hasEdit && hasCancel, `baris ${cell(tr, 0)} OPEN punya Ubah & Batalkan`).to.eq(true);
          } else {
            expect(hasEdit || hasCancel, `baris ${cell(tr, 0)} ${status} tanpa Ubah/Batalkan`).to.eq(false);
          }
          const ajukan = aksi.find(`a[href*="/loan/create/"]`);
          const blocked = aksi.find('span.disabled');
          expect(ajukan.length + blocked.length, 'Ajukan atau Belum bisa diajukan').to.eq(1);
          if (ajukan.length) {
            expect(new URL(ajukan.attr('href')).pathname).to.eq(`/loan/create/${cell(tr, fx.col.cif)}`);
          } else {
            expect(blocked.text()).to.contain(fx.buttons.blocked);
          }
        });
    });
  });

  it('TC-RPJ-LIST-006 | Positif | Pencarian berdasarkan nama nasabah menyaring baris', () => {
    openList();
    LoanPlanPage.rowsWhere(T, () => true).then((rows) => {
      if (!rows.length) {
        cy.log('Belum ada data rencana pinjaman — pencarian tidak dapat diuji');
        LoanPlanPage.emptyState(T).should('be.visible');
        return;
      }
      const name = cell(rows[0], fx.col.nasabah);
      LoanPlanPage.tableSearch(T).type(name);
      cy.wait('@planData').then(({ request }) => {
        expect(decodeURIComponent(request.url.replace(/\+/g, ' ')), 'kata kunci terkirim').to.include(name);
      });
      LoanPlanPage.waitTable(T, fx.timeouts.table);
      // Global search DataTables: setiap baris hasil memuat kata kunci di salah satu kolom teks.
      cy.get(`${T} tbody tr`).should(($r) => {
        Cypress.$.makeArray($r)
          .filter((tr) => !Cypress.$(tr).find('td.dataTables_empty').length)
          .forEach((tr) => expect(Cypress.$(tr).text().toLowerCase(), 'baris hasil cari').to.include(name.toLowerCase()));
      });
      cy.get(`${T} tbody tr`).should(($r) => {
        const hit = Cypress.$.makeArray($r).some((tr) => cell(tr, fx.col.nasabah) === name);
        expect(hit, `nasabah "${name}" ada di hasil`).to.eq(true);
      });
    });
  });

  it('TC-RPJ-LIST-007 | Edge | Pencarian tanpa kecocokan menampilkan empty-state', () => {
    openList();
    LoanPlanPage.tableSearch(T).type(fx.searchNoMatch);
    cy.wait('@planData');
    LoanPlanPage.waitTable(T, fx.timeouts.table);
    LoanPlanPage.emptyState(T).should('be.visible');
  });

  it('TC-RPJ-LIST-008 | Positif | Modal Ubah terisi data rencana (tanpa disimpan) dan Batal menutup modal', () => {
    openList();
    LoanPlanPage.rowsWhere(T, (tr) => cell(tr, fx.col.status) === fx.status.open).then((rows) => {
      if (!rows.length) {
        cy.log('Tidak ada rencana berstatus Menunggu Pengajuan — tombol Ubah tidak tersedia');
        cy.get(`${T} tbody a.plan-edit`).should('not.exist');
        return;
      }
      const tr = rows[0];
      const btn = Cypress.$(tr).find('a.plan-edit');
      LoanPlanPage.openEdit(tr);
      LoanPlanPage.elements.modalTitle().should('contain.text', fx.modal.title);
      LoanPlanPage.elements.modalName().should('have.text', String(btn.data('name')));
      LoanPlanPage.elements.modalCode().should('have.text', String(btn.data('code')));
      LoanPlanPage.elements.modalProduct().should('have.value', String(btn.data('product')));
      LoanPlanPage.elements.modalTenor().should('have.value', String(btn.data('tenor')));
      LoanPlanPage.elements.modalAmount().invoke('val').then((v) => {
        expect(Number(v.replace(/[^0-9]/g, ''))).to.eq(Math.round(Number(btn.data('amount'))));
      });
      LoanPlanPage.elements.modalNik().find('.nik-masked').should('be.visible');
      LoanPlanPage.elements.modalCancel().click();
      LoanPlanPage.elements.modal().should('not.be.visible');
    });
  });

  it('TC-RPJ-LIST-009 | Negatif | Simpan Ubah dengan Jangka Waktu kosong diblok validasi wajib isi', () => {
    openList();
    LoanPlanPage.rowsWhere(T, (tr) => cell(tr, fx.col.status) === fx.status.open).then((rows) => {
      if (!rows.length) {
        cy.log('Tidak ada rencana berstatus Menunggu Pengajuan — skenario tidak dapat dijalankan');
        cy.get(`${T} tbody a.plan-edit`).should('not.exist');
        return;
      }
      LoanPlanPage.openEdit(rows[0]);
      LoanPlanPage.elements.modalTenor().clear();
      LoanPlanPage.elements.modalSave().click();
      LoanPlanPage.elements.modalTenor().then(($i) => expect($i[0].checkValidity(), 'tenor valid?').to.eq(false));
      cy.blockedWrites().should('have.length', 0);
      LoanPlanPage.elements.modalCancel().click();
    });
  });

  it('TC-RPJ-LIST-010 | Negatif | Membatalkan rencana dengan ID yang tidak ada ditolak dengan pesan tidak ditemukan', () => {
    LoanPlanPage.open(`${fx.path}/${fx.nonExistingId}/cancel`);
    cy.location('pathname').should('eq', fx.path);
    LoanPlanPage.assertError(fx.messages.notFound);
  });

  it('TC-RPJ-LIST-011 | Negatif | Membatalkan rencana yang sudah tidak aktif ditolak (status tidak berubah)', () => {
    openList();
    LoanPlanPage.rowsWhere(T, (tr) => [fx.status.used, fx.status.cancelled].includes(cell(tr, fx.col.status))).then((rows) => {
      if (!rows.length) {
        cy.log('Tidak ada rencana Sudah Diajukan/Dibatalkan di halaman pertama — skenario tidak dapat dijalankan');
        return;
      }
      const id = cell(rows[0], fx.col.id);
      const status = cell(rows[0], fx.col.status);
      LoanPlanPage.open(`${fx.path}/${id}/cancel`);
      cy.location('pathname').should('eq', fx.path);
      LoanPlanPage.assertError(fx.messages.inactive);
      cy.wait('@planData');
      LoanPlanPage.waitTable(T, fx.timeouts.table);
      // Tabel dimuat ulang; status baris yang sama tidak berubah.
      cy.get(`${T} tbody tr`).should(($r) => {
        const row = Cypress.$.makeArray($r).find((tr) => cell(tr, fx.col.id) === id);
        if (row) expect(cell(row, fx.col.status)).to.eq(status);
      });
    });
  });
});
