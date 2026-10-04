/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_SPK.json
// PRD: "SPK Pinjaman - Preview dan Cetak". Preview = #subtab_sph (partial _sph-body), cetak = GET /printSPH/{ref}
// (HTML yang memanggil window.print + html2pdf saat onload). window.open di-stub, halaman cetak diambil via
// cy.request (script tidak dijalankan) → tidak ada unduhan/print dialog. Read-only + write-guard.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage, { norm, rupiah } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

/** Nomor ketentuan/pasal ("1. Kredit ...", "2. Pokok ...") berurutan dari teks SPK. */
const nomorPasal = (txt) => Array.from(norm(txt).matchAll(/(?:^|\s)(\d{1,2})\.\s+(?=[A-Z])/g)).map((m) => Number(m[1]));

describe('Nasabah - Pinjaman - SPK Preview & Cetak', () => {
  let fx;
  let monthly;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdBulanan, type: 'MONTHLY', dataPath: fx.paths.data, length: fx.data.scanLength, label: 'bulanan',
      }).then((l) => {
        monthly = l;
      });
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const openSpk = (refId) => {
    LoanDetailPage.openDetail(fx.paths.detail, refId, fx.spk.menu);
    LoanDetailPage.elements.sphPane().should('have.class', 'active');
  };

  describe('Preview SPK pinjaman bulanan', () => {
    beforeEach(() => openSpk(monthly.refId));

    it('TC-LOAN-SPK-001 | Happy | Preview SPK tampil utuh dengan judul Surat Pengakuan Kredit', () => {
      LoanDetailPage.elements.subtab(fx.spk.subtabSph).should('be.visible');
      cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).should('be.visible').and('contain.text', fx.spk.judul);
      cy.get(fx.spk.selectMengetahui).should('exist');
      cy.get(fx.spk.selectPengakuan).should('exist');
    });

    it('TC-LOAN-SPK-002 | Negatif | Preview menyediakan tombol Cetak dan Tutup', () => {
      cy.get(fx.spk.pane).within(() => {
        cy.contains('a,button', new RegExp(`^\\s*${fx.spk.btnCetakPrd}\\s*$`, 'i')).should('exist');
        cy.contains('a,button', new RegExp(`^\\s*${fx.spk.btnTutupPrd}\\s*$`, 'i')).should('exist');
      });
    });

    it('TC-LOAN-SPK-003 | Positif | Tombol cetak membuka dokumen SPK untuk pinjaman yang sama', () => {
      LoanDetailPage.stubWindowOpen();
      LoanDetailPage.elements.printBtnIn(fx.spk.pane).click();
      LoanDetailPage.lastOpenedUrl().then((url) => {
        expect(url).to.include(fx.paths.printSph.replace('{refId}', monthly.refId));
        LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($doc) => {
          expect(norm($doc.find('title').text())).to.eq(fx.spk.printTitle);
          expect(norm($doc.find(fx.spk.printTable).text())).to.include(fx.spk.judul);
        });
      });
    });

    it('TC-LOAN-SPK-004 | Positif | Isi hasil cetak sama persis dengan preview (satu template, satu sumber data)', () => {
      LoanDetailPage.stubWindowOpen();
      cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).invoke('text').then((previewTxt) => {
        LoanDetailPage.elements.printBtnIn(fx.spk.pane).click();
        LoanDetailPage.lastOpenedUrl().then((url) => {
          LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($doc) => {
            expect(norm($doc.find(fx.spk.printTable).text())).to.eq(norm(previewTxt));
          });
        });
      });
    });

    it('TC-LOAN-SPK-005 | Positif | Penanda tangan "Yang Mengetahui" yang dipilih tampil di preview dan ikut tercetak', () => {
      cy.get(fx.spk.selectMengetahui).find('option').then(($o) => {
        const opt = Cypress.$.makeArray($o).find((o) => o.value && o.value !== 'ALL');
        expect(opt, 'precondition: ada data penanda tangan (Pengaturan > Tanda Tangan) untuk kantor pinjaman').to.exist;
        cy.get(fx.spk.selectMengetahui).select(opt.value, { force: true }).trigger('change', { force: true });
        cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).should('contain.text', opt.value);
        LoanDetailPage.stubWindowOpen();
        LoanDetailPage.elements.printBtnIn(fx.spk.pane).click();
        LoanDetailPage.lastOpenedUrl().then((url) => {
          expect(decodeURIComponent(url)).to.include(`actknowledge=${opt.value}`);
          LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($doc) => {
            expect(norm($doc.find(fx.spk.printTable).text())).to.include(norm(opt.value));
          });
        });
      });
    });

    it('TC-LOAN-SPK-006 | Positif | Nominal angsuran pada SPK dibulatkan ke atas kelipatan 1.000', () => {
      cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).invoke('text').then((t) => {
        const m = norm(t).match(new RegExp(fx.spk.angsuranRegex, 'i'));
        expect(m, 'kalimat total angsuran per periode').to.not.eq(null);
        const n = rupiah(m[1]);
        expect(n % fx.schedule.kelipatan, `angsuran ${n} kelipatan ${fx.schedule.kelipatan}`).to.eq(0);
      });
    });

    it('TC-LOAN-SPK-007 | Negatif | SPK memuat tabel angsuran (Angsuran Ke, Pokok, Bunga, Simpanan, Total)', () => {
      cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).then(($t) => {
        const heads = Cypress.$.makeArray($t.find('th, td')).map((c) => norm(c.textContent));
        expect(heads, 'kolom Angsuran Ke di SPK').to.include(fx.spk.tabelAngsuranHeaderPrd);
      });
    });

    it('TC-LOAN-SPK-008 | Positif | Penomoran ketentuan SPK bulanan berurutan tanpa lompatan', () => {
      cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).invoke('text').then((t) => {
        const no = nomorPasal(t);
        expect(no.length, 'jumlah ketentuan').to.be.greaterThan(2);
        expect(no).to.deep.eq(Array.from({ length: no.length }, (v, i) => i + 1));
      });
    });

    it('TC-LOAN-SPK-009 | Edge | Cetak ulang berkali-kali menghasilkan isi SPK yang sama', () => {
      const url = fx.paths.printSph.replace('{refId}', monthly.refId);
      LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($a) => {
        const first = norm($a.find(fx.spk.printTable).text());
        LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($b) => {
          expect(norm($b.find(fx.spk.printTable).text())).to.eq(first);
        });
      });
    });
  });

  describe('SPK pinjaman mingguan', () => {
    it('TC-LOAN-SPK-010 | Negatif | SPK mingguan menampilkan seluruh pasal (termasuk pasal 4–7) dengan penomoran berurutan', () => {
      LoginPage.loginViaSession();
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdMingguan, type: 'WEEKLY', dataPath: fx.paths.data, length: fx.data.scanLength, label: 'mingguan',
      }).then((weekly) => {
        openSpk(weekly.refId);
        cy.get(`${fx.spk.pane} ${fx.spk.previewTable}`).invoke('text').then((t) => {
          const no = nomorPasal(t);
          expect(no, 'penomoran berurutan').to.deep.eq(Array.from({ length: no.length }, (v, i) => i + 1));
          expect(no.length, `jumlah pasal SPK mingguan minimal ${fx.spk.pasalMinMingguan}`).to.be.at.least(fx.spk.pasalMinMingguan);
        });
      });
    });
  });
});
