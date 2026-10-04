// Agunan — dokumen agunan di detail pinjaman (/loan/{refId}?menu=collateral). Read-only.
// TC sumber: docs/test-cases/src/TC_Agunan_Dokumen.json
// PRD: "BKD - Agunan Pinjaman" (tab Dokumen/Surat Kuasa Menjual/Surat Penyerahan/Tanda
// Terima + cetak) dan "BKD - Data Agunan" (detail dari list agunan).
// Cetak: window.open di-stub; URL cetak diverifikasi via cy.request (GET).
import LoginPage from '../../../support/pageobjects/LoginPage';
import ListPage from '../../../support/pageobjects/Agunan/CollateralListPage';
import TabPage from '../../../support/pageobjects/Agunan/LoanCollateralTabPage';

describe('Agunan - Dokumen Agunan Pinjaman', () => {
  let fx;
  let D;

  before(() => {
    cy.fixture('agunan/agunan').then((d) => {
      fx = d;
      D = d.detail;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    cy.intercept('GET', fx.dataUrl).as('colData');
    TabPage.stubWindowOpen();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  /** Ambil href "Lihat" baris pertama daftar agunan lalu buka (tanpa tab baru). */
  const openFirstCollateral = (tab) => {
    ListPage.open(fx.path);
    cy.wait('@colData');
    ListPage.waitTable(fx.table, fx.timeouts.table);
    return ListPage.dataRowEls(fx.table).then((rows) => {
      if (!rows.length) {
        throw new Error('Precondition: belum ada data agunan di /collateral — butuh minimal 1 pinjaman beragunan');
      }
      const href = Cypress.$(rows[0]).find('td').eq(fx.col.aksi).find('a').attr('href');
      const u = new URL(href);
      if (tab) u.searchParams.set('tab', tab);
      cy.visit(u.pathname + u.search);
      TabPage.elements.collateralPane().should('have.class', 'active');
      return cy.then(() => ({ refId: u.pathname.split('/').pop() }));
    });
  };

  /** Klik Print pada pane, assert window.open dipanggil dengan URL cetak & URL tsb 200. */
  const assertPrint = (hash, view, refId, expectParams = {}) => {
    TabPage.elements.printButton(hash).click();
    cy.get('@winOpen').should('have.been.called');
    cy.get('@winOpen').then((stub) => {
      const url = stub.lastCall.args[0];
      const u = new URL(url, Cypress.config('baseUrl'));
      expect(u.pathname).to.eq(`/loan/${refId}${D.printPath}`);
      expect(u.searchParams.get('view')).to.eq(view);
      Object.entries(expectParams).forEach(([k, v]) => expect(u.searchParams.get(k), `param ${k}`).to.eq(v));
      cy.request(u.pathname + u.search).its('status').should('eq', 200);
    });
  };

  it('TC-AGN-DOK-001 | Happy | Lihat dari daftar membuka tab Agunan dengan 4 sub-tab dokumen', () => {
    openFirstCollateral();
    TabPage.elements.subTabLinks().should(($a) => {
      const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
      expect(labels).to.deep.eq(D.tabs.map((t) => t.label));
    });
    TabPage.elements.subPane('#tab_document').should('have.class', 'active');
  });

  it('TC-AGN-DOK-002 | Positif | Tab Dokumen menampilkan informasi & penilaian agunan', () => {
    openFirstCollateral('document');
    TabPage.elements.subPane('#tab_document').should(($p) => {
      const text = $p.text().replace(/\s+/g, ' ');
      D.documentLabels.forEach((l) => expect(text, `label "${l}"`).to.include(l));
    });
  });

  it('TC-AGN-DOK-003 | Positif | Cetak Dokumen membuka URL cetak print-detail yang dapat diakses', () => {
    openFirstCollateral('document').then(({ refId }) => assertPrint('#tab_document', D.tabs[0].view, refId));
  });

  it('TC-AGN-DOK-004 | Positif | Surat Kuasa Menjual: Pihak II terpilih ikut ke URL cetak', () => {
    const t = D.tabs[1];
    openFirstCollateral('sell_document').then(({ refId }) => {
      cy.get(`${t.select} option`).first().should('have.text', D.selectPlaceholders.sell);
      TabPage.pickFirstOption(t.select).then((v) => {
        if (!v) throw new Error('Precondition: belum ada data penanda tangan (signature) untuk Pihak II');
        assertPrint(t.hash, t.view, refId, { [t.param]: v });
      });
    });
  });

  it('TC-AGN-DOK-005 | Positif | Surat Penyerahan: Pihak II terpilih ikut ke URL cetak', () => {
    const t = D.tabs[2];
    openFirstCollateral('submission_document').then(({ refId }) => {
      cy.get(`${t.select} option`).first().should('have.text', D.selectPlaceholders.submission);
      TabPage.pickFirstOption(t.select).then((v) => {
        if (!v) throw new Error('Precondition: belum ada data penanda tangan (signature) untuk Pihak II');
        assertPrint(t.hash, t.view, refId, { [t.param]: v });
      });
    });
  });

  it('TC-AGN-DOK-006 | Positif | Tanda Terima: Kepala Unit & Pengelola terpilih ikut ke URL cetak', () => {
    const t = D.tabs[3];
    openFirstCollateral('receipt_document').then(({ refId }) => {
      cy.get(`${t.select} option`).first().should('have.text', D.selectPlaceholders.head);
      cy.get(`${t.select2} option`).first().should('have.text', D.selectPlaceholders.officer);
      TabPage.pickFirstOption(t.select).then((head) => {
        TabPage.pickFirstOption(t.select2).then((officer) => {
          if (!head || !officer) throw new Error('Precondition: belum ada data penanda tangan (signature)');
          assertPrint(t.hash, t.view, refId, { [t.param]: head, [t.param2]: officer });
        });
      });
    });
  });

  it('TC-AGN-DOK-007 | Edge | Tanda Terima tetap membawa Kepala Unit & Pengelola walau Pihak II Surat Penyerahan sudah dipilih', () => {
    const sub = D.tabs[2];
    const rec = D.tabs[3];
    openFirstCollateral('submission_document').then(({ refId }) => {
      TabPage.pickFirstOption(sub.select).then((party) => {
        if (!party) throw new Error('Precondition: belum ada data penanda tangan (signature)');
        TabPage.elements.subTabLink(rec.hash).click();
        TabPage.elements.subPane(rec.hash).should('have.class', 'active');
        TabPage.pickFirstOption(rec.select).then((head) => {
          TabPage.pickFirstOption(rec.select2).then((officer) => {
            assertPrint(rec.hash, rec.view, refId, { [rec.param]: head, [rec.param2]: officer });
          });
        });
      });
    });
  });

  it('TC-AGN-DOK-008 | Positif | Detail agunan memiliki tab Data Agunan (form data agunan)', () => {
    openFirstCollateral();
    TabPage.elements.subTabLinks().should(($a) => {
      const labels = Cypress.$.makeArray($a).map((a) => a.innerText.replace(/\s+/g, ' ').trim());
      expect(labels, 'sub-tab detail agunan').to.include(D.prdDataTab);
    });
  });
});
