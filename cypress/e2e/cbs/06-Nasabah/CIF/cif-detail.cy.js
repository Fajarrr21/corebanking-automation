// CIF Nasabah — detail /cif/{code} (read-only).
// TC sumber: docs/test-cases/src/TC_CIF_Detail.json
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifDetailPage from '../../../../support/pageobjects/Nasabah/CifDetailPage';
import CustomerPage from '../../../../support/pageobjects/Nasabah/CustomerPage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

describe('Nasabah - CIF - Detail CIF (/cif/{code})', () => {
  let fx;
  let cif; // baris pertama list CIF (precondition: staging punya data CIF)

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    if (!cif) {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.firstRowData(fx.list.col).then((row) => {
        cif = row;
      });
    }
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Navigasi & tab', () => {
    it('TC-CIF-DETAIL-001 | Happy | Klik Lihat di list membuka detail CIF yang benar', () => {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      cy.get(`${CifListPage.table} tbody tr`).first().find('a').contains(fx.list.viewLabel).click();
      cy.location('pathname').should('eq', `${fx.paths.detail}${cif.code}`);
      CifDetailPage.assertBreadcrumb(fx.breadcrumb.detail);
      CifDetailPage.elements.codeText().should('have.text', cif.code);
    });

    it('TC-CIF-DETAIL-002 | Positif | Halaman detail memiliki tab Data CIF, Simpanan, dan Pinjaman', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.elements.tabLinks().should(($a) => {
        const labels = Cypress.$.makeArray($a).map((a) => norm(a.innerText));
        expect(labels).to.deep.eq(fx.detail.tabs);
      });
      CifDetailPage.elements.dataPane().should('have.class', 'active');
    });
  });

  describe('Tab Data CIF', () => {
    it('TC-CIF-DETAIL-003 | Positif | Data CIF menampilkan field identitas sesuai list', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.fieldLabels().then((labels) => {
        fx.detail.formLabels.forEach((l) => expect(labels, `label "${l}"`).to.include(l));
      });
      CifDetailPage.fieldValue('NIK').should('eq', cif.nik);
      CifDetailPage.fieldValue('Nama Lengkap').should('eq', cif.name);
    });

    it('TC-CIF-DETAIL-004 | Positif | Detail menampilkan field Jenis Nasabah dan Cabang sesuai PRD', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.fieldLabels().then((labels) => {
        fx.detail.prdExtraLabels.forEach((l) => expect(labels, `label PRD "${l}" di detail CIF`).to.include(l));
      });
    });

    it('TC-CIF-DETAIL-005 | Positif | Seluruh field pada tab Data CIF read-only', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.elements.fieldGroups().find('input').should(($i) => {
        expect($i.length).to.be.greaterThan(0);
        Cypress.$.makeArray($i).forEach((el) => {
          expect(el.readOnly || el.disabled, `input "${el.name}" read-only/disabled`).to.eq(true);
        });
      });
    });

    it('TC-CIF-DETAIL-006 | Positif | Tombol Download Cif membuka dokumen CIF (HTTP 200)', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.elements.downloadBtn()
        .should('contain.text', fx.detail.downloadLabel)
        .and('have.attr', 'href')
        .then((href) => {
          cy.request(href).then((res) => {
            expect(res.status).to.eq(200);
            expect(res.body).to.include(cif.code);
            expect(res.body).to.include(cif.nik);
          });
        });
    });

    it('TC-CIF-DETAIL-007 | Positif | Tombol Edit Cif tampil untuk role yang berhak mengubah', () => {
      CifDetailPage.visitDetail(cif.code);
      CustomerPage.isSuperAdmin().then((sa) => {
        if (sa) {
          throw new Error(
            'Precondition tidak terpenuhi: akun test super-admin — source (cif/cif.blade.php) menyembunyikan "Edit Cif" untuk super-admin/auditor. Butuh akun customer-service/supervisor.',
          );
        }
      });
      CifDetailPage.elements.editBtn()
        .should('contain.text', fx.detail.editLabel)
        .and('have.attr', 'href')
        .and('match', new RegExp(`${fx.paths.edit}${cif.code}$`));
    });
  });

  describe('Tab Simpanan & Pinjaman', () => {
    it('TC-CIF-DETAIL-008 | Positif | Tab Simpanan menampilkan daftar rekening atau pesan kosong', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.clickTab('Simpanan');
      CifDetailPage.elements.savingPane().should('have.class', 'active').and('be.visible')
        .and('contain.text', fx.detail.savingHeading);
      CifDetailPage.elements.savingPane().should(($p) => {
        const items = $p.find('.todo-tasklist-item').length;
        const empty = $p.text().includes(fx.detail.savingEmpty);
        expect(items > 0 || empty, 'ada item rekening ATAU pesan "Tidak ada Rekening Simpanan"').to.eq(true);
      });
    });

    it('TC-CIF-DETAIL-009 | Positif | Tab Pinjaman dapat dibuka', () => {
      CifDetailPage.visitDetail(cif.code);
      CifDetailPage.clickTab('Pinjaman');
      CifDetailPage.elements.loanPane().should('have.class', 'active').and('be.visible');
      CifDetailPage.elements.dataPane().should('not.have.class', 'active');
    });
  });

  describe('Negatif', () => {
    it('TC-CIF-DETAIL-010 | Negatif | Kode CIF tidak terdaftar diarahkan ke list dengan pesan error', () => {
      CifDetailPage.visitDetail(fx.detail.notFoundCode);
      cy.location('pathname').should('eq', fx.paths.list);
      CifDetailPage.assertError(fx.detail.notFoundMsg);
    });
  });
});
