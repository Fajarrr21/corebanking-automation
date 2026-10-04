/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Detail.json
// Read-only: semua test memasang cy.guardWrites() dan diakhiri cy.assertNoWritesLeaked().
// Dokumen agunan dicetak lewat window.open (di-stub) → URL-nya diambil dengan cy.request GET (read-only).
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage, { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describe('Nasabah - Pinjaman - Detail Pinjaman', () => {
  let fx;
  let loan;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdBulanan,
        type: 'MONTHLY',
        dataPath: fx.paths.data,
        length: fx.data.scanLength,
        label: 'bulanan',
      }).then((l) => {
        loan = l;
      });
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Halaman detail', () => {
    it('TC-LOAN-DETAIL-001 | Happy | Detail pinjaman aktif tampil dengan judul, breadcrumb, dan tab Data Pinjaman', () => {
      LoanDetailPage.openDetail(fx.paths.detail, loan.refId);
      LoanDetailPage.assertDocumentTitle(fx.detail.title).assertBreadcrumb(fx.detail.breadcrumb);
      cy.get('#tab_data').should('have.class', 'active').invoke('text').then((t) => {
        const txt = norm(t);
        fx.detail.dataLabels.forEach((l) => expect(txt, `label ${l}`).to.include(l));
      });
    });

    it('TC-LOAN-DETAIL-002 | Positif | Tab dasar Data Pinjaman, Jadwal Angsuran, dan Agunan tersedia', () => {
      LoanDetailPage.openDetail(fx.paths.detail, loan.refId);
      LoanDetailPage.navLabels().then((labels) => {
        [fx.detail.tabs.data, fx.detail.tabs.jadwal, fx.detail.tabs.agunan].forEach((l) => {
          expect(labels, `tab ${l}`).to.include(l);
        });
      });
    });

    it('TC-LOAN-DETAIL-003 | Negatif | Tab Dokumen Pencairan (Cetak SPK) dan Surat Pengajuan tersedia bagi pengguna yang boleh melihat pinjaman', () => {
      // PRD SPK (a, c) & Formulir Permohonan (f): aksi cetak ada di detail pinjaman, mengikuti hak akses Pinjaman - Lihat.
      // Source detail.blade.php: untuk super-admin/auditor kedua tab TIDAK ada di nav → kandidat bug bila akun test super-admin.
      LoanDetailPage.openDetail(fx.paths.detail, loan.refId);
      LoanDetailPage.navLabels().then((labels) => {
        expect(labels, 'tab Dokumen Pencairan').to.include(fx.detail.tabs.dokumenPencairan);
        expect(labels, 'tab Surat Pengajuan').to.include(fx.detail.tabs.suratPengajuan);
      });
    });

    it('TC-LOAN-DETAIL-004 | Negatif | Ref ID pinjaman yang tidak ada dialihkan ke daftar pinjaman dengan pesan error', () => {
      LoanDetailPage.open(fx.paths.detail.replace('{refId}', fx.data.refIdTidakAda));
      LoanDetailPage.assertNotRedirectedToLogin();
      cy.location('pathname').should('eq', fx.paths.list);
      LoanDetailPage.assertError(fx.detail.notFound);
    });

    it('TC-LOAN-DETAIL-005 | Negatif | Detail pinjaman menampilkan nama Officer Pengelola (PRD Pengajuan Pinjaman)', () => {
      LoanDetailPage.openDetail(fx.paths.detail, loan.refId);
      cy.get('#tab_data').invoke('text').then((t) => {
        expect(norm(t), 'label Officer Pengelola di detail').to.include(fx.detail.officerPengelolaLabel);
      });
    });
  });

  describe('Tab Agunan (PRD BKD - Agunan Pinjaman)', () => {
    beforeEach(() => {
      LoanDetailPage.openDetail(fx.paths.detail, loan.refId, 'collateral');
      cy.get(fx.collateral.pane).should('have.class', 'active');
    });

    it('TC-LOAN-DETAIL-006 | Happy | Tab Agunan menampilkan sub-tab Dokumen, Surat Kuasa Menjual, Surat Penyerahan, Tanda Terima', () => {
      cy.get(`${fx.collateral.pane} ul.nav-pills a[data-toggle="tab"]`).then(($a) => {
        expect(Cypress.$.makeArray($a).map((a) => norm(a.innerText))).to.deep.eq(fx.collateral.subtabs);
      });
      cy.get(fx.collateral.panes[0]).should('have.class', 'active');
    });

    it('TC-LOAN-DETAIL-007 | Positif | Sub-tab Dokumen menampilkan informasi dan penilaian agunan', () => {
      cy.get(fx.collateral.panes[0]).invoke('text').then((t) => {
        const txt = norm(t);
        fx.collateral.dokumenLabels.forEach((l) => expect(txt, l).to.include(l));
      });
    });

    it('TC-LOAN-DETAIL-008 | Positif | Surat Kuasa Menjual menampilkan data Pihak I/II & agunan serta pilihan Pihak II', () => {
      LoanDetailPage.elements.collateralSubtab(fx.collateral.subtabs[1]).click();
      cy.get(fx.collateral.panes[1]).should('have.class', 'active').invoke('text').then((t) => {
        fx.collateral.sellLabels.forEach((l) => expect(norm(t), l).to.include(l));
      });
      cy.get(fx.collateral.sellSecondParty).should('exist');
    });

    it('TC-LOAN-DETAIL-009 | Positif | Surat Penyerahan menampilkan data agunan serta pilihan Pihak II', () => {
      LoanDetailPage.elements.collateralSubtab(fx.collateral.subtabs[2]).click();
      cy.get(fx.collateral.panes[2]).should('have.class', 'active').invoke('text').then((t) => {
        fx.collateral.submissionLabels.forEach((l) => expect(norm(t), l).to.include(l));
      });
      cy.get(fx.collateral.submissionSecondParty).should('exist');
    });

    it('TC-LOAN-DETAIL-010 | Positif | Tanda Terima menampilkan data nasabah & agunan serta pilihan Kepala Unit dan Pengelola', () => {
      LoanDetailPage.elements.collateralSubtab(fx.collateral.subtabs[3]).click();
      cy.get(fx.collateral.panes[3]).should('have.class', 'active').invoke('text').then((t) => {
        fx.collateral.receiptLabels.forEach((l) => expect(norm(t), l).to.include(l));
      });
      cy.get(fx.collateral.receiptHeadOffice).should('exist');
      cy.get(fx.collateral.receiptOfficer).should('exist');
    });

    it('TC-LOAN-DETAIL-011 | Positif | Tombol cetak tiap dokumen agunan membuka halaman cetak yang valid tanpa request tulis', () => {
      LoanDetailPage.stubWindowOpen();
      fx.collateral.views.forEach((view, i) => {
        LoanDetailPage.elements.collateralSubtab(fx.collateral.subtabs[i]).click();
        cy.get(fx.collateral.panes[i]).find(`[onclick*="${view}"]`).first().click({ force: true });
        LoanDetailPage.lastOpenedUrl().then((url) => {
          expect(url, 'URL cetak').to.include(fx.paths.printCollateralNew.replace('{refId}', loan.refId)).and.include(`view=${view}`);
          LoanDetailPage.fetchHtml(url, fx.timeout.request);
        });
      });
    });
  });
});
