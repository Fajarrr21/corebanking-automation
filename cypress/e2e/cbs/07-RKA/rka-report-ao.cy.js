/// <reference types="cypress" />
import ReportPage from '../../../support/pageobjects/RKA/RkaReportPage';
import AoPage from '../../../support/pageobjects/RKA/RkaAccountOfficerPage';
import { splitWeights } from '../../../support/pageobjects/RKA/rkaShared';

// Laporan RKA Account Officer (/report/rka-officer).
// TC  : docs/test-cases/src/TC_RKAAO_Laporan.json
// PRD : "BKDP RKA - Laporan RKA AO", "BKDP RKA - AO" (bagian Laporan RKA AO).
//
// Bagian "Halaman & filter" READ-ONLY (write-guard). Bagian "Data laporan" membuat
// data uji milik test: Account Officer QA + penugasan 1 kantor + target RKA tahun
// berjalan + bobot (total 100) + status Aktif. Semuanya dibersihkan di after()
// (hapus rka_entity kolom Nama AO = nama QA → hapus penugasan → hapus officer).

describe('Laporan RKA Account Officer', () => {
  let fx;
  const year = new Date().getFullYear();

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.then(() => cy.intercept('GET', fx.endpoints.reportAoData).as('reportData'));
  });

  describe('Halaman & filter', () => {
    it('TC-RKAAO-LAPORAN-001 | Happy | halaman Laporan RKA AO terbuka tanpa error server', () => {
      cy.guardWrites();
      ReportPage.open('/home');
      ReportPage.pageStatus(fx.reportAo.path).should('eq', 200);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-002 | Happy | membuka Laporan RKA AO dari Laporan > Umum', () => {
      cy.guardWrites();
      ReportPage.open(fx.reportAo.generalPath);
      cy.get(`a[href="${fx.reportAo.path}"]`).first().click();
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.reportAo.path);
      ReportPage.assertBreadcrumb(fx.reportAo.breadcrumb).assertDocumentTitle(fx.reportAo.documentTitle);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-003 | Positif | filter Account Officer & Tahun tampil, default tahun berjalan dan laporan belum dimuat', () => {
      cy.guardWrites();
      ReportPage.visitOfficer();
      ReportPage.elements.officerFilter().should('exist');
      ReportPage.elements.yearFilter().should('have.value', String(year));
      ReportPage.elements.btnFilter().should('be.visible');
      ReportPage.elements.reportSection().should('not.be.visible');
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-004 | Positif | tersedia filter Bulan dengan default bulan berjalan (PRD)', () => {
      cy.guardWrites();
      ReportPage.visitOfficer();
      ReportPage.elements.filterLabels().should(($l) => {
        const labels = Cypress.$.makeArray($l).map((l) => l.innerText.trim());
        expect(labels.some((t) => t.includes(fx.prd.monthFilterLabel)), `label filter: ${labels.join(' | ')}`).to.eq(true);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-005 | Positif | kolom laporan memuat Target per Caturwulan CW1-CW3 (PRD)', () => {
      cy.guardWrites();
      ReportPage.visitOfficer();
      ReportPage.headerTexts().then((th) => {
        ['CW1', 'CW2', 'CW3'].forEach((cw) => expect(th, 'header laporan').to.include(cw));
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-006 | Negatif | Tampilkan tanpa memilih Account Officer menampilkan peringatan', () => {
      const alerts = [];
      cy.on('window:alert', (t) => alerts.push(t));
      cy.guardWrites();
      ReportPage.visitOfficer();
      ReportPage.elements.btnFilter().click();
      cy.then(() => expect(alerts).to.include(fx.reportAo.messages.pickOfficer));
      ReportPage.elements.reportSection().should('not.be.visible');
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-007 | Positif | tombol export CSV dan Excel tersedia (PRD)', () => {
      cy.guardWrites();
      ReportPage.visitOfficer();
      cy.get('#reportSection button, #reportSection a').then(($b) => {
        const labels = Cypress.$.makeArray($b).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
        fx.prd.exportButtons.forEach((x) => {
          expect(labels.some((t) => t.includes(x)), `tombol export ${x}: ${labels.join(' | ')}`).to.eq(true);
        });
      });
      cy.assertNoWritesLeaked();
    });
  });

  describe('Data laporan (data uji Account Officer QA)', () => {
    const officer = {};

    before(() => {
      cy.qaName('AO LAPORAN').then((n) => (officer.name = n));
      cy.qaEmail().then((e) => (officer.email = e));
      cy.then(() => AoPage.seedOfficer(officer.name, officer.email)).then((id) => (officer.id = id));
    });

    after(() => {
      AoPage.cleanup(officer.name, officer.id);
    });

    it('TC-RKAAO-LAPORAN-008 | Negatif | AO tanpa RKA aktif menampilkan pesan data tidak ada', () => {
      cy.guardWrites();
      ReportPage.visitOfficer();
      ReportPage.selectOfficer(officer.id).selectYear(year).show();
      cy.wait('@reportData').its('response.body.success').should('eq', false);
      ReportPage.elements.emptyTitle().should('have.text', fx.reportAo.messages.noActive);
      ReportPage.elements.dataRows().should('have.length', 1);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LAPORAN-009 | Happy | laporan AO menampilkan indikator, bobot & score sesuai rumus PRD', () => {
      AoPage.assignFirstOfficeViaApi(officer.id);
      AoPage.seedTarget(officer.id, year, fx.target.increase);
      AoPage.entityId(officer.name).then((entityId) => {
        AoPage.weightViaApi(entityId, (n) => splitWeights(n)).then(({ count, values }) => {
          AoPage.toggleViaApi(entityId, 'ACTIVE');
          cy.guardWrites();
          ReportPage.visitOfficer();
          ReportPage.selectOfficer(officer.id).selectYear(year).show();
          cy.wait('@reportData').its('response.body.success').should('eq', true);
          ReportPage.parsedRows().then((rows) => {
            expect(rows, 'jumlah indikator').to.have.length(count);
            const weights = rows.map((r) => r.weight);
            expect(weights.reduce((a, b) => a + b, 0), 'total bobot baris').to.be.closeTo(100, 0.01);
            expect([...weights].sort()).to.deep.eq([...values].sort());
            rows.forEach((r) => {
              expect(r.cells, 'jumlah sel per baris').to.eq(20);
              // PRD: Score Nilai = Pencapaian(%) × Bobot Penilaian
              expect(r.score, `score ${r.indicator}`).to.be.closeTo((r.achievement * r.weight) / 100, 0.1);
            });
          });
          ReportPage.elements.totalBobot().should('have.text', '100.00%');
          ReportPage.elements.statTotal().should('have.text', String(count));
          cy.assertNoWritesLeaked();
        });
      });
    });

    it('TC-RKAAO-LAPORAN-010 | Positif | export Excel laporan AO mengunduh file xlsx', () => {
      cy.guardWrites();
      ReportPage.visitOfficer();
      cy.window().then((win) => cy.stub(win, 'open').as('winOpen'));
      ReportPage.selectOfficer(officer.id).selectYear(year).show();
      cy.wait('@reportData');
      ReportPage.elements.btnExport().click();
      cy.get('@winOpen').should('have.been.calledOnce').then((stub) => {
        const url = stub.firstCall.args[0];
        expect(url).to.contain(`account_officer_id=${officer.id}`);
        cy.request({ url, encoding: 'binary' }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.headers['content-type']).to.contain(fx.reportAo.exportContentType);
        });
      });
      cy.assertNoWritesLeaked();
    });
  });
});
