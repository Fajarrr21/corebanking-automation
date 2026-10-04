/// <reference types="cypress" />
import LoginPage from '../../../support/pageobjects/LoginPage';
import LaporanAiPage from '../../../support/pageobjects/Laporan/LaporanAiPage';

// Laporan AI (/report/ai) — TIDAK ada PRD (Sumber = Asumsi dari source).
// Spec ini TIDAK pernah membuat laporan sungguhan (yang memanggil layanan AI
// eksternal berbiaya) — itu ada di laporan-ai.irreversible.cy.js (flag allowAiReport).
//
// Write-guard: semua POST diblok, KECUALI TC-LAI-GEN-006 yang sengaja meneruskan
// POST /report/ai/generate dengan prompt 3 karakter: server memvalidasi
// `prompt min:10` SEBELUM membuat baris Download / memanggil AI, jadi request
// pasti ditolak (redirect back + error validasi) tanpa efek samping.

describe('Laporan - Laporan AI', () => {
  let all;
  let fx;

  before(() => {
    cy.fixture('laporan/laporan').then((d) => {
      all = d;
      fx = d.ai;
    });
  });

  beforeEach(() => {
    LoginPage.clearSession();
    LoginPage.loginViaSession();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Tampilan', () => {
    beforeEach(() => cy.guardWrites());

    it('TC-LAI-GEN-001 | Happy | membuka Laporan AI lewat menu Laporan > Laporan AI', () => {
      cy.visit('/home');
      LaporanAiPage.openViaSidebar(all.menu.parent, fx.path);
      LaporanAiPage.assertBreadcrumb(fx.breadcrumb);
      LaporanAiPage.elements.form().should('be.visible');
    });

    it('TC-LAI-GEN-002 | Positif | elemen halaman: info, data yang dapat diakses, model AI, prompt, contoh, tombol', () => {
      LaporanAiPage.visit(fx);
      LaporanAiPage.elements.note().should('contain.text', fx.noteTitle);
      LaporanAiPage.elements.portletCaption(fx.portletData).should('be.visible');
      LaporanAiPage.elements.portletCaption(fx.portletBuat).should('be.visible');
      LaporanAiPage.elements.dataBadges().should('have.length.greaterThan', 0);
      cy.get('body').then(($b) => {
        if ($b.find('#ai_model_select').length) {
          cy.contains('label', fx.labelModel).should('be.visible');
          LaporanAiPage.elements.modelUsage().should('exist');
        } else {
          cy.get('.alert.alert-warning').should('contain.text', fx.noModelWarning);
          LaporanAiPage.elements.submit().should('be.disabled');
        }
      });
      LaporanAiPage.elements
        .prompt()
        .should('have.attr', 'placeholder', fx.promptPlaceholder)
        .and('have.attr', 'maxlength', String(fx.promptMaxLength))
        .and('have.attr', 'required');
      LaporanAiPage.elements.charCount().should('have.text', fx.charCountAwal);
      LaporanAiPage.elements.exampleChips().should('have.length', fx.jumlahContoh);
      LaporanAiPage.elements.submit().should('contain.text', fx.submitLabel);
      LaporanAiPage.elements.linkDownload().should('contain.text', fx.linkDownloadLabel);
      LaporanAiPage.elements.noteWarning().should('contain.text', fx.limitNote);
    });

    it('TC-LAI-GEN-003 | Positif | klik chip contoh mengisi prompt dan memperbarui penghitung karakter', () => {
      LaporanAiPage.visit(fx);
      LaporanAiPage.elements.exampleChips().first().should('have.text', fx.contohPertama).click();
      LaporanAiPage.elements.prompt().should('have.value', fx.contohPertama);
      LaporanAiPage.elements.charCount().should('have.text', `${fx.contohPertama.length} / ${fx.promptMaxLength} karakter`);
    });

    it('TC-LAI-GEN-004 | Edge | prompt lebih dari 500 karakter terpotong menjadi 500 (maxlength)', () => {
      const panjang = 'a'.repeat(fx.promptMaxLength + 20);
      LaporanAiPage.visit(fx);
      LaporanAiPage.typePrompt(panjang);
      LaporanAiPage.elements.prompt().invoke('val').its('length').should('eq', fx.promptMaxLength);
      LaporanAiPage.elements.charCount().should('have.text', `${fx.promptMaxLength} / ${fx.promptMaxLength} karakter`);
    });

    it('TC-LAI-GEN-005 | Negatif | submit dengan prompt kosong dicegah validasi browser (tidak ada request)', () => {
      LaporanAiPage.visit(fx);
      LaporanAiPage.assertModelTersedia(fx);
      LaporanAiPage.fillPrompt('');
      LaporanAiPage.submit();
      LaporanAiPage.elements.prompt().then(($t) => {
        expect($t[0].checkValidity(), 'textarea kosong tidak valid (required)').to.eq(false);
      });
      cy.location('pathname').should('eq', fx.path);
      cy.blockedWrites().should('deep.eq', []);
    });
  });

  describe('Validasi server', () => {
    beforeEach(() => cy.guardWrites({ allow: [new RegExp(`^${fx.generatePath}$`)] }));

    it('TC-LAI-GEN-006 | Negatif | prompt kurang dari 10 karakter ditolak server dengan pesan validasi', () => {
      cy.intercept('POST', fx.generatePath).as('generate');
      LaporanAiPage.visit(fx);
      LaporanAiPage.assertModelTersedia(fx);
      LaporanAiPage.fillPrompt(fx.promptTerlaluPendek);
      LaporanAiPage.submit();
      cy.wait('@generate').its('response.statusCode').should('eq', 302);
      cy.location('pathname').should('eq', fx.path);
      LaporanAiPage.common.validationItems().should('have.length.at.least', 1).first().invoke('text').then((t) => {
        expect(t.toLowerCase(), 'pesan validasi menyebut prompt').to.include(fx.pesanMinPrompt);
      });
    });
  });
});
