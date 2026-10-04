// RkaUnitPage — menu RKA > Cabang (/rka/unit).
//
// Sumber (origin/develop):
//   view  : resources/views/rka/unit/index.blade.php
//   ctrl  : app/Http/Controllers/RkaUnitController.php
//   route : rka.unit.* (routes/web.php:362-376)
//
// Form: Pilih Wilayah (#branch_select, kantor role BRANCH/null) → AJAX
// GET /rka/unit/units/{branchId} (relasi via offices.branch = NAMA kantor induk)
// mengisi Pilih Cabang (#sales_select, name=office_id). Bila wilayah tidak punya
// unit, dropdown Cabang disembunyikan & office_id = id wilayah itu sendiri.
// Target unit TIDAK punya kolom nama → data uji dikenali dari kombinasi
// (Nama Cabang, Tahun) yang dicek belum ada sebelum membuat.

import BasePage from '../BasePage';
import {
  fillTargetForm, buildTargetBody, readTableRows, csrfToken, countProductRows, normText,
} from './rkaShared';

class RkaUnitPage extends BasePage {
  path = '/rka/unit';

  elements = {
    form: () => cy.get('#form_rka_ao'),
    branchSelect: () => cy.get('#branch_select'),
    officeSelect: () => cy.get('#sales_select'),
    officeGroup: () => cy.get('#sales_select').closest('.col-md-4'),
    yearSelect: () => cy.get('#year_select'),
    tab: (key) => cy.get(`#${key}-tab`),
    tabPane: (key) => cy.get(`#${key}`),
    submitBtn: () => cy.get('#lainnya button[type="submit"]'),
    listTable: () => cy.get('#sample_1'),
    listSearch: () => cy.get('#sample_1_filter input'),
    listLength: () => cy.get('select[name="sample_1_length"]'),
    rowBtn: (cls, id) => cy.get(`#sample_1 .${cls}[data-id="${id}"]`),
    editModal: () => cy.get('#rkaEditModal'),
    editTitle: () => cy.get('#rkaEditModalLabel'),
    editForm: () => cy.get('#editRkaForm'),
    editSubmit: () => cy.get('#updateRkaBtn'),
    toggleModal: () => cy.get('#toggleStatusModal'),
    toggleConfirm: () => cy.get('#confirmToggleStatus'),
    deleteModal: () => cy.get('#deleteRkaModal'),
    deleteConfirm: () => cy.get('#confirmDeleteRka'),
    deleteCancel: () => cy.get('#deleteRkaModal .modal-footer button[data-dismiss="modal"]'),
  };

  visit() {
    this.open(this.path);
    return this.assertAccessible();
  }

  assertAccessible() {
    this.assertNotRedirectedToLogin();
    cy.get('body').should(($b) => {
      expect(
        $b.find('#form_rka_ao').length,
        'Form RKA Cabang tidak tampil — akun test kemungkinan bukan supervisor/super-admin (butuh akses menu RKA)',
      ).to.be.greaterThan(0);
    });
    return this;
  }

  /** Pilih wilayah (value) lalu tunggu AJAX daftar cabang (@unitsByBranch harus sudah di-intercept). */
  selectBranch(value) {
    this.elements.branchSelect().select(String(value), { force: true });
    cy.wait('@unitsByBranch');
    return this;
  }

  /** Pilih cabang hanya bila dropdown-nya tampil (wilayah punya unit). */
  selectOffice(value) {
    this.elements.officeGroup().then(($g) => {
      if ($g.is(':visible')) this.elements.officeSelect().select(String(value), { force: true });
    });
    return this;
  }

  selectYear(year) {
    this.elements.yearSelect().select(String(year), { force: true });
    return this;
  }

  fillTargets(data, opts) {
    fillTargetForm('#form_rka_ao', data, opts);
    return this;
  }

  fillTargetsInEdit(data, opts) {
    fillTargetForm('#editRkaForm', data, opts);
    return this;
  }

  goToTab(key) {
    this.elements.tab(key).should('not.have.css', 'pointer-events', 'none').click();
    this.elements.tabPane(key).should('have.class', 'active');
    return this;
  }

