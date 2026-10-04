/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LaporanAiPage from '../../../support/pageobjects/Laporan/LaporanAiPage';
import DownloadPage from '../../../support/pageobjects/Download/DownloadPage';
import { describeIfFlag } from '../../../support/utils/flags';

// Laporan AI — generate SUNGGUHAN.
// TIDAK BISA DIBATALKAN: membuat baris Download (tanpa fitur hapus di UI),
// memakai kuota harian user (20/hari + limit per model), dan job AiReportJob
// memanggil LAYANAN AI EKSTERNAL BERBIAYA. Karena itu di-gate flag:
//   npx cypress run --spec "cypress/e2e/cbs/09-Laporan/laporan-ai.irreversible.cy.js" --env allowAiReport=true
// Tanpa flag → suite di-skip (pending), bukan lulus.
// Data jejak: file "AI-Report-<YmdHis>-<userId>.xlsx" di /downloads dengan
// kolom Prompt berisi prompt QA (diawali "QA") — terhapus otomatis oleh server
// sesuai `deleted_time`.

describeIfFlag('allowAiReport', 'Laporan - Laporan AI (generate sungguhan)', () => {
  let fx;
  let dl;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      fx = d.ai;
    });
    cy.fixture('download/download').then((d) => {
      dl = d;
    });
  });

  beforeEach(() => {
    LoginPage.clearSession();
    LoginPage.loginViaSession();
  });

  it('TC-LAI-GEN-007 | Happy | membuat Laporan AI: masuk antrean dan muncul di halaman Download', () => {
    // Hanya POST generate yang diizinkan; POST lain tetap diblok.
    cy.guardWrites({ allow: [new RegExp(`^${fx.generatePath}$`)] });
    cy.intercept('POST', fx.generatePath).as('generate');
    cy.qaName().then((qa) => {
      const prompt = `${qa} ${fx.promptValid}`;
      LaporanAiPage.visit(fx);
      LaporanAiPage.assertModelTersedia(fx);
      LaporanAiPage.fillPrompt(prompt);
      LaporanAiPage.submit();
      cy.wait('@generate').its('response.statusCode').should('eq', 302);
      cy.location('pathname').should('eq', fx.downloadsPath);
      DownloadPage.assertSuccess(fx.suksesGenerate);
      DownloadPage.allRows(dl).then((rows) => {
        const mine = rows.find((r) => r.prompt.includes(qa));
        expect(mine, 'baris Download untuk prompt QA').to.exist;
        expect(mine.file, 'nama file AI report').to.match(new RegExp(dl.formatNamaFileAi));
        expect(dl.statusSemuaLabel, `status "${mine.status}"`).to.include(mine.status);
      });
    });
    cy.assertNoWritesLeaked();
  });
});
