// Simpanan Nasabah — tab Formulir Permohonan di detail simpanan + cetak dokumen (read-only).
// Cetak membuka tab baru via window.open → di-stub, URL-nya diverifikasi dengan cy.request.
// TC sumber: docs/test-cases/src/TC_Simpanan_Formulir.json
import LoginPage from '../../../../support/pageobjects/LoginPage';
import SavingListPage from '../../../../support/pageobjects/Nasabah/SavingListPage';
import SavingDetailPage from '../../../../support/pageobjects/Nasabah/SavingDetailPage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

describe('Nasabah - Simpanan - Formulir Permohonan Simpanan', () => {
  let fx;
  let acc;

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
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.firstRowData(fx.list.col).then((row) => {
        acc = row;
      });
    }
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  it('TC-SMP-FORM-001 | Happy | Detail simpanan memiliki tab Formulir Permohonan yang dapat dibuka', () => {
    SavingDetailPage.visitDetail(acc.refId);
    SavingDetailPage.tabLabels().should('include', fx.detail.tabApplication);
    SavingDetailPage.clickTab(fx.detail.tabApplication);
    SavingDetailPage.elements.applicationPane().should('have.class', 'active').and('be.visible');
    cy.location('search').should('include', 'menu=application');
  });

  it('TC-SMP-FORM-002 | Positif | Formulir menampilkan judul, Tanggal Permohonan, dan No Berkas', () => {
    SavingDetailPage.visitDetail(acc.refId, 'application');
    SavingDetailPage.elements.applicationPane().should('be.visible').and(($p) => {
      const text = norm($p.text());
      expect(text).to.include(fx.application.title);
      fx.application.headLabels.forEach((l) => expect(text, l).to.include(l));
    });
  });

  it('TC-SMP-FORM-003 | Positif | Formulir menampilkan Data Nasabah, Data Pekerjaan, Fasilitas, dan Pernyataan', () => {
    SavingDetailPage.visitDetail(acc.refId, 'application');
    SavingDetailPage.elements.applicationPane().should(($p) => {
      const text = norm($p.text());
      [...fx.application.customerLabels, ...fx.application.jobLabels, ...fx.application.facilityLabels]
        .forEach((l) => expect(text, `label "${l}"`).to.include(l));
      expect(text).to.include(fx.application.statement);
      expect(text, 'nama nasabah rekening').to.include(acc.name);
    });
  });

  it('TC-SMP-FORM-004 | Positif | Pilih Kepala Unit dan Pengelola II tampil di preview formulir', () => {
    SavingDetailPage.visitDetail(acc.refId, 'application');
    SavingDetailPage.selectFirstSigner(fx.application.headOfficeSelect).then((head) => {
      SavingDetailPage.elements.headOfficePreview().should(($e) => expect(norm($e.text())).to.eq(head));
    });
    SavingDetailPage.selectFirstSigner(fx.application.accountOfficerSelect).then((ao) => {
      SavingDetailPage.elements.accountOfficerPreview().should(($e) => expect(norm($e.text())).to.eq(ao));
    });
  });

  it('TC-SMP-FORM-005 | Positif | Cetak formulir memuat penanda tangan yang dipilih', () => {
    SavingDetailPage.visitDetail(acc.refId, 'application');
    SavingDetailPage.selectFirstSigner(fx.application.headOfficeSelect).then((head) => {
      SavingDetailPage.selectFirstSigner(fx.application.accountOfficerSelect).then((ao) => {
        SavingDetailPage.stubWindowOpen('winOpen');
        SavingDetailPage.elements.printApplicationBtn().should('contain.text', fx.application.printLabel).click();
        cy.get('@winOpen').should('have.been.calledOnce').then((stub) => {
          const url = stub.getCall(0).args[0];
          expect(url).to.include(`${fx.paths.printDocument}${acc.refId}`);
          cy.request(url).then((res) => {
            expect(res.status).to.eq(200);
            const body = String(res.body);
            expect(body).to.include(fx.application.title);
            expect(body, 'nama Kepala Unit tercetak').to.include(head);
            expect(body, 'nama Pengelola II tercetak').to.include(ao);
          });
        });
      });
    });
  });

  it('TC-SMP-FORM-006 | Edge | Cetak tanpa memilih penanda tangan tidak mencetak kata DEFAULT', () => {
    SavingDetailPage.visitDetail(acc.refId, 'application');
    SavingDetailPage.stubWindowOpen('winOpen');
    SavingDetailPage.elements.printApplicationBtn().click();
    cy.get('@winOpen').should('have.been.calledOnce').then((stub) => {
      cy.request(stub.getCall(0).args[0]).then((res) => {
        expect(res.status).to.eq(200);
        const signerBlocks = Cypress.$(`<div>${res.body}</div>`)
          .find('#head_office, #head_office_occupation, #account_officer, #account_officer_occupation')
          .map((i, el) => norm(el.textContent))
          .get();
        expect(signerBlocks.length, 'blok penanda tangan ada').to.be.greaterThan(0);
        signerBlocks.forEach((t) => expect(t).not.to.eq(fx.application.defaultWord));
      });
    });
  });
});
