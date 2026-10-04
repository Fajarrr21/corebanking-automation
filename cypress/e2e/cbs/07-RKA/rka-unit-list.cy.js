/// <reference types="cypress" />
import UnitPage from '../../../support/pageobjects/RKA/RkaUnitPage';

// RKA > Cabang (RKA Unit) — kerangka halaman, form target & daftar RKA cabang.
// READ-ONLY: semua request tulis diblokir (cy.guardWrites) dan dicek tidak bocor.
// TC  : docs/test-cases/src/TC_RKAUnit_List.json
// PRD : "BKDP RKA - Unit", "BKDP RKA - Setting Target Unit".

describe('RKA Cabang - Halaman & Daftar RKA', () => {
  let fx;
  const thisYear = new Date().getFullYear();

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
    cy.then(() => cy.intercept('GET', fx.endpoints.unitsByBranch).as('unitsByBranch'));
  });

  it('TC-RKAUNIT-LIST-001 | Happy | membuka RKA > Cabang dari menu sidebar', () => {
    UnitPage.open('/home');
    cy.get('ul.page-sidebar-menu span.title').contains(fx.sidebar.parent).click();
    cy.get(`ul.page-sidebar-menu a[href$="${fx.sidebar.unitLink}"]`).click({ force: true });
    cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.unit.path);
    UnitPage.assertAccessible().assertBreadcrumb(fx.unit.breadcrumb).assertDocumentTitle(fx.unit.documentTitle);
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-002 | Positif | form menampilkan Pilih Wilayah, Pilih Cabang (terkunci) & Pilih Tahun default tahun berjalan', () => {
    UnitPage.visit();
    UnitPage.elements.form().find('label[for="branch_select"]').should('contain.text', fx.unit.labels.branchSelect);
    UnitPage.elements.form().find('label[for="sales_select"]').should('contain.text', fx.unit.labels.officeSelect);
    UnitPage.elements.officeSelect().should('be.disabled')
      .find('option').first().should('have.text', fx.unit.labels.officeDisabledPlaceholder);
    UnitPage.elements.yearSelect().should('have.value', String(thisYear));
    cy.get('#kpiTabs a.nav-link').should(($a) => {
      expect(Cypress.$.makeArray($a).map((a) => a.childNodes[0].textContent.trim())).to.deep.eq(fx.form.tabs);
    });
    cy.get('#lainnya tbody tr td:first-child').should(($td) => {
      expect(Cypress.$.makeArray($td).map((t) => t.textContent.trim())).to.deep.eq(fx.form.othersRows);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-003 | Positif | memilih wilayah memuat daftar cabang di bawahnya', () => {
    UnitPage.visit();
    UnitPage.elements.branchSelect().find('option').then(($o) => {
      const first = Cypress.$.makeArray($o).find((o) => o.value);
      expect(first, 'minimal 1 wilayah').to.exist;
      UnitPage.selectBranch(first.value);
      UnitPage.elements.officeGroup().then(($g) => {
        if ($g.is(':visible')) {
          // Wilayah punya unit: opsi pertama = wilayah itu sendiri "(Semua Unit)".
          UnitPage.elements.officeSelect().should('be.enabled').find('option').should(($opt) => {
            const texts = Cypress.$.makeArray($opt).map((x) => x.textContent.trim()).filter(Boolean);
            expect(texts.length).to.be.greaterThan(2);
            expect(texts[1]).to.contain('(Semua Unit)');
          });
        } else {
          // Wilayah tanpa unit: dropdown disembunyikan, office_id = wilayah itu sendiri.
          UnitPage.elements.officeSelect().should('have.value', first.value);
        }
      });
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-004 | Negatif | simpan tanpa memilih wilayah ditolak dengan pesan', () => {
    const alerts = [];
    cy.on('window:alert', (t) => alerts.push(t));
    UnitPage.visit();
    UnitPage.fillTargets(fx.target.increase).goToTab('lainnya').submit();
    cy.then(() => expect(alerts).to.include(fx.unit.messages.pickBranch));
    cy.location('pathname').should('eq', fx.unit.path);
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-005 | Edge | tab Simpanan terkunci sebelum data Pinjaman lengkap', () => {
    const alerts = [];
    cy.on('window:alert', (t) => alerts.push(t));
    UnitPage.visit();
    UnitPage.elements.tab('simpanan').click({ force: true });
    UnitPage.elements.tabPane('simpanan').should('not.have.class', 'active');
    cy.then(() => expect(alerts).to.include(fx.form.alerts.pinjamanFirst));
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-006 | Positif | kolom daftar RKA Cabang memuat Status, Nama Cabang, Tanggal Set/Update & Aksi', () => {
    UnitPage.visit();
    cy.contains('h5', fx.unit.labels.listTitle).should('be.visible');
    UnitPage.assertHeaders(fx.unit.listHeaders, '#sample_1');
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-007 | Positif | pilihan jumlah data tampil 5 / 15 / 20 / All (PRD)', () => {
    UnitPage.visit();
    UnitPage.elements.listLength().find('option').should(($o) => {
      expect(Cypress.$.makeArray($o).map((o) => o.textContent.trim())).to.deep.eq(fx.prd.lengthOptions);
    });
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-008 | Negatif | pencarian nama unit yang tidak ada menampilkan daftar kosong', () => {
    UnitPage.visit();
    UnitPage.searchList(`TIDAKADA${Date.now()}`);
    UnitPage.emptyState('#sample_1').should('be.visible');
    cy.assertNoWritesLeaked();
  });

  it('TC-RKAUNIT-LIST-009 | Positif | pencarian nama unit menampilkan unit tersebut (data kosong ditangani)', () => {
    UnitPage.visit();
    UnitPage.rows().then((rows) => {
      if (!rows.length) {
        cy.log('Daftar RKA Cabang kosong di staging — memastikan empty-state tampil.');
        UnitPage.emptyState('#sample_1').should('be.visible');
        return;
      }
      const name = rows[0].cells[fx.unit.col.name];
      UnitPage.searchList(name);
      UnitPage.dataRows('#sample_1').should('have.length.greaterThan', 0).should(($tr) => {
        Cypress.$.makeArray($tr).forEach((tr) => expect(Cypress.$(tr).text()).to.include(name));
      });
    });
    cy.assertNoWritesLeaked();
  });
});
