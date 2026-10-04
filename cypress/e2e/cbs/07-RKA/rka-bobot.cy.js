/// <reference types="cypress" />
import AoPage from '../../../support/pageobjects/RKA/RkaAccountOfficerPage';
import { splitWeights } from '../../../support/pageobjects/RKA/rkaShared';

// RKA — Setting & Edit Bobot Indikator.
// TC  : docs/test-cases/src/TC_RKABobot_Setting.json
// PRD : "BKDP RKA - Setting Bobot Indikator", "BKDP RKA - Edit Setting Bobot Indicator".
//
// CATATAN SOURCE vs PRD: PRD menaruh bobot di menu Pengaturan (global, berlaku untuk
// semua unit/AO). Di origin/develop bobot disimpan PER rka_entity (tabel rka_weights,
// modal "Pengaturan Bobot" di daftar RKA). Jadi bobot TIDAK global — test mengubah
// bobot hanya pada rka_entity milik Account Officer QA yang dibuat test ini.
// Setiap test mendapat rka_entity baru (beforeEach seed) dan dibersihkan di afterEach
// (hapus rka_entity → rka_weights ikut terhapus via FK cascade). after() menghapus officer.

describe('RKA - Setting & Edit Bobot Indikator', () => {
  let fx;
  const year = new Date().getFullYear();
  const officer = {};
  const SAVE_PATH = /^\/rka\/accountofficer\/weight\/save$/;

  before(() => {
    cy.fixture('rka/rka').then((d) => (fx = d));
    cy.qaName('AO BOBOT').then((n) => (officer.name = n));
    cy.qaEmail().then((e) => (officer.email = e));
    cy.then(() => AoPage.seedOfficer(officer.name, officer.email)).then((id) => (officer.id = id));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    AoPage.seedTarget(officer.id, year, fx.target.increase);
    AoPage.entityId(officer.name).then((id) => (officer.entityId = id));
    cy.intercept('GET', fx.endpoints.aoWeight).as('aoWeight');
  });

  afterEach(() => {
    AoPage.cleanup(officer.name);
  });

  after(() => {
    AoPage.cleanup(officer.name, officer.id);
  });

  const openWeightModal = () => {
    AoPage.visit().searchList(officer.name);
    cy.then(() => AoPage.clickRowAction('settings-weight', officer.entityId));
    cy.wait('@aoWeight').its('response.body.success').should('eq', true);
    AoPage.elements.weightModal().should('be.visible');
    return AoPage.elements.weightInputs().should('have.length.greaterThan', 0).its('length');
  };

  describe('Form bobot', () => {
    it('TC-RKABOBOT-SETTING-001 | Happy | modal Pengaturan Bobot menampilkan semua indikator RKA', () => {
      cy.guardWrites();
      openWeightModal().then((n) => {
        AoPage.productRowCount().then((nProd) => expect(n, 'jumlah input bobot').to.eq(nProd + fx.form.othersCount));
      });
      AoPage.elements.weightTitle().should('have.text', `${fx.weight.modalTitlePrefix} - ${officer.name} (${year})`);
      cy.get('#rkaWeightModal h6').should(($h) => {
        expect(Cypress.$.makeArray($h).map((h) => h.innerText.trim())).to.deep.eq(fx.weight.sections);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-002 | Positif | bobot yang belum pernah diatur bernilai 0 di setiap indikator', () => {
      cy.guardWrites();
      openWeightModal();
      AoPage.elements.weightInputs().should(($i) => {
        Cypress.$.makeArray($i).forEach((el) => expect(Number(el.value), el.name).to.eq(0));
      });
      AoPage.elements.weightTotal().should('have.text', '0.00%');
      AoPage.elements.weightSave().should('be.disabled');
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-003 | Negatif | total bobot kurang dari 100 tidak dapat disimpan', () => {
      cy.guardWrites();
      openWeightModal().then((n) => AoPage.setWeights(splitWeights(n, fx.weight.underTotal)));
      AoPage.elements.weightTotal().should('have.text', `${fx.weight.underTotal}.00%`);
      AoPage.elements.weightHelp().should('have.text', fx.weight.help.under);
      AoPage.elements.weightSave().should('be.disabled');
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-004 | Negatif | total bobot lebih dari 100 tidak dapat disimpan', () => {
      cy.guardWrites();
      openWeightModal().then((n) => AoPage.setWeights(splitWeights(n, fx.weight.overTotal)));
      AoPage.elements.weightTotal().should('have.text', `${fx.weight.overTotal}.00%`);
      AoPage.elements.weightHelp().should('have.text', fx.weight.help.over);
      AoPage.elements.weightSave().should('be.disabled');
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-005 | Positif | total bobot tepat 100 mengaktifkan tombol Simpan Bobot', () => {
      cy.guardWrites();
      openWeightModal().then((n) => AoPage.setWeights(splitWeights(n)));
      AoPage.elements.weightTotal().should('have.text', '100.00%');
      AoPage.elements.weightHelp().should('have.text', fx.weight.help.exact);
      AoPage.elements.weightSave().should('be.enabled');
      cy.assertNoWritesLeaked();
    });
  });

  describe('Simpan & edit bobot', () => {
    it('TC-RKABOBOT-SETTING-006 | Happy | simpan bobot total 100 menampilkan pesan sukses', () => {
      cy.guardWrites({ allow: [SAVE_PATH] });
      cy.intercept('POST', `**${fx.endpoints.aoWeightSave}`).as('saveWeight');
      openWeightModal().then((n) => AoPage.setWeights(splitWeights(n)));
      AoPage.elements.weightSave().should('be.enabled').click();
      cy.wait('@saveWeight').its('response.body.success').should('eq', true);
      cy.location('pathname', { timeout: fx.timeout.redirect }).should('eq', fx.ao.path);
      AoPage.assertSuccess(fx.ao.messages.weightSaved);
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-007 | Happy | bobot yang sudah diatur tampil kembali saat form dibuka', () => {
      cy.then(() => AoPage.weightViaApi(officer.entityId, (n) => splitWeights(n))).then(({ values }) => {
        cy.guardWrites();
        openWeightModal();
        AoPage.elements.weightInputs().should(($i) => {
          const actual = Cypress.$.makeArray($i).map((el) => Number(el.value));
          expect(actual).to.deep.eq(values);
        });
        AoPage.elements.weightTotal().should('have.text', '100.00%');
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-008 | Happy | ubah bobot yang sudah ada lalu simpan, nilai baru tersimpan', () => {
      cy.then(() => AoPage.weightViaApi(officer.entityId, (n) => splitWeights(n)));
      cy.guardWrites({ allow: [SAVE_PATH] });
      cy.intercept('POST', `**${fx.endpoints.aoWeightSave}`).as('saveWeight');
      let edited;
      openWeightModal().then((n) => {
        edited = splitWeights(n).reverse();
        AoPage.setWeights(edited);
      });
      AoPage.elements.weightSave().should('be.enabled').click();
      cy.wait('@saveWeight').its('response.body.success').should('eq', true);
      AoPage.assertSuccess(fx.ao.messages.weightSaved);
      cy.request(`/rka/accountofficer/${officer.entityId}/weight`).then((res) => {
        const d = res.body.data;
        const saved = [...d.loans, ...d.savings, ...d.others].map((w) => Number(w.weight));
        expect(saved).to.deep.eq(edited);
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-RKABOBOT-SETTING-009 | Edge | server menolak simpan bobot dengan total selain 100', () => {
      cy.request(`/rka/accountofficer/${officer.entityId}/weight`).then((res) => {
        const d = res.body.data;
        const items = [...d.loans, ...d.savings, ...d.others];
        const values = splitWeights(items.length, fx.weight.underTotal);
        AoPage.visit();
        cy.get('meta[name="csrf-token"]').invoke('attr', 'content').then((token) => {
          cy.request({
            method: 'POST',
            url: fx.endpoints.aoWeightSave,
            headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
            body: {
              rka_entity_id: officer.entityId,
              weights: items.map((it, i) => ({ product_id: it.product_id, parameter_id: it.parameter_id, weight: values[i] })),
            },
            failOnStatusCode: false,
          }).then((r) => {
            expect(r.status).to.eq(422);
            expect(r.body.success).to.eq(false);
            expect(r.body.message).to.contain(fx.weight.serverErrorPrefix);
          });
        });
      });
      cy.request(`/rka/accountofficer/${officer.entityId}/weight`).then((res) => {
        const d = res.body.data;
        [...d.loans, ...d.savings, ...d.others].forEach((w) => expect(Number(w.weight)).to.eq(0));
      });
    });

    it('TC-RKABOBOT-SETTING-010 | Negatif | menu Pengaturan memiliki tab Bobot RKA (PRD)', () => {
      cy.guardWrites();
      AoPage.open(fx.weight.settingPath);
      AoPage.assertNotRedirectedToLogin();
      cy.get('.page-content').should(($c) => {
        const tabs = Cypress.$.makeArray($c.find('ul.nav a')).map((a) => a.innerText.trim());
        expect(tabs.some((t) => t.includes(fx.weight.settingTabText)), `tab Pengaturan: ${tabs.join(' | ')}`).to.eq(true);
      });
      cy.assertNoWritesLeaked();
    });
  });
});
