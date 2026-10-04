/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Produk_Edit.json
// Read-only terhadap produk NYATA (dipakai pinjaman nasabah): seluruh POST diblokir cy.guardWrites().
// ProductController::loanEdit TIDAK punya validasi server, jadi submit ke produk nyata DILARANG —
// test negatif di sini mensyaratkan penolakan sisi klien (request tidak pernah dikirim).
// Edit yang benar-benar menyimpan hanya dilakukan pada produk QA di produk-lifecycle.irreversible.cy.js.
import ProdukPinjamanPage from '../../../support/pageobjects/Produk/ProdukPinjamanPage';

describe('Produk Pinjaman - Ubah Produk (read-only)', () => {
  let fx;
  let products;

  before(() => {
    cy.fixture('produk/produk').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.guardWrites();
    ProdukPinjamanPage.openLoan(fx.paths.loan);
    ProdukPinjamanPage.allProducts(fx.loan.col).then((list) => {
      expect(list.length, 'precondition: minimal 1 produk pinjaman').to.be.greaterThan(0);
      products = list;
    });
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const yesNo = (v) => (v === '1' || v === 'true' ? 'YES' : 'NO');

  describe('Modal Edit terisi data produk', () => {
    it('TC-PRODUK-EDIT-001 | Happy | Klik Edit membuka modal Edit Produk Pinjaman berisi nama, kode, dan bunga produk', () => {
      const p = products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editModal().find('.modal-title').should('contain.text', fx.loan.editModalTitle);
      ProdukPinjamanPage.elements.editField('id').should('have.value', p.id);
      ProdukPinjamanPage.elements.editField('name').should('have.value', p.nama);
      ProdukPinjamanPage.elements.editField('code').should('have.value', p.kode);
      ProdukPinjamanPage.elements.editField('interest_rate').should(($i) => {
        expect(Number($i.val())).to.eq(Number(p.data.bunga));
      });
      ProdukPinjamanPage.elements.editModal().find('.note.note-info').should('contain.text', fx.loan.editInfoNote);
    });

    it('TC-PRODUK-EDIT-002 | Positif | Modal Edit terisi Model Angsuran, Agunan, Simpanan Wajib, dan Online sesuai produk', () => {
      const p = products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('installment_type').should('have.value', p.data.angsuran);
      ProdukPinjamanPage.elements.editField('collateral').should('have.value', yesNo(p.data.agunan));
      ProdukPinjamanPage.elements.editField('need_saving').should('have.value', yesNo(p.data.simpananWajib));
      ProdukPinjamanPage.elements.editField('online').should('have.value', yesNo(p.data.online));
      ProdukPinjamanPage.closeEdit();
    });

    it('TC-PRODUK-EDIT-003 | Positif | Perhitungan Bunga di modal Edit menyediakan Flat dan Anuitas serta terisi sesuai produk', () => {
      const p = products.find((x) => x.data.metode === 'ANNUITY') || products[0];
      cy.log(`produk uji: ${p.nama} (${p.data.metode})`);
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('interest_count').find('option').then(($o) => {
        expect(Cypress.$.makeArray($o).map((o) => o.value)).to.include.members(fx.loan.interestTypesPrd);
      });
      ProdukPinjamanPage.elements.editField('interest_count').should('have.value', p.data.metode);
    });

    it('TC-PRODUK-EDIT-004 | Positif | Status di modal Edit terisi sesuai status produk', () => {
      const p = products.find((x) => x.status === 'Tidak Aktif') || products[0];
      cy.log(`produk uji: ${p.nama} (${p.status}) — idealnya produk Tidak Aktif`);
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('status').should('have.value', p.status === 'Aktif' ? 'ACTIVE' : 'INACTIVE');
    });
  });

  describe('Batal & validasi sisi klien (tanpa request tulis)', () => {
    it('TC-PRODUK-EDIT-005 | Negatif | Menutup modal Edit tanpa menyimpan tidak mengubah data', () => {
      const p = products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('name').clear().type('QA-batal');
      ProdukPinjamanPage.closeEdit();
      cy.blockedWrites().should('deep.eq', []);
      cy.contains(`${fx.loan.table} tbody td`, p.nama).should('exist');
    });

    it('TC-PRODUK-EDIT-006 | Negatif | Nama dikosongkan lalu Ubah — form tidak terkirim', () => {
      const p = products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('name').clear();
      ProdukPinjamanPage.elements.editSubmit().click();
      cy.blockedWrites().should('deep.eq', []);
      ProdukPinjamanPage.elements.editField('name').then(($i) => {
        expect($i[0].validity.valueMissing, 'Nama Pinjaman wajib (valueMissing)').to.eq(true);
      });
    });

    it('TC-PRODUK-EDIT-007 | Negatif | Bunga negatif di modal Edit tidak terkirim', () => {
      const p = products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('interest_rate').clear().type(fx.testData.negativeRate);
      ProdukPinjamanPage.elements.editSubmit().click();
      cy.blockedWrites().should('deep.eq', []);
    });
  });

  describe('Produk yang sudah dipakai pinjaman aktif', () => {
    it('TC-PRODUK-EDIT-008 | Positif | Mengubah bunga produk yang dipakai pinjaman aktif menampilkan peringatan sebelum disimpan', () => {
      const confirms = [];
      cy.on('window:confirm', (txt) => {
        confirms.push(txt);
        return false;
      });
      const p = products.find((x) => x.status === 'Aktif') || products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('interest_rate').clear().type(String(Number(p.data.bunga) + 0.01));
      ProdukPinjamanPage.elements.editSubmit().click();
      cy.get('body').should(($b) => {
        const shown = Cypress.$($b).find('.modal:visible:not(#edit), .alert-warning:visible, .swal2-popup:visible')
          .toArray()
          .some((el) => el.innerText.toLowerCase().includes(fx.loan.msg.warningActiveLoan));
        const confirmed = confirms.some((t) => t.toLowerCase().includes(fx.loan.msg.warningActiveLoan));
        expect(shown || confirmed, 'peringatan jumlah pinjaman aktif muncul sebelum simpan').to.eq(true);
      });
    });

    it('TC-PRODUK-EDIT-009 | Positif | Jenis Angsuran tidak dapat diubah pada produk yang dipakai pinjaman aktif', () => {
      const p = products.find((x) => x.status === 'Aktif') || products[0];
      ProdukPinjamanPage.openEditById(p.id, p.nama);
      ProdukPinjamanPage.elements.editField('installment_type').should('be.disabled');
    });
  });
});
