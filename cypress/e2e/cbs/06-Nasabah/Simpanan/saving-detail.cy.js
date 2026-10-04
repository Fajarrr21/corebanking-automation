// Simpanan Nasabah — detail rekening /saving/{refId}: Data Simpanan, Riwayat Transaksi,
// export riwayat, cetak cover & struk (read-only; dokumen diverifikasi via cy.request).
// TC sumber: docs/test-cases/src/TC_Simpanan_Detail.json
import LoginPage from '../../../../support/pageobjects/LoginPage';
import SavingListPage from '../../../../support/pageobjects/Nasabah/SavingListPage';
import SavingDetailPage from '../../../../support/pageobjects/Nasabah/SavingDetailPage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

describe('Nasabah - Simpanan - Detail Simpanan (/saving/{refId})', () => {
  let fx;
  let acc; // rekening bersaldo > 0 (dipastikan punya riwayat transaksi)

  before(() => {
    cy.fixture('nasabah/saving').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    if (!acc) {
      // Precondition: ada rekening simpanan bersaldo > 0 (pasti punya transaksi).
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applySelectFilter('#filter_balance', 'NON_ZERO', fx.timeout);
      SavingListPage.firstRowData(fx.list.col).then((row) => {
        acc = row;
      });
    }
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tab Data Simpanan', () => {
    it('TC-SMP-DETAIL-001 | Happy | Klik Lihat di list membuka detail rekening yang benar', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      // Link Lihat ber-target _blank → hapus target agar tetap di tab yang sama.
      cy.get(`${SavingListPage.table} tbody tr`).first().find('a[href*="/saving/"]')
        .invoke('removeAttr', 'target').click();
      cy.location('pathname').should('match', /^\/saving\/[^/]+$/);
      SavingDetailPage.assertBreadcrumb(fx.breadcrumb.detail);
      SavingDetailPage.elements.pane('tab_data').should('have.class', 'active');
      SavingDetailPage.elements.heroName().should('not.be.empty');
    });

    it('TC-SMP-DETAIL-002 | Positif | Data Simpanan menampilkan nama, saldo, dan kartu informasi rekening', () => {
      SavingDetailPage.visitDetail(acc.refId);
      SavingDetailPage.elements.heroName().should('have.text', acc.name);
      SavingDetailPage.elements.balance().invoke('text').should('match', /IDR/);
      SavingDetailPage.elements.cardHeads().should(($h) => {
        const heads = Cypress.$.makeArray($h).map((el) => norm(el.innerText));
        expect(heads).to.deep.eq(fx.detail.cards);
      });
      SavingDetailPage.elements.card('Informasi Rekening').find('.sdm-key').should(($k) => {
        const keys = Cypress.$.makeArray($k).map((el) => norm(el.innerText));
        expect(keys).to.deep.eq(fx.detail.accountKeys);
      });
    });

    it('TC-SMP-DETAIL-003 | Positif | Cetak Cover Buku Tabungan menghasilkan dokumen cetak (HTTP 200)', () => {
      SavingDetailPage.visitDetail(acc.refId);
      SavingDetailPage.elements.printCover()
        .should('contain.text', fx.detail.printCoverLabel)
        .and('have.attr', 'target', '_blank')
        .invoke('attr', 'href')
        .then((href) => {
          cy.request(href).then((res) => {
            expect(res.status).to.eq(200);
            expect(res.headers['content-type']).to.include('text/html');
            expect(String(res.body).length, 'dokumen cetak tidak kosong').to.be.greaterThan(0);
          });
        });
    });
  });

  describe('Tab Riwayat Transaksi', () => {
    it('TC-SMP-DETAIL-004 | Positif | Riwayat Transaksi menampilkan kolom yang sesuai', () => {
      SavingDetailPage.visitDetail(acc.refId);
      SavingDetailPage.waitHistory(fx.timeout);
      SavingDetailPage.clickTab(fx.detail.tabHistory);
      SavingDetailPage.elements.pane('tab_history').should('have.class', 'active').and('be.visible');
      SavingDetailPage.assertHeaders(fx.detail.historyHeaders, SavingDetailPage.historyTable);
      SavingDetailPage.dataRows(SavingDetailPage.historyTable).should('have.length.greaterThan', 0);
    });

    it('TC-SMP-DETAIL-005 | Positif | Klik tab mengubah parameter menu di URL', () => {
      SavingDetailPage.visitDetail(acc.refId);
      SavingDetailPage.clickTab(fx.detail.tabHistory);
      cy.location('search').should('include', 'menu=history');
      SavingDetailPage.clickTab(fx.detail.tabData);
      cy.location('search').should('include', 'menu=info');
    });

    it('TC-SMP-DETAIL-006 | Positif | Buka URL ?menu=history langsung menampilkan tab Riwayat', () => {
      SavingDetailPage.visitDetail(acc.refId, 'history');
      SavingDetailPage.waitHistory(fx.timeout);
      SavingDetailPage.elements.pane('tab_history').should('have.class', 'active').and('be.visible');
      SavingDetailPage.elements.pane('tab_data').should('not.have.class', 'active');
    });

    it('TC-SMP-DETAIL-007 | Positif | Export riwayat PDF menghasilkan file PDF', () => {
      SavingDetailPage.visitDetail(acc.refId, 'history');
      SavingDetailPage.elements.pdfLink().invoke('attr', 'href').then((href) => {
        cy.request({ url: href, encoding: 'binary' }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.headers['content-type']).to.include(fx.detail.pdfContentType);
        });
      });
    });

    it('TC-SMP-DETAIL-008 | Positif | Export riwayat Excel menghasilkan file xlsx', () => {
      SavingDetailPage.visitDetail(acc.refId, 'history');
      SavingDetailPage.elements.excelLink().invoke('attr', 'href').then((href) => {
        cy.request({ url: href, encoding: 'binary' }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.headers['content-type']).to.include(fx.detail.excelContentType);
        });
      });
    });

    it('TC-SMP-DETAIL-009 | Positif | Tombol Lihat riwayat membuka struk transaksi', () => {
      SavingDetailPage.visitDetail(acc.refId, 'history');
      SavingDetailPage.waitHistory(fx.timeout);
      SavingDetailPage.stubWindowOpen('winOpen');
      SavingDetailPage.elements.historyDetailBtns().first().click();
      cy.get('@winOpen').should('have.been.calledOnce').then((stub) => {
        const url = stub.getCall(0).args[0];
        expect(url).to.match(new RegExp(`^/saving/${acc.refId}/\\d+/print_history$`));
        cy.request(url).its('status').should('eq', 200);
      });
    });
  });

  describe('Negatif', () => {
    it('TC-SMP-DETAIL-010 | Negatif | Nomor referensi rekening tidak ada diarahkan ke list dengan pesan error', () => {
      SavingDetailPage.open(`${fx.paths.detail}${fx.detail.notFoundRef}`);
      cy.location('pathname').should('eq', fx.paths.list);
      SavingDetailPage.assertError(fx.detail.notFoundMsg);
    });
  });
});
