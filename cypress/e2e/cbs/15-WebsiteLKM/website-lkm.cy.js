// Website LKM — Publikasi Laporan Keuangan (/financial-report). Read-only.
// TC sumber: docs/test-cases/src/TC_WebsiteLKM_List.json
// Tidak ada PRD di Notion (Sumber = Asumsi, dari source + catatan POJK di view).
import LoginPage from '../../../support/pageobjects/LoginPage';
import FRPage from '../../../support/pageobjects/WebsiteLKM/FinancialReportPage';

describe('Website LKM - Publikasi Laporan Keuangan (/financial-report)', () => {
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
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-WEB-LIST-001 | Happy | Menu Website LKM membuka halaman Publikasi Laporan Keuangan', () => {
    FRPage.open(fx.home);
    FRPage.assertSidebarMenuVisible(fx.menuTitle, fx.roleHint);
    FRPage.sidebar.menuTitle(fx.menuTitle).click();
    cy.location('pathname').should('eq', fx.path);
    FRPage.assertBreadcrumb(fx.breadcrumb).assertDocumentTitle(fx.title);
  });

  it('TC-WEB-LIST-002 | Positif | Form unggah tampil dengan nilai default dan batasan PDF', () => {
    FRPage.openGuarded(fx.path, fx.roleHint);
    FRPage.elements.note().should('contain.text', fx.noteText);
    FRPage.elements.landingLink().should('have.attr', 'target', '_blank');
    FRPage.elements.title().should('have.attr', 'required');
    FRPage.elements.title().should('have.attr', 'placeholder', fx.form.titlePlaceholder);
    FRPage.elements.year().should('have.value', String(new Date().getFullYear()));
    FRPage.elements.year().should('have.attr', 'min', '1900').and('have.attr', 'max', '2999');
    FRPage.elements.period().should('not.have.attr', 'required');
    FRPage.elements.file().should('have.attr', 'accept', fx.form.accept).and('have.attr', 'required');
    FRPage.elements.publish().should('be.checked');
    FRPage.elements.form().should('contain.text', fx.form.publishLabel);
    FRPage.elements.submit().should('contain.text', fx.form.submitLabel);
  });

  it('TC-WEB-LIST-003 | Positif | Daftar laporan menampilkan kolom dan status Publik/Draf (atau pesan kosong)', () => {
    FRPage.openGuarded(fx.path, fx.roleHint);
    FRPage.elements.table().find('thead th').should(($th) => {
      expect(Cypress.$.makeArray($th).map((t) => t.innerText.trim())).to.deep.eq(fx.headers);
    });
    FRPage.elements.rows().then(($rows) => {
      const empty = $rows.length === 1 && $rows.find('td[colspan]').length === 1;
      if (empty) {
        cy.wrap($rows).should('contain.text', fx.emptyText);
        return;
      }
      Cypress.$.makeArray($rows).forEach((tr) => {
        const $tr = Cypress.$(tr);
        expect(fx.statusLabels, 'status').to.include($tr.find('td').eq(3).text().trim());
        expect($tr.find('a[href*="/lkm/laporan/"]').length, 'tombol Unduh').to.eq(1);
        expect($tr.find('form[action*="/publish"]').length, 'tombol publikasi').to.eq(1);
        expect($tr.find('form[action*="/delete"]').length, 'tombol hapus').to.eq(1);
      });
    });
  });

  it('TC-WEB-LIST-004 | Positif | Hanya laporan berstatus Publik yang tampil di halaman publik', () => {
    FRPage.openGuarded(fx.path, fx.roleHint);
    FRPage.elements.rows().then(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((tr) => !Cypress.$(tr).find('td[colspan]').length);
      const pub = data.filter((tr) => Cypress.$(tr).find('td').eq(3).text().trim() === 'Publik')
        .map((tr) => Cypress.$(tr).find('td').eq(1).text().trim());
      const draft = data.filter((tr) => Cypress.$(tr).find('td').eq(3).text().trim() === 'Draf')
        .map((tr) => Cypress.$(tr).find('td').eq(1).text().trim());
      FRPage.landingTitles(fx.landing).then((titles) => {
        expect(titles.length, 'jumlah laporan publik').to.eq(pub.length);
        pub.forEach((t) => expect(titles, `laporan publik "${t}"`).to.include(t));
        draft.filter((t) => !pub.includes(t)).forEach((t) => expect(titles, `draf "${t}"`).to.not.include(t));
      });
    });
  });

  it('TC-WEB-LIST-005 | Negatif | Unggah tanpa Judul Laporan diblok validasi wajib isi', () => {
    FRPage.openGuarded(fx.path, fx.roleHint);
    FRPage.elements.file().selectFile(`cypress/fixtures/${fx.pdfFixture}`);
    FRPage.elements.submit().click();
    FRPage.elements.title().then(($i) => expect($i[0].checkValidity(), 'Judul valid?').to.eq(false));
    cy.location('pathname').should('eq', fx.path);
  });

  it('TC-WEB-LIST-006 | Negatif | Tahun Buku di luar rentang 1900-2999 diblok validasi', () => {
    FRPage.openGuarded(fx.path, fx.roleHint);
    cy.qaName('LAPORAN').then((t) => FRPage.elements.title().type(t));
    FRPage.elements.year().clear().type(fx.form.yearOutOfRange);
    FRPage.elements.file().selectFile(`cypress/fixtures/${fx.pdfFixture}`);
    FRPage.elements.submit().click();
    FRPage.elements.year().then(($i) => expect($i[0].validity.rangeUnderflow, 'tahun < min').to.eq(true));
  });

  it('TC-WEB-LIST-007 | Negatif | Berkas bukan PDF ditolak server dengan pesan format PDF', () => {
    // POST /financial-report diizinkan: $request->validate (mimes:pdf) menolak SEBELUM
    // upload S3 & FinancialReport::create -> tidak ada data tercipta.
    cy.guardWrites({ allow: [/^\/financial-report$/] });
    FRPage.openGuarded(fx.path, fx.roleHint);
    cy.qaName('LAPORAN-TXT').then((t) => FRPage.elements.title().type(t));
    FRPage.elements.file().selectFile(
      { contents: Cypress.Buffer.from(fx.wrongFile.content), fileName: fx.wrongFile.name, mimeType: fx.wrongFile.mime },
      { force: true },
    );
    FRPage.elements.publish().uncheck({ force: true });
    FRPage.elements.submit().click();
    cy.location('pathname').should('eq', fx.path);
    FRPage.common.validationItems().should('contain.text', fx.messages.notPdf);
    FRPage.qaRows().should('have.length', 0);
  });

  it('TC-WEB-LIST-008 | Edge | Membatalkan konfirmasi Hapus tidak menghapus laporan', () => {
    FRPage.openGuarded(fx.path, fx.roleHint);
    FRPage.elements.rows().then(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((tr) => !Cypress.$(tr).find('td[colspan]').length);
      if (!data.length) {
        cy.log('Belum ada laporan — tombol Hapus tidak tersedia');
        cy.wrap($rows).should('contain.text', fx.emptyText);
        return;
      }
      const confirmStub = cy.stub().returns(false).as('confirm');
      cy.on('window:confirm', confirmStub);
      const count = data.length;
      cy.wrap(data[0]).find('form[action*="/delete"] button[type="submit"]').click();
      cy.get('@confirm').should('have.been.calledOnce');
      cy.blockedWrites().should('have.length', 0);
      FRPage.elements.rows().should('have.length', count);
    });
  });

  it('TC-WEB-LIST-009 | Negatif | Akun tanpa role super-admin/supervisor membuka /financial-report dialihkan ke /home', () => {
    FRPage.assertDirectUrlDenied(fx.path, { home: fx.home, message: fx.deniedMessage, roleHint: fx.roleHintDenied });
  });
});
