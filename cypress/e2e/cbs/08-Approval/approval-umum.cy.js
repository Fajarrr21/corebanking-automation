/// <reference types="cypress" />
import ApprovalPage from '../../../support/pageobjects/Approval/ApprovalPage';

// Halaman Approval (/approval) — kerangka halaman & tab lama (Pembukuan,
// Transaksi, Pengajuan Online). READ-ONLY: semua request tulis diblokir.
// TC: docs/test-cases/src/TC_Approval_Umum.json

describe('Approval - Halaman & Tab', () => {
  let fx;

  before(() => {
    cy.fixture('approval/approval').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  describe('Navigasi & kerangka halaman', () => {
    it('TC-APV-UMUM-001 | Happy | membuka halaman Approval dari menu sidebar', () => {
      ApprovalPage.interceptTables(fx);
      ApprovalPage.open('/home');
      ApprovalPage.elements.sidebarTitles().contains(fx.page.sidebarMenu).click();
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.path);
      ApprovalPage.assertBreadcrumb(fx.page.breadcrumb).assertDocumentTitle(fx.page.documentTitle);
      ApprovalPage.assertActiveTab(fx.tabs.customer);
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-002 | Positif | kelima tab tampil berurutan dengan label yang benar', () => {
      ApprovalPage.openTab(fx, 'customer');
      const expected = ['customer', 'office', 'online', 'adjustment', 'statusChange'].map((k) => fx.tabs[k].label);
      cy.get('ul.nav-pills > li > a').should(($a) => {
        const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
        expect(labels).to.deep.eq(expected);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-003 | Positif | tanpa parameter menu, tab Pembukuan aktif secara default', () => {
      ApprovalPage.openTab(fx, 'customer');
      ApprovalPage.assertActiveTab(fx.tabs.customer);
      ['office', 'online', 'adjustment', 'statusChange'].forEach((k) => {
        ApprovalPage.elements.pane(fx.tabs[k].pane).should('not.have.class', 'active');
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-004 | Positif | parameter menu=loan_adjustment_approval membuka tab Penyesuaian Pinjaman', () => {
      ApprovalPage.openTab(fx, 'adjustment');
      ApprovalPage.assertActiveTab(fx.tabs.adjustment);
      ApprovalPage.elements.pane(fx.tabs.customer.pane).should('not.have.class', 'active');
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-005 | Positif | parameter menu=loan_status_change_approval membuka tab Perubahan Status Pinjaman', () => {
      ApprovalPage.openTab(fx, 'statusChange');
      ApprovalPage.assertActiveTab(fx.tabs.statusChange);
      ApprovalPage.elements.pane(fx.tabs.customer.pane).should('not.have.class', 'active');
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-006 | Edge | parameter menu=online_approval hanya menandai pill Pengajuan Online sebagai aktif', () => {
      ApprovalPage.openTab(fx, 'online');
      ApprovalPage.assertActiveTab(fx.tabs.online);
      // Hanya SATU pill aktif.
      cy.get('ul.nav-pills > li.active').should('have.length', 1);
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-007 | Positif | klik tab mengganti pane aktif dan parameter menu di URL', () => {
      ApprovalPage.openTab(fx, 'customer');
      ApprovalPage.elements.tabLink(fx.tabs.statusChange.menu).click();
      ApprovalPage.elements.pane(fx.tabs.statusChange.pane).should('have.class', 'active');
      cy.location('search').should('include', `menu=${fx.tabs.statusChange.menu}`);
      ApprovalPage.elements.tabLink(fx.tabs.adjustment.menu).click();
      ApprovalPage.elements.pane(fx.tabs.adjustment.pane).should('have.class', 'active');
      cy.location('search').should('include', `menu=${fx.tabs.adjustment.menu}`);
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-008 | Positif | kelima endpoint data tabel merespons 200 saat halaman dimuat', () => {
      ApprovalPage.interceptTables(fx);
      ApprovalPage.open(fx.path);
      Object.keys(fx.tabs).forEach((k) => {
        cy.wait(`@data_${k}`, { timeout: fx.timeout.table }).its('response.statusCode').should('eq', 200);
      });
      cy.assertNoWritesLeaked();
    });
  });

  describe('Tab lama (Pembukuan, Transaksi, Pengajuan Online)', () => {
    it('TC-APV-UMUM-009 | Positif | tab Pembukuan menampilkan kolom tabel yang benar', () => {
      ApprovalPage.openTab(fx, 'customer');
      ApprovalPage.assertHeaders(fx.headers.customer, fx.tabs.customer.table);
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-010 | Positif | tab Transaksi menampilkan kolom tabel yang benar', () => {
      ApprovalPage.openTab(fx, 'office');
      ApprovalPage.assertHeaders(fx.headers.office, fx.tabs.office.table);
      cy.assertNoWritesLeaked();
    });

    it('TC-APV-UMUM-011 | Positif | tab Pengajuan Online menampilkan kolom tabel yang benar', () => {
      ApprovalPage.openTab(fx, 'online');
      ApprovalPage.assertHeaders(fx.headers.online, fx.tabs.online.table);
      cy.assertNoWritesLeaked();
    });
  });
});
