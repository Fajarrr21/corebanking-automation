/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Create.json
// PRD: "Pengajuan Pinjaman BKD Pekalongan" (form Data Pengajuan) + "Tabel Angsuran Pinjaman".
// Read-only / negatif: TIDAK ada draft pengajuan yang tersimpan. Write-guard aktif; satu-satunya POST yang
// diizinkan (TC-LOAN-CREATE-013) adalah submit form Data Pengajuan dengan produk KOSONG → pasti ditolak
// LoanDataRequest ('product' required) sebelum controller menyentuh database.
// Alur pengajuan sungguhan ada di loan-create.irreversible.cy.js (flag allowLoanCreate).
import LoginPage from '../../../../support/pageobjects/LoginPage';
import LoanListPage from '../../../../support/pageobjects/Nasabah/LoanListPage';
import LoanCreatePage from '../../../../support/pageobjects/Nasabah/LoanCreatePage';
import { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('Nasabah - Pinjaman - Pengajuan Pinjaman (form, tanpa menyimpan)', () => {
  let fx;
  let code;
  let activeLoan;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
      LoginPage.loginViaSession();
      LoanListPage.findLoan({ dataPath: fx.paths.data, length: fx.data.scanLength, label: 'apa pun' }).then((l) => {
        activeLoan = l;
        code = fx.data.cifCodeTanpaPinjaman || l.cifCode;
        expect(code, 'precondition: kode CIF (fixture data.cifCodeTanpaPinjaman atau dari pinjaman aktif)').to.be.a('string').and.not.be.empty;
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

  describe('Tampilan form Data Pengajuan', () => {
    beforeEach(() => {
      LoanCreatePage.openCreate(fx.paths.create, code);
    });

    it('TC-LOAN-CREATE-001 | Happy | Halaman Pengajuan Pinjaman tampil dengan tab tahapan dan tombol Simpan & Selanjutnya', () => {
      LoanCreatePage.assertDocumentTitle(fx.create.title).assertBreadcrumb(fx.create.breadcrumb);
      LoanCreatePage.elements.navTabs().then(($a) => {
        const t = Cypress.$.makeArray($a).map((a) => norm(a.innerText));
        expect(t.slice(0, 2)).to.deep.eq(fx.create.tabs.slice(0, 2));
      });
      LoanCreatePage.elements.submitData().should('be.visible');
    });

    it('TC-LOAN-CREATE-002 | Positif | Field wajib Data Pengajuan tersedia dan bertanda wajib', () => {
      ['Pilih Produk Pinjaman', 'Jumlah Pinjaman', 'Jangka Waktu', 'Asuransi', 'Provisi', 'Tujuan Pinjaman'].forEach((l) => {
        LoanCreatePage.elements.formLabels().filter(`:contains("${l}")`).first().find('.required').should('exist');
      });
      LoanCreatePage.elements.product().should('have.attr', 'required');
    });

    it('TC-LOAN-CREATE-003 | Negatif | Form Data Pengajuan memiliki field wajib Officer Pengelola', () => {
      LoanCreatePage.elements.formLabels().then(($l) => {
        const t = Cypress.$.makeArray($l).map((l) => norm(l.innerText));
        expect(t.some((x) => x.includes(fx.create.officerPengelolaLabel)), 'label Officer Pengelola').to.eq(true);
      });
    });

    it('TC-LOAN-CREATE-004 | Positif | Pilihan Tujuan Pinjaman: Modal Kerja, Investasi, Konsumtif', () => {
      LoanCreatePage.elements.purpose().find('option').then(($o) => {
        const t = Cypress.$.makeArray($o).filter((o) => o.value && !o.disabled).map((o) => norm(o.textContent));
        expect(t).to.deep.eq(fx.create.tujuanPrd);
      });
    });

    it('TC-LOAN-CREATE-005 | Positif | Produk bulanan: pilihan jangka waktu 12, 18, 24, 30, 36, 42, 48, 54, 60 bulan', () => {
      LoanCreatePage.selectProductByType('MONTHLY');
      LoanCreatePage.elements.tenorUnit().should('have.text', fx.create.satuanBulanan);
      LoanCreatePage.elements.tenor().should('match', 'select').find('option').then(($o) => {
        const v = Cypress.$.makeArray($o).filter((o) => o.value).map((o) => o.value);
        expect(v).to.deep.eq(fx.create.tenorBulananPrd);
      });
    });

    it('TC-LOAN-CREATE-006 | Positif | Produk mingguan: jangka waktu dalam satuan minggu', () => {
      LoanCreatePage.selectProductByType('WEEKLY');
      LoanCreatePage.elements.tenorUnit().should('have.text', fx.create.satuanMingguan);
      LoanCreatePage.elements.tenor().should('be.visible');
    });

    it('TC-LOAN-CREATE-007 | Positif | Angsuran pertama (pokok, bunga, total) terhitung otomatis dan total = pokok + bunga + simpanan berkelipatan 1.000', () => {
      LoanCreatePage.selectProductByType('MONTHLY').then(() => {
        LoanCreatePage.fillAmount(fx.create.contoh.amount).fillTenor(fx.create.contoh.tenorBulanan);
        LoanCreatePage.elements.total().should(($t) => expect(Number($t.val())).to.be.greaterThan(0));
        LoanCreatePage.numVal(LoanCreatePage.elements.principal).then((p) => {
          LoanCreatePage.numVal(LoanCreatePage.elements.interest).then((i) => {
            LoanCreatePage.numVal(LoanCreatePage.elements.saving).then((s) => {
              LoanCreatePage.numVal(LoanCreatePage.elements.total).then((t) => {
                expect(p, 'pokok terisi').to.be.greaterThan(0);
                expect(t % fx.schedule.kelipatan, `total ${t} kelipatan 1.000`).to.eq(0);
                expect(p + i + s, 'pokok + bunga + simpanan = total').to.eq(t);
              });
            });
          });
        });
      });
    });

    it('TC-LOAN-CREATE-008 | Positif | Persentase asuransi dan provisi dikonversi otomatis ke nominal', () => {
      LoanCreatePage.selectProductByType('MONTHLY');
      LoanCreatePage.fillAmount(fx.create.contoh.amount);
      LoanCreatePage.elements.asuransi().clear().type(fx.create.contoh.asuransi);
      LoanCreatePage.elements.provisi().clear().type(fx.create.contoh.provisi);
      const amt = Number(fx.create.contoh.amount);
      LoanCreatePage.elements.asuransiFinal().should('have.value', String(Math.ceil(amt * (Number(fx.create.contoh.asuransi) / 100))));
      LoanCreatePage.elements.provisiFinal().should('have.value', String(Math.ceil(amt * (Number(fx.create.contoh.provisi) / 100))));
    });

    it('TC-LOAN-CREATE-009 | Positif | Produk tanpa simpanan wajib menyembunyikan field Simpanan dan Pilih Rekening Simpanan', () => {
      LoanCreatePage.selectProductByType('MONTHLY', false);
      LoanCreatePage.elements.savingResultGroup().should('not.be.visible');
      LoanCreatePage.elements.savingAccountGroup().should('not.be.visible');
    });

    it('TC-LOAN-CREATE-010 | Positif | Produk dengan simpanan wajib menampilkan field Simpanan dan Pilih Rekening Simpanan', () => {
      LoanCreatePage.elements.product().then(($s) => {
        const type = $s.find('option[data-need_saving="1"]').first().attr('data-installment_type') || 'MONTHLY';
        LoanCreatePage.selectProductByType(type, true);
        LoanCreatePage.elements.savingResultGroup().should('be.visible');
        LoanCreatePage.elements.savingAccountGroup().should('be.visible');
      });
    });

    it('TC-LOAN-CREATE-011 | Positif | Lihat Angsuran Lengkap menampilkan rincian angsuran per periode', () => {
      cy.intercept('GET', new RegExp(`${escRe(fx.paths.installmentDetail)}\\?`)).as('simulasi');
      LoanCreatePage.selectProductByType('MONTHLY');
      LoanCreatePage.fillAmount(fx.create.contoh.amount).fillTenor(fx.create.contoh.tenorBulanan);
      LoanCreatePage.elements.btnInstallment().click();
      cy.wait('@simulasi', { timeout: fx.timeout.table }).then((i) => {
        expect(i.request.url).to.include(`amount=${fx.create.contoh.amount}`).and.include(`tenor=${fx.create.contoh.tenorBulanan}`);
      });
      LoanCreatePage.elements.installmentBox().should('be.visible');
      LoanCreatePage.assertHeaders(fx.create.installmentHeadersPrd, fx.create.installmentTable);
      LoanCreatePage.waitTable(fx.create.installmentTable, fx.timeout.table);
      LoanCreatePage.dataRows(fx.create.installmentTable).should('have.length.greaterThan', 0);
    });
  });

  describe('Validasi form Data Pengajuan', () => {
    it('TC-LOAN-CREATE-012 | Negatif | Simpan tanpa memilih produk dicegah validasi form dan tidak ada data terkirim', () => {
      LoanCreatePage.openCreate(fx.paths.create, code);
      LoanCreatePage.elements.submitData().click();
      LoanCreatePage.elements.product().then(($s) => expect($s[0].checkValidity(), 'produk invalid').to.eq(false));
      cy.location('pathname').should('eq', fx.paths.create.replace('{code}', code));
      cy.blockedWrites().should('have.length', 0);
    });

    it('TC-LOAN-CREATE-013 | Negatif | Validasi server: data pengajuan kosong ditolak dengan pesan "Wajib diisi!"', () => {
      // POST diizinkan HANYA ke /loan/create/{code} (form tahap 1) dan isinya pasti invalid (produk kosong).
      const createPath = fx.paths.create.replace('{code}', code);
      cy.guardWrites({ allow: [new RegExp(`^${escRe(createPath)}$`)] });
      cy.intercept('POST', new RegExp(`${escRe(createPath)}$`)).as('postData');
      LoanCreatePage.openCreate(fx.paths.create, code);
      LoanCreatePage.elements.dataForm().invoke('attr', 'novalidate', 'novalidate');
      LoanCreatePage.elements.submitData().click();
      cy.wait('@postData').its('response.statusCode').should('eq', 302);
      cy.location('pathname').should('eq', createPath);
      LoanCreatePage.elements.helpBlocks().should('contain.text', fx.create.requiredMsg);
    });

    it('TC-LOAN-CREATE-014 | Negatif | Kode CIF tidak dikenal dialihkan ke daftar pinjaman dengan pesan error', () => {
      LoanCreatePage.openCreate(fx.paths.create, fx.data.refIdTidakAda);
      cy.location('pathname').should('eq', fx.paths.list);
      LoanCreatePage.assertError(fx.create.notFound);
    });
  });

  describe('Larangan pinjaman aktif ganda', () => {
    it('TC-LOAN-CREATE-015 | Negatif | Nasabah dengan pinjaman aktif diberi tahu pengajuan baru tidak dapat diajukan beserta nomor pinjaman aktifnya', () => {
      LoanCreatePage.openCreate(fx.paths.create, activeLoan.cifCode);
      LoanCreatePage.elements.noteActive().should('contain.text', fx.create.activeLoanNote).invoke('text').then((t) => {
        const digits = String(activeLoan.accountNumber || '').replace(/\D/g, '');
        expect(norm(t).replace(/\D/g, ''), 'nomor rekening pinjaman aktif disebut').to.include(digits);
        expect(norm(t), 'tidak boleh menyatakan pengajuan tetap boleh dibuat').not.to.match(/boleh dibuat/i);
      });
    });
  });
});
