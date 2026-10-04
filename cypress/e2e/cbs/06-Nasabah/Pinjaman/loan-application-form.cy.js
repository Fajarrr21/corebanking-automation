/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Formulir.json
// PRD: "Formulir Permohonan Pinjaman - Cetak". Preview = #tab_application (partial _application-body), cetak =
// GET /loan/print/document/{ref}?head_office=..&account_officer=.. (HTML + window.print/html2pdf saat onload).
// window.open di-stub; halaman cetak diambil via cy.request. Read-only + write-guard.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanDetailPage, { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describe('Nasabah - Pinjaman - Formulir Permohonan (Cetak)', () => {
  let fx;
  let loan;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({
        fixtureRefId: fx.data.refIdBulanan, type: 'MONTHLY', dataPath: fx.paths.data, length: fx.data.scanLength, label: 'bulanan',
      }).then((l) => {
        loan = l;
      });
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
    LoanDetailPage.openDetail(fx.paths.detail, loan.refId, fx.application.menu);
    cy.get(fx.application.pane).should('have.class', 'active');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const paneText = () => cy.get(fx.application.pane).invoke('text').then(norm);
  const bodyTables = ($root) => norm(Cypress.$.makeArray($root).map((t) => t.textContent).join(' '));
  const printBtn = () => cy.contains(`${fx.application.pane} a.print-btn`, fx.application.btnPrint);

  it('TC-LOAN-FORM-001 | Happy | Preview formulir permohonan tampil dengan judul, pilihan penanda tangan, dan tombol cetak', () => {
    paneText().should('include', fx.application.judul);
    fx.application.selects.forEach((s) => cy.get(s).should('exist'));
    printBtn().should('be.visible');
  });

  it('TC-LOAN-FORM-002 | Positif | Tanggal permohonan ditulis beserta jam (pola 24 jam HH.mm)', () => {
    paneText().then((t) => {
      const m = t.match(new RegExp(`${fx.application.tanggalPrefix}\\s*([^]*?\\d{4}[^]{0,20})`));
      expect(m, 'baris Tanggal').to.not.eq(null);
      expect(m[1], 'tanggal memuat jam').to.match(new RegExp(fx.application.jamRegex));
    });
  });

  it('TC-LOAN-FORM-003 | Negatif | Zona waktu cabang penerbit (mis. WIB) ditulis bersama jam permohonan', () => {
    paneText().should('match', new RegExp(fx.application.zonaRegex));
  });

  it('TC-LOAN-FORM-004 | Positif | Blok tanda tangan memuat minimal empat kolom dengan jabatan Kepala Unit, Pengelola III, II, I', () => {
    fx.application.jabatanDefault.forEach((j, i) => {
      const id = i === 0 ? '#app_head_office_occupation' : `#app_account_officer_occupation${i === 1 ? '' : `_${i}`}`;
      cy.get(id).invoke('text').then((t) => expect(norm(t)).to.eq(j));
    });
    cy.get(`${fx.application.pane} [id^="app_"][id*="occupation"]`).should('have.length.at.least', fx.application.jumlahKolomTtdMin);
  });

  it('TC-LOAN-FORM-005 | Negatif | Penanda tangan belum dipilih: sistem memberi peringatan dan batal mencetak bila tidak dilanjutkan', () => {
    const confirmStub = cy.stub().returns(false);
    cy.on('window:confirm', confirmStub);
    LoanDetailPage.stubWindowOpen();
    printBtn().click();
    cy.wrap(confirmStub).should('have.been.called').then(() => {
      expect(String(confirmStub.firstCall.args[0])).to.include(fx.application.confirmPrefix);
    });
    cy.get('@winOpen').should('not.have.been.called');
  });

  it('TC-LOAN-FORM-006 | Positif | Penanda tangan yang dipilih tampil di preview dan ikut tercetak tanpa peringatan', () => {
    cy.get(fx.application.selects[0]).find('option').then(($o) => {
      const opts = Cypress.$.makeArray($o).filter((o) => o.value && o.value !== 'DEFAULT');
      expect(opts.length, 'precondition: ada data penanda tangan untuk kantor pinjaman').to.be.greaterThan(0);
      const nama = opts[0].value;
      fx.application.selects.forEach((s) => cy.get(s).select(nama, { force: true }).trigger('change', { force: true }));
      fx.application.nameIds.forEach((id) => cy.get(`#${id}`).should('contain.text', nama));
      const confirmStub = cy.stub().returns(true);
      cy.on('window:confirm', confirmStub);
      LoanDetailPage.stubWindowOpen();
      printBtn().click();
      LoanDetailPage.lastOpenedUrl().then((url) => {
        expect(confirmStub, 'tidak ada peringatan kolom kosong').not.to.have.been.called;
        expect(url).to.include(fx.paths.printApplication.replace('{refId}', loan.refId));
        expect(decodeURIComponent(url)).to.include(`account_officer=${nama}`);
        LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($doc) => {
          expect(bodyTables($doc.find('body').children('table'))).to.include(norm(nama));
        });
      });
    });
  });

  it('TC-LOAN-FORM-007 | Positif | Isi hasil cetak sama persis dengan preview', () => {
    cy.on('window:confirm', () => true);
    cy.get(`${fx.application.pane} .portlet`).first().children('table').then(($prev) => {
      const preview = bodyTables($prev);
      LoanDetailPage.stubWindowOpen();
      printBtn().click();
      LoanDetailPage.lastOpenedUrl().then((url) => {
        LoanDetailPage.fetchHtml(url, fx.timeout.request).then(($doc) => {
          expect(bodyTables($doc.find('body').children('table'))).to.eq(preview);
        });
      });
    });
  });

  it('TC-LOAN-FORM-008 | Negatif | Formulir memuat nomor permohonan dan nama Officer Pengelola', () => {
    paneText().then((t) => {
      expect(t, 'nomor permohonan').to.match(new RegExp(fx.application.nomorPermohonanRegex, 'i'));
      expect(t, 'Officer Pengelola').to.include(fx.application.officerPengelolaLabel);
    });
  });
});