  submit() {
    this.elements.submitBtn().should('be.visible').click();
    return this;
  }

  productRowCount() {
    return countProductRows('#form_rka_ao');
  }

  rows() {
    return readTableRows('#sample_1');
  }

  /** Baris dengan kolom Nama Cabang PERSIS = officeName DAN kolom Tahun = year. */
  rowsFor(officeName, year) {
    return this.rows().then((rows) => rows.filter((r) => r.cells[1] === officeName && r.cells[2] === String(year)));
  }

  searchList(text) {
    this.elements.listSearch().clear().type(text);
    return this;
  }

  clickRowAction(cls, id) {
    this.elements.rowBtn(cls, id).should('be.visible').click();
    return this;
  }

  /**
   * Tentukan kantor uji: { branchValue, officeValue, officeName }.
   * Pakai nama dari fixture bila diisi, selain itu wilayah pertama & cabang terakhir.
   */
  resolveTestOffice(fx) {
    const ctx = {};
    this.elements.branchSelect().find('option').then(($opts) => {
      const opts = Cypress.$.makeArray($opts).filter((o) => o.value);
      expect(opts.length, 'minimal ada 1 wilayah (kantor BRANCH ACTIVE)').to.be.greaterThan(0);
      const pick = fx.unit.testBranchName
        ? opts.find((o) => normText(o.textContent) === fx.unit.testBranchName)
        : opts[0];
      expect(pick, `wilayah uji "${fx.unit.testBranchName}"`).to.exist;
      ctx.branchValue = pick.value;
      ctx.branchName = normText(pick.textContent);
    });
    cy.then(() => this.selectBranch(ctx.branchValue));
    this.elements.officeGroup().then(($g) => {
      if (!$g.is(':visible')) {
        ctx.officeValue = ctx.branchValue;
        ctx.officeName = ctx.branchName;
        return;
      }
      const opts = Cypress.$.makeArray(Cypress.$('#sales_select option')).filter((o) => o.value);
      const pick = fx.unit.testOfficeName
        ? opts.find((o) => normText(o.textContent) === fx.unit.testOfficeName)
        : opts[opts.length - 1];
      expect(pick, `cabang uji "${fx.unit.testOfficeName}"`).to.exist;
      ctx.officeValue = pick.value;
      // Opsi "(Semua Unit)" = kantor wilayah itu sendiri; nama di daftar RKA tanpa sufiks.
      ctx.officeName = normText(pick.textContent).replace(/ \(Semua Unit\)$/, '');
    });
    return cy.then(() => ctx);
  }

  /** Seed target unit via POST rka.unit.target (nilai sama di semua baris). */
  seedTarget(officeId, year, data) {
    this.open(this.path);
    return buildTargetBody('#form_rka_ao', data, { office_id: officeId, year }).then((body) => cy.request({
      method: 'POST', url: '/rka/unit/target', form: true, body, followRedirect: false,
    }).then((res) => expect(res.status, 'seed target RKA unit (redirect)').to.eq(302)));
  }

  entityIdsFor(officeName, year) {
    this.open(this.path);
    return this.rowsFor(officeName, year).then((rows) => rows.map((r) => r.id).filter(Boolean));
  }

  entityId(officeName, year) {
    return this.entityIdsFor(officeName, year).then((ids) => {
      expect(ids, `rka_entity untuk ${officeName} ${year}`).to.have.length(1);
      return ids[0];
    });
  }

  details(entityId) {
    return cy.request(`/rka/unit/${entityId}/details`).its('body');
  }

  /** CLEANUP: hapus rka_entity (Nama Cabang, Tahun) milik test. */
  cleanup(officeName, year) {
    if (!officeName || !year) return this;
    this.entityIdsFor(officeName, year).then((ids) => {
      if (!ids.length) return;
      csrfToken().then((token) => ids.forEach((id) => cy.request({
        method: 'DELETE', url: `/rka/unit/${id}`, headers: { 'X-CSRF-TOKEN': token }, failOnStatusCode: false,
      })));
    });
    return this;
  }
}

export default new RkaUnitPage();
