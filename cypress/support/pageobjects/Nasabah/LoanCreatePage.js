// LoanCreatePage — Pengajuan Pinjaman /loan/create/{cifCode}?menu=data|occupation|collateral.
//
// Sumber markup (origin/develop):
//   resources/views/loan/create.blade.php        → breadcrumb "Pengajuan Pinjaman", nav-pills (Data Pengajuan /
//                                                  Informasi Pekerjaan / Informasi Agunan), note pinjaman aktif /
//                                                  pengajuan belum cair, JS setProduct()/countPrincipalInterest()/
//                                                  installmentDetail() (GET /installment/detail).
//   resources/views/loan/create/data.blade.php   → form POST /loan/create/{code} (LoanDataRequest):
//                                                  #select_product[name=product] (option data-installment_type,
//                                                  data-interest_type, data-interest_rates, data-need_saving,
//                                                  data-saving_percent), #loan_amount, #loan_tenor (MONTHLY → <select>,
//                                                  WEEKLY → <input>), #loan_asuransi(+_final), #loan_provisi(+_final),
//                                                  #saving_account, #use_of_credit_types, hasil #loan_principal,
//                                                  #loan_interest, #loan_saving, #loan_total, tombol "Lihat Angsuran
//                                                  Lengkap" → #table-installment / #data-table.
//   resources/views/loan/create/occupation.blade.php, collateral.blade.php → tahap 2 & 3 (POST .../occupation,
//                                                  .../collateral), lalu POST .../submit (Simpan & Ajukan Sekarang).
// Pesan validasi server: 'Wajib diisi!' (span.help-block per field + .alert-danger li).

import BasePage from '../BasePage';

class LoanCreatePage extends BasePage {
  elements = {
    dataForm: () => cy.get('form[action*="/loan/create/"]').filter((i, f) => /\/loan\/create\/[^/]+$/.test(f.getAttribute('action'))),
    submitData: () => cy.contains('button[type="submit"]', 'Simpan & Selanjutnya'),
    product: () => cy.get('#select_product'),
    amount: () => cy.get('#loan_amount'),
    tenor: () => cy.get('#loan_tenor'),
    tenorUnit: () => cy.get('#tenor_type'),
    asuransi: () => cy.get('#loan_asuransi'),
    asuransiFinal: () => cy.get('#loan_asuransi_final'),
    provisi: () => cy.get('#loan_provisi'),
    provisiFinal: () => cy.get('#loan_provisi_final'),
    savingAccountGroup: () => cy.get('#saving_accounts'),
    savingResultGroup: () => cy.get('#data_loan_saving'),
    purpose: () => cy.get('#use_of_credit_types'),
    principal: () => cy.get('#loan_principal'),
    interest: () => cy.get('#loan_interest'),
    saving: () => cy.get('#loan_saving'),
    total: () => cy.get('#loan_total'),
    btnInstallment: () => cy.contains('#button-installment a', 'Lihat Angsuran Lengkap'),
    installmentBox: () => cy.get('#table-installment'),
    navTabs: () => cy.get('.portlet-body ul.nav.nav-pills a[data-toggle="tab"]'),
    noteActive: () => cy.get('.note.note-warning'),
    noteBlocked: () => cy.get('.note.note-danger'),
    helpBlocks: () => cy.get('#tab_data .help-block'),
    formLabels: () => cy.get('#tab_data label.control-label'),
  };

  openCreate(createPath, code) {
    this.open(createPath.replace('{code}', code));
    this.assertNotRedirectedToLogin();
    return this;
  }

  /**
   * Pilih produk pertama yang data-installment_type-nya cocok (MONTHLY/WEEKLY).
   * Optional filter needSaving (true/false). Mengembalikan atribut produk terpilih.
   */
  selectProductByType(type, needSaving) {
    return this.elements.product().then(($sel) => {
      const opt = Cypress.$.makeArray($sel.find('option')).find((o) => {
        const $o = Cypress.$(o);
        if (!o.value || $o.attr('data-installment_type') !== type) return false;
        if (needSaving === undefined) return true;
        return ($o.attr('data-need_saving') === '1') === needSaving;
      });
      expect(opt, `precondition: ada produk pinjaman aktif bertipe ${type}${needSaving === undefined ? '' : needSaving ? ' dengan simpanan wajib' : ' tanpa simpanan wajib'}`).to.exist;
      const $o = Cypress.$(opt);
      const info = {
        id: opt.value,
        name: $o.text().trim(),
        installmentType: $o.attr('data-installment_type'),
        interestType: $o.attr('data-interest_type'),
        interestRates: Number($o.attr('data-interest_rates')),
        needSaving: $o.attr('data-need_saving') === '1',
        savingPercent: Number($o.attr('data-saving_percent') || 0),
      };
      cy.get('#select_product').select(opt.value, { force: true }).trigger('change', { force: true });
      return cy.then(() => info);
    });
  }

  fillAmount(v) {
    this.elements.amount().clear().type(v);
    return this;
  }

  /** Tenor: MONTHLY = <select>, WEEKLY = <input>. */
  fillTenor(v) {
    this.elements.tenor().then(($t) => {
      if ($t.is('select')) cy.wrap($t).select(String(v), { force: true }).trigger('change', { force: true });
      else cy.wrap($t).clear().type(String(v)).trigger('input');
    });
    return this;
  }

  /** Nilai numerik input readonly (hapus pemisah). */
  numVal(getter) {
    return getter().invoke('val').then((v) => Number(String(v || '0').replace(/[^0-9.-]/g, '')));
  }
}

export default new LoanCreatePage();
