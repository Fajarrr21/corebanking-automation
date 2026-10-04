/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pengaturan_JatuhTempo.json
// READ-ONLY. Simpan perubahan jatuh tempo menggeser due date pinjaman NASABAH NYATA (DueDateChangerJob)
// → TIDAK diotomasi. Retry/Rollback juga tidak pernah dikirim (guardWrites + confirm dijawab Batal).
// Endpoint GET read-only yang dipakai halaman: /setting/checkduedate, /setting/duedate/preview,
// /setting/duedate/{id}/details, /setting/duedate/{id}/export.
import PengaturanPage from '../../../support/pageobjects/Pengaturan/PengaturanPage';

describe('Pengaturan - Jatuh Tempo (read-only)', () => {
  let fx;
  const DD = '/setting/duedate';

  before(() => {
    cy.fixture('pengaturan/pengaturan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    PengaturanPage.ignoreKnownJsErrors(fx.knownJsErrors);
    cy.guardWrites();
    PengaturanPage.openSetting('due_date');
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const historyRows = () => PengaturanPage.allRows(fx.dueDate.historyTable);

  it('TC-SET-JT-001 | Happy | Form perubahan jatuh tempo dan tabel history tampil lengkap', () => {
    PengaturanPage.elements.field(DD, 'type').find('option').then(($o) => {
      const map = {};
      Cypress.$.makeArray($o).forEach((o) => {
        map[o.value] = o.textContent.trim();
      });
      expect(map).to.deep.eq(fx.dueDate.typeOptions);
    });
    PengaturanPage.elements.field(DD, 'day').should('have.attr', 'required');
    PengaturanPage.elements.field(DD, 'product').should('have.attr', 'required');
    PengaturanPage.elements.field(DD, 'tenor').should('not.have.attr', 'required');
    PengaturanPage.elements.field(DD, 'duedates[]').should('have.attr', 'multiple');
    PengaturanPage.assertHeaders(fx.dueDate.historyHeaders, fx.dueDate.historyTable);
  });

  it('TC-SET-JT-002 | Positif | Memilih produk memuat daftar Tanggal Realisasi dari server', () => {
    cy.intercept('GET', `${fx.paths.checkDueDate}*`).as('checkDueDate');
    PengaturanPage.elements.field(DD, 'product').find('option').then(($o) => {
      const opt = Cypress.$.makeArray($o).find((o) => o.value);
      expect(opt, 'precondition: minimal 1 produk pinjaman aktif').to.exist;
      PengaturanPage.elements.field(DD, 'product').select(opt.value);
    });
    cy.wait('@checkDueDate').then(({ request, response }) => {
      expect(request.url).to.match(/product_id=\d+/);
      expect(response.statusCode).to.eq(200);
      const dates = response.body;
      expect(dates).to.be.an('array');
      PengaturanPage.elements.field(DD, 'duedates[]').find('option').should('have.length', dates.length);
      if (dates.length) {
        PengaturanPage.elements.field(DD, 'duedates[]').find('option').first()
          .invoke('text')
          .should('match', new RegExp(fx.dueDate.dateLabelRegex));
      }
    });
  });

  it('TC-SET-JT-003 | Negatif | Simpan tanpa Jumlah Hari dan produk — form tidak terkirim', () => {
    PengaturanPage.elements.field(DD, 'day').clear();
    PengaturanPage.elements.submit(DD).click();
    PengaturanPage.firstInvalidName(DD).should('eq', 'day');
    cy.blockedWrites().should('deep.eq', []);
  });

  it('TC-SET-JT-004 | Positif | Filter Tipe Perubahan hanya menampilkan history bertipe tersebut', () => {
    cy.get('#filterTipe').select(fx.dueDate.filterTipe);
    cy.get(`${fx.dueDate.historyTable} tbody tr`).should(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length
        && Cypress.$(r).find('td').length > 1);
      data.forEach((r) => {
        expect(Cypress.$(r).find('td').eq(2).text().trim()).to.eq(fx.dueDate.filterTipe);
      });
    });
  });

  it('TC-SET-JT-005 | Positif | Tombol Detail membuka modal rincian rekening dari server', () => {
    historyRows().then((rows) => {
      expect(rows.length, 'precondition: minimal 1 history perubahan jatuh tempo').to.be.greaterThan(0);
    });
    cy.intercept('GET', '/setting/duedate/*/details*').as('details');
    cy.get(`${fx.dueDate.historyTable} tbody button[onclick^="showDetail"]`).first().click();
    cy.wait('@details').its('response.statusCode').should('eq', 200);
    cy.get(fx.dueDate.detailModal).should('be.visible').within(() => {
      cy.get('thead th').then(($th) => {
        expect(Cypress.$.makeArray($th).map((t) => t.innerText.trim())).to.deep.eq(fx.dueDate.detailHeaders);
      });
      cy.get('#detailTableBody tr').should('have.length.greaterThan', 0)
        .first()
        .should('not.contain.text', 'Memuat...');
    });
  });

  it('TC-SET-JT-006 | Negatif | Rollback dibatalkan di dialog konfirmasi tidak mengirim request', () => {
    const rb = `${fx.dueDate.historyTable} tbody form[action*="/rollback"] button[type="submit"]`;
    cy.get('body').then(($b) => {
      expect($b.find(rb).length, 'precondition: minimal 1 history berstatus Sukses (punya tombol Rollback)').to.be.greaterThan(0);
    });
    let asked = '';
    cy.on('window:confirm', (txt) => {
      asked = txt;
      return false;
    });
    cy.get(rb).first().click();
    cy.then(() => expect(asked).to.contain('Rollback'));
    cy.blockedWrites().should('deep.eq', []);
    PengaturanPage.assertUrl('/setting');
  });

  it('TC-SET-JT-007 | Positif | Export history menghasilkan berkas Excel', () => {
    cy.get(`${fx.dueDate.historyTable} tbody a[href*="/export"]`).should('have.length.greaterThan', 0)
      .first()
      .invoke('attr', 'href')
      .then((href) => {
        cy.request({ url: href, encoding: 'binary' }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.headers['content-type']).to.include(fx.dueDate.xlsxContentType);
        });
      });
  });
});
