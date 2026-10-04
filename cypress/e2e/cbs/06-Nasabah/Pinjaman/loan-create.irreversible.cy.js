/// <reference types="cypress" />
// TC sumber: docs/test-cases/src/TC_Pinjaman_Create.json (TC-LOAN-CREATE-016..018)
// ⚠️ TIDAK BISA DIBATALKAN: menyimpan draft & mengajukan pinjaman (accounts/loans/approvals). Tidak ada fitur hapus
// draft/pengajuan dari UI (cleanup hanya lewat penolakan di menu Approval oleh supervisor). Karena itu:
//   - dibungkus describeIfFlag('allowLoanCreate') → default di-skip;
//   - HANYA memakai CIF milik QA (nama diawali "QA") dari fixture: data.cifCodeQa (tanpa pinjaman/pengajuan)
//     dan data.cifCodeQaAktif (CIF QA yang SUDAH punya pinjaman aktif). Kosong → test gagal dengan pesan jelas.
// Jalankan: npx cypress run --spec "cypress/e2e/cbs/06-Nasabah/Pinjaman/loan-create.irreversible.cy.js" --env allowLoanCreate=true
import { describeIfFlag } from '../../../../support/utils/flags';
import LoanCreatePage from '../../../../support/pageobjects/Nasabah/LoanCreatePage';
import { norm } from '../../../../support/pageobjects/Nasabah/LoanDetailPage';

