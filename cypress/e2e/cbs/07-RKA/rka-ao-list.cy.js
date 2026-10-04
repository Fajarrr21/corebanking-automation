/// <reference types="cypress" />
import AoPage from '../../../support/pageobjects/RKA/RkaAccountOfficerPage';

// RKA > Account Officer — kerangka halaman, form target & daftar RKA.
// READ-ONLY: semua request tulis diblokir (cy.guardWrites) dan dicek tidak bocor.
// TC: docs/test-cases/src/TC_RKAAO_List.json
// PRD: "BKDP RKA - AO", "BKDP RKA - Setting Target AO".

describe('RKA Account Officer - Halaman & Daftar RKA', () => {
  let fx;
  const thisYear = new Date().getFullYear();

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  describe('Navigasi & akses', () => {
    it('TC-RKAAO-LIST-001 | Happy | membuka RKA > Account Officer dari menu sidebar', () => {
      AoPage.open('/home');
      cy.get('ul.page-sidebar-menu span.title').contains(fx.sidebar.parent).click();
      cy.get(`ul.page-sidebar-menu a[href$="${fx.sidebar.aoLink}"]`).click({ force: true });
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
      AoPage.assertAccessible().assertDocumentTitle(fx.ao.documentTitle);
      AoPage.elements.pill(fx.ao.pills.rka.href).should('contain.text', fx.ao.pills.rka.label)
        .parent('li').should('have.class', 'active');
      AoPage.elements.pill(fx.ao.pills.officer.href).should('contain.text', fx.ao.pills.officer.label);
      cy.assertNoWritesLeaked();
    });
  });

  describe('Form pengaturan target', () => {
    it('TC-RKAAO-LIST-002 | Positif | form menampilkan Pilih Account Officer & Pilih Tahun (default tahun berjalan)', () => {
      AoPage.visit();
      AoPage.elements.form().find('label[for="account_officer_select"]').should('contain.text', fx.ao.labels.aoSelect);
      AoPage.elements.aoSelect().should('have.attr', 'required');
      AoPage.elements.aoSelect().find('option').first().should('have.text', fx.ao.labels.aoPlaceholder);
      AoPage.elements.form().find('label[for="year_select"]').should('contain.text', fx.ao.labels.yearSelect);
      AoPage.elements.yearSelect().should('have.value', String(thisYear));
      AoPage.elements.yearSelect().find('option').then(($o) => {
        const years = Cypress.$.makeArray($o).map((o) => o.value).filter(Boolean);
        const expected = [];
        for (let y = thisYear - fx.form.yearRange; y <= thisYear + fx.form.yearRange; y += 1) expected.push(String(y));
        expect(years).to.deep.eq(expected);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-003 | Positif | tab Pinjaman/Simpanan/Lainnya & indikator Lainnya sesuai PRD', () => {
      AoPage.visit();
      cy.get('#kpiTabs a.nav-link').should(($a) => {
        const labels = Cypress.$.makeArray($a).map((a) => a.childNodes[0].textContent.trim());
        expect(labels).to.deep.eq(fx.form.tabs);
      });
      AoPage.elements.tabPane('pinjaman').find('thead th').should(($th) => {
        expect(Cypress.$.makeArray($th).map((t) => t.innerText.trim())).to.deep.eq(fx.form.tableHeaders);
      });
      cy.get('#lainnya tbody tr td:first-child').should(($td) => {
        expect(Cypress.$.makeArray($td).map((t) => t.textContent.trim())).to.deep.eq(fx.form.othersRows);
      });
      cy.get('#form_rka_ao select.target-type-select').first().find('option').should(($o) => {
        const labels = Cypress.$.makeArray($o).map((o) => o.textContent.trim()).filter((t) => !t.startsWith('--'));
        expect(labels).to.deep.eq(fx.form.targetTypes);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-004 | Negatif | form setting target AO wajib punya field "Nama RKA" (PRD)', () => {
      AoPage.visit();
      // PRD Setting Target AO: "a. Nama RKA* (required) — free text huruf & angka".
      AoPage.elements.form().find('label').should(($l) => {
        const labels = Cypress.$.makeArray($l).map((l) => l.innerText);
        expect(labels.some((t) => t.includes(fx.ao.labels.namaRka)), 'label "Nama RKA" di form').to.eq(true);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-005 | Edge | tab Simpanan terkunci sebelum data Pinjaman lengkap', () => {
      const alerts = [];
      cy.on('window:alert', (t) => alerts.push(t));
      AoPage.visit();
      AoPage.elements.tab('simpanan').should('have.class', 'disabled');
      AoPage.elements.tab('simpanan').click({ force: true });
      AoPage.elements.tabPane('simpanan').should('not.have.class', 'active');
      AoPage.elements.tabPane('pinjaman').should('have.class', 'active');
      cy.then(() => expect(alerts).to.include(fx.form.alerts.pinjamanFirst));
      cy.assertNoWritesLeaked();
    });
  });

  describe('Daftar RKA Account Officer', () => {
    it('TC-RKAAO-LIST-006 | Positif | kolom daftar RKA AO tampil berurutan', () => {
      AoPage.visit();
      cy.contains('h5', fx.ao.labels.listTitle).should('be.visible');
      AoPage.assertHeaders(fx.ao.listHeaders, '#sample_1');
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-007 | Negatif | daftar RKA AO punya kolom "Nama RKA" (PRD)', () => {
      AoPage.visit();
      AoPage.tableHeaders('#sample_1').should(($th) => {
        const labels = Cypress.$.makeArray($th).map((t) => t.innerText.trim());
        expect(labels, 'kolom daftar RKA AO').to.include(fx.ao.labels.namaRka);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-008 | Positif | pilihan jumlah data tampil 5 / 15 / 20 / All (PRD)', () => {
      AoPage.visit();
      AoPage.elements.listLength().find('option').should(($o) => {
        expect(Cypress.$.makeArray($o).map((o) => o.textContent.trim())).to.deep.eq(fx.prd.lengthOptions);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-009 | Negatif | pencarian nama yang tidak ada menampilkan daftar kosong', () => {
      AoPage.visit();
      AoPage.searchList(`TIDAKADA${Date.now()}`);
      AoPage.emptyState('#sample_1').should('be.visible');
      AoPage.dataRows('#sample_1').should('have.length', 0);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-010 | Positif | pencarian nama AO menampilkan baris AO tersebut (data kosong ditangani)', () => {
      AoPage.visit();
      AoPage.rows().then((rows) => {
        if (!rows.length) {
          cy.log('Daftar RKA AO kosong di staging — memastikan empty-state tampil.');
          AoPage.emptyState('#sample_1').should('be.visible');
          return;
        }
        const name = rows[0].cells[fx.ao.col.name];
        AoPage.searchList(name);
        AoPage.dataRows('#sample_1').should('have.length.greaterThan', 0).should(($tr) => {
          Cypress.$.makeArray($tr).forEach((tr) => {
            expect(Cypress.$(tr).text(), 'baris hasil pencarian').to.include(name);
          });
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKAAO-LIST-011 | Positif | setiap baris punya aksi Lihat Detail, Bobot, Edit, Status & Hapus (data kosong ditangani)', () => {
      AoPage.visit();
      AoPage.rows().then((rows) => {
        if (!rows.length) {
          AoPage.emptyState('#sample_1').should('be.visible');
          return;
        }
        AoPage.dataRows('#sample_1').first().within(() => {
          cy.get('button.view-details[title="Lihat Detail"]').should('exist');
          cy.get('button.settings-weight[title="Pengaturan Bobot"]').should('exist');
          cy.get('button.edit-rka[title="Edit RKA"]').should('exist');
          cy.get('button.toggle-status').should('exist');
          cy.get('button.delete-rka[title="Hapus RKA"]').should('exist');
        });
      });
      cy.assertNoWritesLeaked();
    });
  });
});
