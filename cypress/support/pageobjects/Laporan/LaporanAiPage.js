// LaporanAiPage — Laporan > Laporan AI (/report/ai).
//
// Sumber: resources/views/ai-report/index.blade.php, AiReportController (origin/develop).
// - Form #ai-report-form POST /report/ai/generate (prompt required|min:10|max:500,
//   ai_model required|in:<provider:model>). Sukses → redirect /downloads +
//   flash "Laporan sedang diproses...". Job memanggil LAYANAN AI EKSTERNAL
//   (berbiaya) → generate sungguhan HANYA di spec *.irreversible.cy.js (flag allowAiReport).
// - Model: select#ai_model_select (hanya provider dengan API key). Tanpa model:
//   .alert.alert-warning + tombol submit disabled.

import ReportBasePage from './ReportBasePage';

class LaporanAiPage extends ReportBasePage {
  elements = {
    form: () => cy.get('form#ai-report-form'),
    note: () => cy.get('.note.note-info'),
    noteWarning: () => cy.get('.note.note-warning'),
    portletCaption: (text) => cy.contains('.portlet-title .caption-subject', text),
    dataBadges: () => cy.get('.portlet-body .model-badge'),
    modelSelect: () => cy.get('#ai_model_select'),
    modelUsage: () => cy.get('#model-usage-info'),
    prompt: () => cy.get('textarea#prompt'),
    charCount: () => cy.get('#char-count'),
    exampleChips: () => cy.get('#examples-container .example-chip'),
    submit: () => cy.get('#submit-btn'),
    linkDownload: () => cy.get('form#ai-report-form a[href$="/downloads"]'),
  };

  visit(fx) {
    return this.open(fx.path);
  }

  /** Precondition: minimal satu model AI terkonfigurasi (tombol submit aktif). */
  assertModelTersedia(fx) {
    cy.get('body').then(($b) => {
      expect(
        $b.find('#ai_model_select').length,
        `Precondition: butuh minimal 1 model AI terkonfigurasi di staging (halaman menampilkan "${fx.noModelWarning}")`,
      ).to.be.greaterThan(0);
    });
    this.elements.submit().should('not.be.disabled');
    return this;
  }

  /** Isi prompt tanpa mengetik karakter satu per satu (picu event input untuk counter). */
  fillPrompt(text) {
    this.elements.prompt().clear();
    if (text) this.elements.prompt().invoke('val', text).trigger('input');
    return this;
  }

  typePrompt(text) {
    this.elements.prompt().clear().type(text, { delay: 0 });
    return this;
  }

  submit() {
    this.elements.submit().click();
    return this;
  }
}

export default new LaporanAiPage();
