/// <reference types="cypress" />
// Cek Nasabah (/check) — pencarian nasabah via NIK / No Kartu / Kode CIF / No Rekening.
// Tidak ada PRD (Sumber = Asumsi dari source develop).
// Read-only: POST /check hanya validasi + redirect (di-allow); request tulis lain diblok.
// Data uji diambil dinamis dari GET /cif/data & /saving/data (staging).
// TC sheet: docs/test-cases/src/TC_CekNasabah_Cari.json
import CekNasabahPage from '../../../support/pageobjects/CekNasabah/CekNasabahPage';

describe('Cek Nasabah - Pencarian', () => {
  let fx;

  before(() => {
    cy.fixture('ceknasabah/cek-nasabah').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    CekNasabahPage.openGuarded(fx.urls.checkPostPath);
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  /** CIF pertama yang punya kode (precondition: minimal 1 CIF di staging). */
  const firstCif = (pred = (c) => !!c.code) =>
    CekNasabahPage.fetchCifs(fx.urls.cifData, fx.timeouts.request).then((rows) => {
      const cif = rows.find(pred);
      expect(cif, 'precondition: ada CIF yang memenuhi syarat di 25 CIF pertama (/cif/data)').to.exist;
      return cy.then(() => cif);
    });

  describe('Tampilan halaman', () => {
    it('TC-CEK-CARI-001 | Happy | Halaman Cek Nasabah tampil dengan petunjuk, input, dan tombol', () => {
      CekNasabahPage.assertUrl(fx.urls.check).assertNotRedirectedToLogin().assertBreadcrumb(fx.labels.breadcrumb);
      CekNasabahPage.elements.infoNote().should('contain.text', fx.labels.note);
      CekNasabahPage.elements.keywordInput().should('be.visible').and('have.attr', 'placeholder', fx.labels.placeholder).and('have.value', '');
      CekNasabahPage.elements.helpText().should('contain.text', fx.labels.helpText);
      CekNasabahPage.elements.submitBtn().should('be.visible').and('have.text', fx.labels.button);
      CekNasabahPage.elements.cifName().should('not.exist');
    });
  });

  describe('Pencarian ditemukan', () => {
    it('TC-CEK-CARI-002 | Positif | Cari dengan Kode CIF menampilkan ringkasan nasabah', () => {
      firstCif().then((cif) => {
        CekNasabahPage.search(cif.code);
        cy.location('pathname').should('eq', fx.urls.check);
        cy.location('search').should('include', `data=${encodeURIComponent(cif.code)}`);
        CekNasabahPage.assertSummaryFor(cif);
        fx.labels.metaLabels.forEach((l) => CekNasabahPage.elements.metaValue(l).should('exist'));
      });
    });

    it('TC-CEK-CARI-003 | Positif | Cari dengan NIK menampilkan nasabah pemilik NIK', () => {
      firstCif((c) => !!c.code && !!c.nik).then((cif) => {
        CekNasabahPage.search(cif.nik);
        CekNasabahPage.elements.metaValue('NIK').should(($dd) => {
          expect($dd.text().trim(), 'NIK nasabah').to.eq(String(cif.nik).trim());
        });
        CekNasabahPage.elements.cifName().should('be.visible');
      });
    });

    it('TC-CEK-CARI-004 | Positif | Cari dengan nomor rekening simpanan menampilkan CIF pemilik & menandai baris rekening', () => {
      CekNasabahPage.fetchSavings(fx.urls.savingData, fx.timeouts.request).then((rows) => {
        const acc = rows.find((r) => r.account_number && r.cif && r.cif.code);
        expect(acc, 'precondition: ada rekening simpanan bersaldo dengan nomor rekening (/saving/data)').to.exist;
        CekNasabahPage.search(acc.account_number);
        CekNasabahPage.elements.metaValue('Kode CIF').should(($dd) => {
          expect($dd.text().trim(), 'Kode CIF pemilik rekening').to.eq(String(acc.cif.code).trim());
        });
        CekNasabahPage.elements.matchedRows().should('have.length', 1)
          .find(`button[data-copy="${acc.account_number}"]`).should('exist');
      });
    });

    it('TC-CEK-CARI-005 | Positif | Ringkasan menampilkan tautan Detail CIF serta tabel Simpanan & Pinjaman yang konsisten', () => {
      firstCif().then((cif) => {
        CekNasabahPage.search(cif.code);
        CekNasabahPage.assertSummaryFor(cif);
        CekNasabahPage.elements.openCifDetailBtn(fx.labels.openCifDetail).should(($a) => {
          expect(new URL($a.prop('href')).pathname).to.eq(`${fx.urls.cifDetailPrefix}${cif.code}`);
        });
        CekNasabahPage.assertHeaders(fx.labels.savingHeaders, '#tblSaving');
        CekNasabahPage.assertHeaders(fx.labels.loanHeaders, '#tblLoan');

        [
          { caption: fx.labels.savingCaption, table: '#tblSaving' },
          { caption: fx.labels.loanCaption, table: '#tblLoan' },
        ].forEach(({ caption, table }) => {
          CekNasabahPage.elements.captionHelper(caption).invoke('text').then((helper) => {
            const n = parseInt(helper, 10);
            cy.get(`${table} tbody tr`).should(($rows) => {
              const data = $rows.not(':has(td[colspan])');
              expect(data.length, `${caption}: jumlah baris = "${helper.trim()}"`).to.eq(n);
            });
          });
        });
      });
    });

    it('TC-CEK-CARI-006 | Positif | Tautan langsung /check?data=<Kode CIF> menampilkan ringkasan tanpa submit form', () => {
      firstCif().then((cif) => {
        cy.visit(`${fx.urls.check}?data=${encodeURIComponent(cif.code)}`);
        CekNasabahPage.elements.keywordInput().should('have.value', cif.code);
        CekNasabahPage.assertSummaryFor(cif);
      });
    });

    it('TC-CEK-CARI-007 | Edge | Spasi di awal/akhir kata kunci diabaikan', () => {
      firstCif().then((cif) => {
        CekNasabahPage.search(`  ${cif.code}  `);
        CekNasabahPage.assertSummaryFor(cif);
      });
    });

    it('TC-CEK-CARI-008 | Edge | Akun kantor pusat hanya melihat — tombol Buat Rekening Baru / Ajukan Pinjaman Baru tidak tampil', () => {
      CekNasabahPage.elements.headerUser().should(($u) => {
        expect($u.text(), `precondition: akun test = user pusat (header "${fx.labels.pusatOfficeHeader}") — butuh akun pusat`)
          .to.include(fx.labels.pusatOfficeHeader);
      });
      firstCif().then((cif) => {
        CekNasabahPage.search(cif.code);
        CekNasabahPage.assertSummaryFor(cif);
        cy.contains('a', fx.labels.createSavingButton).should('not.exist');
        cy.contains('a', fx.labels.createLoanButton).should('not.exist');
        cy.get('#cek_open_account').should('not.exist');
      });
    });
  });

  describe('Pencarian tidak valid', () => {
    it('TC-CEK-CARI-009 | Negatif | Kata kunci tidak terdaftar menampilkan pesan data tidak ditemukan', () => {
      const kw = `${fx.testData.notFoundPrefix}${Date.now()}`;
      CekNasabahPage.search(kw);
      CekNasabahPage.elements.notFoundNote().should('be.visible')
        .and('contain.text', `${fx.labels.notFoundPrefix} "${kw}"`);
      CekNasabahPage.elements.cifName().should('not.exist');
    });

    it('TC-CEK-CARI-010 | Negatif | Submit kata kunci kosong ditolak dengan pesan wajib diisi', () => {
      CekNasabahPage.search('');
      CekNasabahPage.assertUrl(fx.urls.check);
      CekNasabahPage.common.validationItems().should('contain.text', fx.messages.required);
      CekNasabahPage.elements.cifName().should('not.exist');
    });

    it('TC-CEK-CARI-011 | Edge | Kata kunci lebih dari 255 karakter ditolak', () => {
      CekNasabahPage.search('9'.repeat(fx.testData.tooLongLength));
      CekNasabahPage.common.validationItems().should('contain.text', fx.messages.max);
      CekNasabahPage.elements.cifName().should('not.exist');
    });
  });
});