describeIfFlag('allowLoanCreate', 'Nasabah - Pinjaman - Pengajuan Pinjaman (menyimpan data)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/loan').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  const requireQaCif = (code, key) => {
    expect(code, `precondition: isi fixture data.${key} dengan kode CIF milik QA`).to.be.a('string').and.not.be.empty;
    LoanCreatePage.openCreate(fx.paths.create, code);
    cy.get('.caption-subject').first().invoke('text').then((t) => {
      expect(norm(t), 'CIF harus milik QA (nama diawali "QA")').to.match(/^QA/);
    });
  };

  /** Isi & simpan tahap Data Pengajuan (produk bulanan). */
  const isiDataPengajuan = (amount, tenor) => {
    LoanCreatePage.selectProductByType('MONTHLY').then((p) => {
      LoanCreatePage.fillAmount(amount).fillTenor(tenor);
      LoanCreatePage.elements.asuransi().clear().type(fx.create.contoh.asuransi);
      LoanCreatePage.elements.provisi().clear().type(fx.create.contoh.provisi);
      LoanCreatePage.elements.purpose().find('option').then(($o) => {
        const opt = Cypress.$.makeArray($o).find((o) => o.value && !o.disabled);
        LoanCreatePage.elements.purpose().select(opt.value, { force: true }).trigger('change', { force: true });
      });
      if (p.needSaving) {
        cy.get('#saving_account option').then(($o) => {
          const opt = Cypress.$.makeArray($o).find((o) => o.value && !o.disabled);
          expect(opt, 'precondition: CIF QA punya rekening simpanan aktif untuk produk bersimpanan wajib').to.exist;
          cy.get('#saving_account').select(opt.value, { force: true });
        });
      }
      LoanCreatePage.elements.submitData().click();
    });
  };

  it('TC-LOAN-CREATE-016 | Happy | Pengajuan lengkap (Data Pengajuan → Informasi Pekerjaan → Agunan) berhasil diajukan', () => {
    const code = fx.data.cifCodeQa;
    requireQaCif(code, 'cifCodeQa');
    isiDataPengajuan(fx.create.contoh.amount, fx.create.contoh.tenorBulanan);
    LoanCreatePage.assertSuccess('Data Pengajuan berhasil disimpan');
    cy.location('search').should('include', 'menu=occupation');

    const o = fx.createIrreversible.occupation;
    cy.get('#occupation_type option').then(($o) => {
      const opt = Cypress.$.makeArray($o).find((x) => norm(x.textContent) === o.type) || Cypress.$.makeArray($o).find((x) => x.value);
      cy.get('#occupation_type').select(opt.value, { force: true });
    });
    cy.get('#office_name').clear().type(o.office_name);
    cy.get('#economic_sector option').then(($o) => {
      const opt = Cypress.$.makeArray($o).find((x) => x.value && !x.disabled);
      cy.get('#economic_sector').select(opt.value, { force: true });
    });
    cy.get('#office_address').clear().type(o.office_address);
    cy.get('input[name="length_of_work"]').clear().type(o.length_of_work);
    cy.get('#total_earning').clear().type(o.total_earning);
    cy.get('#total_spending').clear().type(o.total_spending);
    cy.get('#tab_occupation form button[type="submit"]').first().click();
    LoanCreatePage.assertSuccess('Data Informasi Pekerjaan berhasil disimpan');

    cy.get('body').then(($b) => {
      // Produk tanpa agunan (bypass) langsung terkirim di tahap pekerjaan.
      if ($b.find('#tab_collateral #collateral_type').length) {
        cy.get('#collateral_type').select('NON_COLLATERAL', { force: true }).trigger('change', { force: true });
        // collateral_appraiser wajib di LoanCollateralRequest walau Tanpa Agunan (perlu dicek ke DOM asli).
        cy.get('input[name="collateral_appraiser"]').invoke('val', 'QA Penilai');
        cy.contains('#tab_collateral button[type="submit"]', 'Tambahkan Agunan').click();
        LoanCreatePage.assertSuccess('Data Agunan berhasil ditambahkan');
        cy.contains('#tab_collateral button[type="submit"]', 'Simpan & Ajukan').click();
      }
    });
    LoanCreatePage.assertSuccess(fx.createIrreversible.successSubmit);
    cy.location('pathname').should('eq', fx.paths.cifDetail.replace('{code}', code));
  });

  it('TC-LOAN-CREATE-017 | Negatif | Nasabah yang masih punya pinjaman aktif ditolak saat Simpan & Ajukan Sekarang dengan menyebut nomor pinjamannya', () => {
    const code = fx.data.cifCodeQaAktif;
    requireQaCif(code, 'cifCodeQaAktif');
    LoanCreatePage.elements.noteActive().invoke('text').then((note) => {
      const nomor = (norm(note).match(/\d[\d.\s-]{6,}\d/) || [''])[0].replace(/\D/g, '');
      isiDataPengajuan(fx.create.contoh.amount, fx.create.contoh.tenorBulanan);
      // PRD: penyimpanan ditolak + pesan error memuat nomor pinjaman aktif (pengecekan ulang saat submit).
      cy.get('.alert.alert-danger, .note.note-danger, .help-block').should('be.visible').invoke('text').then((t) => {
        expect(norm(t), 'pesan menyebut pinjaman aktif').to.match(new RegExp(fx.createIrreversible.activeLoanErrorRegex, 'i'));
        if (nomor) expect(norm(t).replace(/\D/g, '')).to.include(nomor);
      });
    });
  });

  it('TC-LOAN-CREATE-018 | Negatif | Kombinasi jumlah & jangka waktu yang tidak dapat dibulatkan ditolak dengan pesan error', () => {
    const code = fx.data.cifCodeQa;
    requireQaCif(code, 'cifCodeQa');
    const k = fx.createIrreversible.kasusTakBisaBulat;
    LoanCreatePage.selectProductByType('WEEKLY').then(() => {
      LoanCreatePage.fillAmount(k.amount).fillTenor(k.tenor);
      LoanCreatePage.elements.purpose().find('option').then(($o) => {
        const opt = Cypress.$.makeArray($o).find((o) => o.value && !o.disabled);
        LoanCreatePage.elements.purpose().select(opt.value, { force: true });
      });
      LoanCreatePage.elements.asuransi().clear().type('0');
      LoanCreatePage.elements.provisi().clear().type('0');
      LoanCreatePage.elements.submitData().click();
      cy.get('body').invoke('text').should('match', new RegExp(fx.createIrreversible.pembulatanErrorRegex, 'i'));
    });
  });
});
