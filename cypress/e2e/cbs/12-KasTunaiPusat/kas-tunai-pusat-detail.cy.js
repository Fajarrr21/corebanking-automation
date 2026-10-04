// Kas Tunai Pusat — detail kantor (/account/center/{officeId}). Read-only.
// TC sumber: docs/test-cases/src/TC_KasTunaiPusat_Detail.json
// Kantor uji = baris pertama daftar /account/center. Form Setoran/Penarikan TIDAK disubmit
// dengan data valid (lihat kas-tunai-pusat.irreversible.cy.js).
import LoginPage from '../../../support/pageobjects/LoginPage';
import KTPPage from '../../../support/pageobjects/KasTunaiPusat/KasTunaiPusatPage';
import DetailPage from '../../../support/pageobjects/KasTunaiPusat/KasTunaiPusatDetailPage';

describe('Kas Tunai Pusat - Detail Kantor', () => {
  let fx;
  let d;

  before(() => {
    cy.fixture('kastunaipusat/kas-tunai-pusat').then((data) => {
      fx = data;
      d = data.detail;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', fx.dataUrl).as('ktpData');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  /** Ambil kantor pertama dari daftar lalu buka detailnya (?menu=). */
  const openDetail = (menu) => {
    KTPPage.openGuarded(fx.path, fx.roleHint);
    cy.wait('@ktpData');
    KTPPage.waitTable('#kasTunai', fx.timeouts.table);
    return KTPPage.firstOffice().then((office) => {
      cy.visit(menu ? `${office.path}?menu=${menu}` : office.path);
      cy.location('pathname').should('eq', office.path);
      return cy.then(() => office);
    });
  };

  it('TC-KTP-DETAIL-001 | Happy | Detail kantor tampil dengan 5 tab dan tab Data Kantor aktif', () => {
    openDetail();
    DetailPage.assertBreadcrumb(d.breadcrumb).assertDocumentTitle(d.title);
    cy.get('ul.nav-pills > li > a').should(($a) => {
      const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
      expect(labels).to.deep.eq(d.tabs.map((t) => t.label));
    });
    DetailPage.elements.tabPane('#tab_data').should('have.class', 'active');
  });

  it('TC-KTP-DETAIL-002 | Positif | Tab Data Kantor menampilkan nama kantor yang sama dengan daftar', () => {
    openDetail().then((office) => {
      cy.get('#tab_data table tbody h3').should(($h) => {
        const labels = Cypress.$.makeArray($h).map((h) => h.innerText.trim());
        expect(labels).to.deep.eq(d.dataRows);
      });
      DetailPage.elements.dataValue('Nama Kantor').should('contain.text', office.name);
    });
  });

  it('TC-KTP-DETAIL-003 | Positif | Tab Setoran memuat Nominal & Keterangan wajib dan tombol Proses', () => {
    openDetail('deposit');
    DetailPage.elements.tabPane('#tab_cashin').should('have.class', 'active');
    DetailPage.elements.depositAmount().should('have.attr', 'required');
    DetailPage.elements.depositNotes().should('have.attr', 'required');
    DetailPage.elements.depositSubmit().should('contain.text', 'Proses');
  });

  it('TC-KTP-DETAIL-004 | Negatif | Setoran tanpa Nominal tidak terkirim (validasi wajib isi)', () => {
    openDetail('deposit');
    DetailPage.elements.depositSubmit().click();
    DetailPage.elements.depositAmount().then(($i) => {
      expect($i[0].checkValidity(), 'Nominal valid?').to.eq(false);
    });
    cy.location('search').should('include', 'menu=deposit');
    cy.blockedWrites().should('have.length', 0);
  });

  it('TC-KTP-DETAIL-005 | Positif | Tab Penarikan menampilkan saldo (read-only), Nominal & Keterangan wajib', () => {
    openDetail('withdraw');
    DetailPage.elements.tabPane('#tab_cashout').should('have.class', 'active');
    DetailPage.elements.withdrawBalance().should('be.disabled');
    DetailPage.elements.withdrawAmount().should('have.attr', 'required');
    DetailPage.elements.withdrawNotes().should('have.attr', 'required');
  });

  it('TC-KTP-DETAIL-006 | Negatif | Penarikan tanpa Keterangan tidak terkirim (validasi wajib isi)', () => {
    openDetail('withdraw');
    DetailPage.elements.withdrawAmount().type('1');
    DetailPage.elements.withdrawNotes().clear();
    DetailPage.elements.withdrawSubmit().click();
    DetailPage.elements.withdrawNotes().then(($t) => {
      expect($t[0].checkValidity(), 'Keterangan valid?').to.eq(false);
    });
    cy.blockedWrites().should('have.length', 0);
  });

  it('TC-KTP-DETAIL-007 | Positif | Tab Riwayat Transaksi memuat tabel riwayat kantor', () => {
    cy.intercept('GET', '/account/center/*/history*').as('ktpHistory');
    openDetail('history');
    cy.wait('@ktpHistory').its('response.statusCode').should('eq', 200);
    DetailPage.waitTable('#data-table-history', fx.timeouts.table).assertHeaders(d.historyHeaders, '#data-table-history');
  });

  it('TC-KTP-DETAIL-008 | Positif | Tab Cetak Buku memuat Saldo terakhir dicetak, Baris, dan tombol Cetak', () => {
    openDetail('printout');
    DetailPage.elements.printLastBalance().should('have.attr', 'required');
    DetailPage.elements.printLine().should('have.attr', 'required');
    DetailPage.elements.printButton().should('be.visible');
  });
});
