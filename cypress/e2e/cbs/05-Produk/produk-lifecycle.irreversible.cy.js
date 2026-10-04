/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Produk_Irreversible.json
//
// ⚠️ IRREVERSIBLE — hanya jalan dengan `--env allowProdukCreate=true`.
// Produk TIDAK punya fitur hapus. ProductController::loanCreate juga membuat akun SUB GL
// "Pendapatan Bunga Produk <nama>" untuk SETIAP kantor (tidak ikut terhapus). Cleanup terbaik
// yang mungkin: produk QA dinonaktifkan (status INACTIVE) di after() — produk Tidak Aktif tidak
// muncul di pilihan produk pengajuan pinjaman. Nama produk diawali "QA" (cy.qaName) dan kode
// 2 digit yang belum terpakai (dicari dari 99 turun).
// Edit hanya dilakukan pada produk QA milik run ini (dicek nama diawali "QA" sebelum submit).
import { describeIfFlag } from '../../../support/utils/flags';
import ProdukPinjamanPage from '../../../support/pageobjects/Produk/ProdukPinjamanPage';

describeIfFlag('allowProdukCreate', 'Produk Pinjaman - Siklus produk QA (tambah, ubah, nonaktifkan)', () => {
  let fx;
  const qa = { name: null, code: null, id: null };

  before(() => {
    cy.fixture('produk/produk').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  const findQa = () => ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
    const p = list.find((x) => x.nama === qa.name);
    return cy.then(() => p);
  });

  const openQaEdit = () => {
    expect(qa.name, 'produk QA sudah dibuat oleh TC-PRODUK-IRREV-001').to.match(/^QA/);
    ProdukPinjamanPage.openLoan(fx.paths.loan);
    findQa().then((p) => {
      expect(p, `produk ${qa.name} ada di list`).to.exist;
      qa.id = p.id;
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('name').should('have.value', qa.name);
    });
  };

  after(() => {
    // Cleanup: pastikan produk QA run ini berstatus Tidak Aktif.
    if (!qa.name || !/^QA/.test(qa.name)) return;
    ProdukPinjamanPage.openLoan(fx.paths.loan);
    findQa().then((p) => {
      if (!p || p.status === 'Tidak Aktif') return;
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('name').should('have.value', qa.name);
      ProdukPinjamanPage.elements.editField('status').select('INACTIVE');
      ProdukPinjamanPage.elements.editSubmit().click();
      ProdukPinjamanPage.assertSuccess(fx.loan.msg.editSuccess);
    });
  });

  it('TC-PRODUK-IRREV-001 | Happy | Tambah produk pinjaman valid berhasil dan tampil di list dengan status Aktif', () => {
    ProdukPinjamanPage.openLoan(fx.paths.loan);
    ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
      qa.code = ProdukPinjamanPage.unusedCode(list);
    });
    cy.qaName('Produk').then((n) => {
      qa.name = n;
      ProdukPinjamanPage.fillCreate({
        name: qa.name,
        code: qa.code,
        installment_type: 'MONTHLY',
        interest_rates: fx.testData.validRate,
        interest_type: 'FLAT',
        collateral: 'NO',
        need_saving: 'NO',
        online: 'NO',
        descriptions: fx.testData.descriptions,
      });
    });
    ProdukPinjamanPage.elements.createSubmit().click();
    ProdukPinjamanPage.assertUrl(fx.paths.loan).assertSuccess(fx.loan.msg.createSuccess);
    ProdukPinjamanPage.waitClientTable();
    findQa().then((p) => {
      expect(p, 'produk QA baru tampil di list').to.exist;
      expect(p.status).to.eq('Aktif');
      expect(p.kode).to.eq(qa.code);
      expect(p.angsuran).to.eq('Bulanan');
      expect(p.metode).to.eq('Flat');
      expect(Number(p.data.bunga)).to.eq(Number(fx.testData.validRate));
    });
  });

  it('TC-PRODUK-IRREV-002 | Positif | Ubah bunga produk QA berhasil dan nilai baru tampil di list', () => {
    openQaEdit();
    ProdukPinjamanPage.elements.editField('interest_rate').clear().type(fx.testData.editedRate);
    ProdukPinjamanPage.elements.editSubmit().click();
    ProdukPinjamanPage.assertUrl(fx.paths.loan).assertSuccess(fx.loan.msg.editSuccess);
    ProdukPinjamanPage.waitClientTable();
    findQa().then((p) => expect(Number(p.data.bunga)).to.eq(Number(fx.testData.editedRate)));
  });

  it('TC-PRODUK-IRREV-003 | Negatif | Bunga negatif pada produk QA ditolak dan bunga tidak berubah', () => {
    openQaEdit();
    ProdukPinjamanPage.elements.editField('interest_rate').clear().type(fx.testData.negativeRate);
    ProdukPinjamanPage.elements.editForm().then(($f) => {
      $f[0].noValidate = true;
    });
    ProdukPinjamanPage.elements.editSubmit().click();
    ProdukPinjamanPage.common.alertSuccess().should('not.exist');
    ProdukPinjamanPage.assertError();
    ProdukPinjamanPage.openLoan(fx.paths.loan);
    findQa().then((p) => expect(Number(p.data.bunga), 'bunga tetap nilai sebelumnya').to.eq(Number(fx.testData.editedRate)));
  });

  it('TC-PRODUK-IRREV-004 | Positif | Nonaktifkan produk QA mengubah status menjadi Tidak Aktif', () => {
    openQaEdit();
    ProdukPinjamanPage.elements.editField('status').select('INACTIVE');
    ProdukPinjamanPage.elements.editSubmit().click();
    ProdukPinjamanPage.assertSuccess(fx.loan.msg.editSuccess);
    ProdukPinjamanPage.waitClientTable();
    findQa().then((p) => expect(p.status).to.eq('Tidak Aktif'));
  });
});
