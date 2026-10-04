// Website LKM — UNGGAH / PUBLIKASI / HAPUS laporan keuangan (OUTWARD-FACING: tampil di
// situs publik "/"). TC sumber: docs/test-cases/src/TC_WebsiteLKM_Publikasi.json
// Default TIDAK jalan: --env allowPublishReport=true.
// Data uji: judul "QA<timestamp> ..." + PDF fixture kecil. Cleanup afterEach menghapus
// SEMUA baris yang kolom Judul-nya diawali "QA" (column-scoped), juga bila test gagal.
import LoginPage from '../../../support/pageobjects/LoginPage';
import FRPage from '../../../support/pageobjects/WebsiteLKM/FinancialReportPage';
import { describeIfFlag } from '../../../support/utils/flags';

describeIfFlag('allowPublishReport', 'Website LKM - Publikasi laporan (irreversible/outward-facing)', () => {
  let fx;

  before(() => {
    cy.fixture('websitelkm/website-lkm').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
  });

  afterEach(() => {
    // Cleanup: hapus semua laporan milik test (Judul diawali "QA").
    FRPage.openGuarded(fx.path, fx.roleHint);
    FRPage.qaRows().then((rows) => {
      const titles = rows.map((tr) => Cypress.$(tr).find('td').eq(1).text().trim());
      titles.forEach((t) => {
        FRPage.openGuarded(fx.path, fx.roleHint);
        FRPage.deleteRow(t);
        FRPage.assertSuccess(fx.messages.deleted);
      });
    });
  });

  const uploadQa = (publish) =>
    cy.qaName('Laporan Keuangan').then((title) => {
      FRPage.openGuarded(fx.path, fx.roleHint);
      FRPage.upload({ title, year: fx.qaYear, period: fx.qaPeriod, pdfFixture: fx.pdfFixture, publish });
      FRPage.assertSuccess(fx.messages.uploaded);
      return cy.then(() => title);
    });

  it('TC-WEB-PUB-001 | Happy | Unggah laporan QA sebagai Draf tersimpan dan tidak tampil di situs publik', () => {
    uploadQa(false).then((title) => {
      FRPage.rowByTitle(title).should('have.length', 1);
      FRPage.statusOf(title).should('eq', 'Draf');
      FRPage.landingTitles(fx.landing).should('not.include', title);
    });
  });

  it('TC-WEB-PUB-002 | Positif | Publikasikan laporan Draf membuatnya tampil & bisa diunduh di situs publik', () => {
    uploadQa(false).then((title) => {
      FRPage.togglePublish(title);
      FRPage.assertSuccess(fx.messages.toggled);
      FRPage.statusOf(title).should('eq', 'Publik');
      FRPage.landingTitles(fx.landing).should('include', title);
      cy.get(fx.landing.rowSelector)
        .filter((_, r) => Cypress.$(r).find(fx.landing.titleSelector).text().trim() === title)
        .find(fx.landing.downloadSelector)
        .invoke('prop', 'href')
        .then((href) => {
          cy.request({ url: href, encoding: 'binary' }).then((res) => {
            expect(res.status).to.eq(200);
            expect(res.body.slice(0, 5), 'isi PDF').to.eq('%PDF-');
          });
        });
    });
  });

  it('TC-WEB-PUB-003 | Positif | Tarik dari publikasi menghilangkan laporan dari situs publik dan unduhan publik 404', () => {
    uploadQa(true).then((title) => {
      FRPage.statusOf(title).should('eq', 'Publik');
      FRPage.rowByTitle(title).find('a[href*="/lkm/laporan/"]').invoke('prop', 'href').then((dl) => {
        FRPage.togglePublish(title);
        FRPage.assertSuccess(fx.messages.toggled);
        FRPage.statusOf(title).should('eq', 'Draf');
        FRPage.landingTitles(fx.landing).should('not.include', title);
        cy.request({ url: dl, failOnStatusCode: false }).its('status').should('eq', 404);
      });
    });
  });

  it('TC-WEB-PUB-004 | Positif | Hapus laporan QA (konfirmasi OK) menghapus baris dari daftar', () => {
    uploadQa(false).then((title) => {
      FRPage.deleteRow(title);
      FRPage.assertSuccess(fx.messages.deleted);
      FRPage.rowByTitle(title).should('have.length', 0);
    });
  });
});
