/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Produk_Create.json
// Spec ini TIDAK membuat produk. Test validasi server (008-010) benar-benar mengirim POST /product/loan,
// tetapi memakai NAMA dan KODE produk yang SUDAH ADA sehingga pasti ditolak rule `unique`
// (CreateProductLoanRequest) — tidak ada data tercipta. Happy-path tambah produk ada di
// produk-lifecycle.irreversible.cy.js (flag allowProdukCreate).
import ProdukPinjamanPage from '../../../support/pageobjects/Produk/ProdukPinjamanPage';

describe('Produk Pinjaman - Tambah Produk', () => {
  let fx;
  const createForm = 'form[action$="/product/loan"]';

  before(() => {
    cy.fixture('produk/produk').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Tampilan & validasi sisi klien (tanpa request tulis)', () => {
    beforeEach(() => {
      cy.guardWrites();
      ProdukPinjamanPage.openLoan(fx.paths.loan);
    });

    afterEach(() => {
      cy.assertNoWritesLeaked();
    });

    it('TC-PRODUK-CREATE-001 | Happy | Form Tambah Pinjaman menampilkan seluruh field dan tombol Simpan', () => {
      fx.loan.createFields.forEach((n) => ProdukPinjamanPage.elements.createField(n).should('exist'));
      ProdukPinjamanPage.elements.createField('name').should('have.attr', 'required');
      ProdukPinjamanPage.elements.createField('interest_rates').should('have.attr', 'type', 'number');
      ProdukPinjamanPage.elements.createSubmit().should('be.visible').and('contain.text', 'Simpan');
    });

    it('TC-PRODUK-CREATE-002 | Positif | Form memiliki field Satuan Periode Bunga yang wajib diisi', () => {
      ProdukPinjamanPage.elements.createForm().then(($f) => {
        const fld = $f.find(fx.loan.satuanPeriodeFieldSelectors);
        expect(fld.length, 'field Satuan Periode Bunga ada di form tambah').to.be.greaterThan(0);
        expect(fld.first().is('[required]'), 'Satuan Periode Bunga required').to.eq(true);
      });
    });

    it('TC-PRODUK-CREATE-003 | Positif | Pilihan Jenis Angsuran hanya Bulanan dan Mingguan', () => {
      ProdukPinjamanPage.elements.createField('installment_type').find('option').then(($o) => {
        const vals = Cypress.$.makeArray($o).map((o) => o.value);
        expect(vals.sort()).to.deep.eq([...fx.loan.angsuranOptionsPrd].sort());
      });
    });

    it('TC-PRODUK-CREATE-004 | Positif | Form tambah memiliki field Status dengan pilihan Aktif dan Tidak Aktif', () => {
      ProdukPinjamanPage.elements.createForm().find('select[name="status"]').should('exist')
        .find('option')
        .then(($o) => {
          expect(Cypress.$.makeArray($o).map((o) => o.value)).to.include.members(['ACTIVE', 'INACTIVE']);
        });
    });

    it('TC-PRODUK-CREATE-005 | Positif | Simpanan Wajib Ya menampilkan field persentase, Tidak menyembunyikannya', () => {
      ProdukPinjamanPage.elements.savingPercentGroup().should('not.be.visible');
      ProdukPinjamanPage.elements.createField('need_saving').select('YES');
      ProdukPinjamanPage.elements.savingPercentGroup().should('be.visible');
      ProdukPinjamanPage.elements.createField('saving_percent').should('be.visible');
      ProdukPinjamanPage.elements.createField('need_saving').select('NO');
      ProdukPinjamanPage.elements.savingPercentGroup().should('not.be.visible');
    });

    it('TC-PRODUK-CREATE-006 | Negatif | Simpan dengan field wajib kosong tidak mengirim form', () => {
      ProdukPinjamanPage.elements.createField('name').clear();
      ProdukPinjamanPage.elements.createField('code').clear();
      ProdukPinjamanPage.elements.createField('interest_rates').clear();
      ProdukPinjamanPage.elements.createSubmit().click();
      ProdukPinjamanPage.firstInvalidName(createForm).should('eq', 'name');
      ProdukPinjamanPage.elements.createField('name').then(($i) => {
        expect($i[0].validity.valueMissing, 'name valueMissing').to.eq(true);
      });
      cy.location('pathname').should('eq', fx.paths.loan);
      cy.blockedWrites().should('deep.eq', []);
    });

    it('TC-PRODUK-CREATE-007 | Negatif | Field Bunga tidak menerima input selain angka', () => {
      ProdukPinjamanPage.elements.createField('interest_rates').clear().type(fx.testData.notANumber);
      ProdukPinjamanPage.elements.createField('interest_rates').should('have.value', '');
    });
  });

  describe('Validasi sisi server (POST ditolak, tidak ada data tercipta)', () => {
    let existing;

    beforeEach(() => {
      cy.guardWrites({ allow: [new RegExp(fx.paths.loanCreatePost)] });
      ProdukPinjamanPage.openLoan(fx.paths.loan);
      ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
        expect(list.length, 'precondition: minimal 1 produk pinjaman (nama & kode dipakai ulang agar pasti ditolak)').to.be.greaterThan(0);
        [existing] = list;
      });
    });

    const fillDuplicate = (overrides = {}) => {
      ProdukPinjamanPage.fillCreate({
        name: existing.nama,
        code: existing.kode,
        installment_type: 'MONTHLY',
        interest_rates: fx.testData.validRate,
        interest_type: 'FLAT',
        collateral: 'NO',
        need_saving: 'NO',
        online: 'NO',
        descriptions: fx.testData.descriptions,
        ...overrides,
      });
    };

    it('TC-PRODUK-CREATE-008 | Negatif | Bunga bernilai negatif ditolak dengan pesan error', () => {
      cy.then(() => fillDuplicate({ interest_rates: fx.testData.negativeRate }));
      ProdukPinjamanPage.submitCreateBypassHtml5();
      ProdukPinjamanPage.assertUrl(fx.paths.loan);
      ProdukPinjamanPage.common.validationItems().should('contain.text', fx.loan.msg.rateMin);
    });

    it('TC-PRODUK-CREATE-009 | Negatif | Nama produk yang sudah ada ditolak dengan pesan error', () => {
      cy.then(() => fillDuplicate());
      ProdukPinjamanPage.submitCreateBypassHtml5();
      ProdukPinjamanPage.assertUrl(fx.paths.loan);
      ProdukPinjamanPage.common.validationItems().should('contain.text', fx.loan.msg.nameTaken);
      ProdukPinjamanPage.elements.createField('name').should(($i) => expect($i.val()).to.eq(existing.nama));
    });

    it('TC-PRODUK-CREATE-010 | Negatif | Kode produk yang sudah ada ditolak dengan pesan error', () => {
      cy.then(() => fillDuplicate());
      ProdukPinjamanPage.submitCreateBypassHtml5();
      ProdukPinjamanPage.assertUrl(fx.paths.loan);
      ProdukPinjamanPage.common.validationItems().should('contain.text', fx.loan.msg.codeTaken);
    });
  });
});
