/// <reference types="cypress" />
import ReportPage from '../../../support/pageobjects/RKA/RkaReportPage';

// Laporan RKA Unit (/report/rka-unit). READ-ONLY: semua request tulis diblokir.
// TC  : docs/test-cases/src/TC_RKAUnit_Laporan.json
// PRD : "BKDP RKA - Laporan RKA Unit", "BKDP RKA - Unit" (bagian Laporan RKA Unit).

describe('Laporan RKA Unit', () => {
  let fx;
  const year = new Date().getFullYear();

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
    cy.then(() => {
      cy.intercept('GET', fx.endpoints.reportUnitData).as('reportData');
      cy.intercept('GET', fx.endpoints.reportUnitUnits).as('reportUnits');
    });
  });

  it('TC-RKAUNIT-LAPORAN-001 | Happy | halaman Laporan RKA Unit terbuka tanpa error server', () => {
    ReportPage.open('/home');
    ReportPage.pageStatus(fx.reportUnit.path).should('eq', 200);
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-002 | Happy | membuka Laporan RKA Unit dari Laporan > Umum', () => {
    ReportPage.open(fx.reportAo.generalPath);
    cy.get(`a[href="${fx.reportUnit.path}"]`).first().click();
    cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.reportUnit.path);
    ReportPage.assertBreadcrumb(fx.reportUnit.breadcrumb).assertDocumentTitle(fx.reportUnit.documentTitle);
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-003 | Positif | filter Cabang, Unit (terkunci) & Tahun default tahun berjalan', () => {
    ReportPage.visitUnit();
    ReportPage.elements.branchFilter().should('exist');
    ReportPage.elements.unitFilter().should('be.disabled');
    ReportPage.elements.yearFilter().should('have.value', String(year));
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-004 | Positif | secara default menampilkan laporan untuk pusat (PRD)', () => {
    ReportPage.visitUnit();
    ReportPage.elements.reportSection().should('be.visible');
    ReportPage.elements.emptyTitle().should('not.have.text', fx.reportUnit.messages.emptyInitial);
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-005 | Positif | tersedia filter Bulan (PRD)', () => {
    ReportPage.visitUnit();
    ReportPage.elements.filterLabels().should(($l) => {
      const labels = Cypress.$.makeArray($l).map((l) => l.innerText.trim());
      expect(labels.some((t) => t.includes(fx.prd.monthFilterLabel)), `label filter: ${labels.join(' | ')}`).to.eq(true);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-006 | Positif | kolom laporan memuat Realisasi, Target, Pencapaian, Bobot & Score', () => {
    ReportPage.visitUnit();
    ReportPage.headerTexts().then((th) => {
      const joined = th.join(' | ');
      fx.reportUnit.semanticHeaders.forEach((h) => expect(joined, 'header laporan').to.include(h));
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-007 | Negatif | Tampilkan tanpa memilih cabang menampilkan peringatan', () => {
    const alerts = [];
    cy.on('window:alert', (t) => alerts.push(t));
    ReportPage.visitUnit();
    ReportPage.elements.btnFilter().click();
    cy.then(() => expect(alerts).to.include(fx.reportUnit.messages.pickBranch));
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-008 | Positif | pilih cabang lalu Tampilkan memuat laporan atau pesan tidak ada RKA aktif', () => {
    ReportPage.visitUnit();
    ReportPage.elements.branchFilter().find('option').then(($o) => {
      const first = Cypress.$.makeArray($o).find((o) => o.value);
      expect(first, 'minimal 1 cabang').to.exist;
      ReportPage.elements.branchFilter().select(first.value, { force: true });
      cy.wait('@reportUnits');
      ReportPage.elements.unitGroup().then(($g) => {
        if ($g.is(':visible')) {
          // Opsi pertama setelah placeholder = cabang itu sendiri "(Semua Unit)".
          ReportPage.elements.unitFilter().find('option').eq(1).then(($u) => {
            ReportPage.elements.unitFilter().select($u.val(), { force: true });
          });
        }
      });
      ReportPage.selectYear(year).show();
      cy.wait('@reportData').then(({ response }) => {
        expect(response.statusCode).to.eq(200);
        ReportPage.elements.reportSection().should('be.visible');
        if (response.body.success) {
          ReportPage.elements.dataRows().should('have.length', response.body.data.length);
          ReportPage.elements.totalBobot().should('have.text', `${Number(response.body.total_bobot).toFixed(2)}%`);
        } else {
          ReportPage.elements.emptyTitle().should('have.text', response.body.message);
        }
      });
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LAPORAN-009 | Positif | tombol export CSV dan Excel tersedia (PRD)', () => {
    ReportPage.visitUnit();
    cy.get('#reportSection button, #reportSection a').then(($b) => {
      const labels = Cypress.$.makeArray($b).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
      fx.prd.exportButtons.forEach((x) => {
        expect(labels.some((t) => t.includes(x)), `tombol export ${x}: ${labels.join(' | ')}`).to.eq(true);
      });
    });
    cy.assertNoWritesLeaked();
  });
});
