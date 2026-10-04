// RkaAccountOfficerPage — menu RKA > Account Officer (/rka/accountofficer).
//
// Sumber (origin/develop):
//   view  : resources/views/rka/accountofficer/index.blade.php
//           + tabs/rka-management.blade.php (form target, daftar RKA, modal detail/edit/bobot/status/hapus)
//           + tabs/officer-management.blade.php (CRUD Account Officer + penugasan cabang)
//   ctrl  : app/Http/Controllers/RkaAccountOfficerController.php
//   route : rka.accountofficer.* (routes/web.php:378-403)
//
// Dua "pill" tab: RKA Management (#customer_approval, default) dan Account Officer
// (#office_approval, ?menu=office_approval). Notifikasi flash dirender di dalam
// .tab-content (notifications.blade.php).

import BasePage from '../BasePage';
import {
  fillTargetForm, buildTargetBody, readTableRows, csrfToken, countProductRows, setWeights, normText,
} from './rkaShared';

class RkaAccountOfficerPage extends BasePage {
  path = '/rka/accountofficer';

  elements = {
    pill: (href) => cy.get(`ul.nav-pills a[href="${href}"]`),
    pane: (id) => cy.get(`#${id}`),
    // --- Form target KPI ---
    form: () => cy.get('#form_rka_ao'),
    aoSelect: () => cy.get('#account_officer_select'),
    yearSelect: () => cy.get('#year_select'),
    tab: (key) => cy.get(`#${key}-tab`),
    tabPane: (key) => cy.get(`#${key}`),
    submitBtn: () => cy.get('#lainnya button[type="submit"]'),
    resetBtn: () => cy.get('#lainnya button[type="reset"]'),
    targetResult: (product) => cy.get(`#form_rka_ao input.target-result[data-product="${product}"]`),
    idrDisplay: (product) => cy.get(`#form_rka_ao .idr-display[data-for="${product}"]`),
    // --- Daftar RKA ---
    listTable: () => cy.get('#sample_1'),
    listSearch: () => cy.get('#sample_1_filter input'),
    listLength: () => cy.get('select[name="sample_1_length"]'),
    rowBtn: (cls, id) => cy.get(`#sample_1 .${cls}[data-id="${id}"]`),
    // --- Modal ---
    detailModal: () => cy.get('#rkaDetailModal'),
    detailTitle: () => cy.get('#rkaDetailModalLabel'),
    detailContent: () => cy.get('#rkaDetailContent'),
    editModal: () => cy.get('#rkaEditModal'),
    editTitle: () => cy.get('#rkaEditModalLabel'),
    editForm: () => cy.get('#editRkaForm'),
    editSubmit: () => cy.get('#updateRkaBtn'),
    toggleModal: () => cy.get('#toggleStatusModal'),
    toggleMessage: () => cy.get('#toggleStatusMessage'),
    toggleConfirm: () => cy.get('#confirmToggleStatus'),
    toggleCancel: () => cy.get('#toggleStatusModal .modal-footer button[data-dismiss="modal"]'),
    deleteModal: () => cy.get('#deleteRkaModal'),
    deleteConfirm: () => cy.get('#confirmDeleteRka'),
    deleteCancel: () => cy.get('#deleteRkaModal .modal-footer button[data-dismiss="modal"]'),
    weightModal: () => cy.get('#rkaWeightModal'),
    weightTitle: () => cy.get('#rkaWeightModalLabel'),
    weightInputs: () => cy.get('#rkaWeightModal .weight-input'),
    weightTotal: () => cy.get('#weightPercentageText'),
    weightHelp: () => cy.get('#weightProgressHelp'),
    weightSave: () => cy.get('#saveWeightBtn'),
    // --- Tab Account Officer ---
    addOfficerBtn: () => cy.get('#btnAddOfficer'),
    officerModal: () => cy.get('#modalOfficer'),
    officerModalTitle: () => cy.get('#modalOfficerTitle'),
    officerName: () => cy.get('#officer_name'),
    officerEmail: () => cy.get('#officer_email'),
    officerPhone: () => cy.get('#officer_phone'),
    officerStatus: () => cy.get('#officer_status'),
    officerSave: () => cy.get('#btnSaveOfficer'),
    officersTable: () => cy.get('#tableOfficers'),
    officerBtn: (cls, id) => cy.get(`#tableOfficers .${cls}[data-id="${id}"]`),
    assignModal: () => cy.get('#modalAssignOffices'),
    assignSelect: () => cy.get('#assigned_offices'),
    assignSave: () => cy.get('#btnSaveAssignments'),
    currentAssignBody: () => cy.get('#tableCurrentAssignments tbody'),
    // bootstrap-sweetalert (v1)
    swal: () => cy.get('.sweet-alert:visible'),
    swalTitle: () => cy.get('.sweet-alert:visible h2'),
    swalText: () => cy.get('.sweet-alert:visible p').first(),
    swalConfirm: () => cy.get('.sweet-alert:visible button.confirm'),
  };

  /** Buka halaman (opsional ?menu=...) lalu pastikan akun punya akses. */
  visit(menu) {
    this.open(menu ? `${this.path}?menu=${menu}` : this.path);
    return this.assertAccessible();
  }

  /**
   * Precondition role: menu RKA hanya tampil untuk supervisor/super-admin
   * (navigation.blade.php:451). Bila akses ditolak, controller tidak merender form.
   */
  assertAccessible() {
    this.assertNotRedirectedToLogin();
    cy.get('body').should(($b) => {
      expect(
        $b.find('#form_rka_ao').length,
        'Form RKA Account Officer tidak tampil — akun test kemungkinan bukan supervisor/super-admin (butuh akses menu RKA)',
      ).to.be.greaterThan(0);
    });
    return this;
  }

  // ---------------- Form target ----------------
  selectOfficer(name) {
    this.elements.aoSelect().select(name, { force: true });
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

  /** Isi ulang semua baris di modal Edit RKA (#editRkaForm). */
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

  // ---------------- Daftar RKA ----------------
  rows() {
    return readTableRows('#sample_1');
  }

  /** Baris daftar RKA yang kolom "Nama Account Officer"-nya PERSIS = name. */
  rowsByName(name) {
    return this.rows().then((rows) => rows.filter((r) => r.cells[1] === name));
  }

  /** Filter DataTables lewat kotak pencarian supaya baris target tampil di halaman 1. */
  searchList(text) {
    this.elements.listSearch().clear().type(text);
    return this;
  }

  clickRowAction(cls, id) {
    this.elements.rowBtn(cls, id).should('be.visible').click();
    return this;
  }

  // ---------------- Bobot ----------------
  setWeights(values) {
    setWeights(values);
    return this;
  }

  // ---------------- Account Officer tab ----------------
  /** Urutkan tabel officer berdasarkan Code menurun → officer terbaru di halaman 1. */
  sortOfficersNewestFirst() {
    cy.get('#tableOfficers thead th').contains(/^Code$/).click();
    cy.wait('@officersTable');
    return this;
  }

  // =====================================================================
  // Seed & cleanup via HTTP (cy.request) — hanya untuk data milik test (nama QA...).
  // cy.request TIDAK melewati cy.intercept, jadi tidak terhitung oleh guardWrites.
  // =====================================================================

  /** Buat Account Officer QA lewat endpoint yang sama dengan modal (POST officers.store). */
  seedOfficer(name, email) {
    this.open(this.path);
    return csrfToken().then((token) => cy.request({
      method: 'POST',
      url: '/rka/accountofficer/officers',
      form: true,
      headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
      body: { _token: token, name, email, status: 'active' },
    }).then((res) => {
      expect(res.status, 'seed Account Officer').to.eq(200);
      return res.body.data.id;
    }));
  }

  /** Seed target RKA (POST rka.accountofficer.target) dengan nilai sama di semua baris. */
  seedTarget(officerId, year, data) {
    this.open(this.path);
    return buildTargetBody('#form_rka_ao', data, { account_officer_id: officerId, year }).then((body) => cy.request({
      method: 'POST', url: '/rka/accountofficer/target', form: true, body, followRedirect: false,
    }).then((res) => expect(res.status, 'seed target RKA AO (redirect)').to.eq(302)));
  }

  /** Id rka_entity milik officer `name` (kolom Nama Account Officer, persis). */
  entityIdsByName(name) {
    this.open(this.path);
    return this.rowsByName(name).then((rows) => rows.map((r) => r.id).filter(Boolean));
  }

  entityId(name) {
    return this.entityIdsByName(name).then((ids) => {
      expect(ids, `rka_entity untuk ${name}`).to.have.length(1);
      return ids[0];
    });
  }

  toggleViaApi(entityId, status) {
    return csrfToken().then((token) => cy.request({
      method: 'POST', url: `/rka/accountofficer/${entityId}/toggle-status`, form: true,
      headers: { 'X-CSRF-TOKEN': token }, body: { status },
    }).its('body.success').should('eq', true));
  }

  /** Simpan bobot via API (dipakai untuk setup laporan). Bobot dibagi bulat total 100. */
  weightViaApi(entityId, splitFn) {
    return cy.request(`/rka/accountofficer/${entityId}/weight`).then((res) => {
      const items = [...res.body.data.loans, ...res.body.data.savings, ...res.body.data.others];
      const values = splitFn(items.length);
      const weights = items.map((it, i) => ({ product_id: it.product_id, parameter_id: it.parameter_id, weight: values[i] }));
      return csrfToken().then((token) => cy.request({
        method: 'POST', url: '/rka/accountofficer/weight/save',
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: { rka_entity_id: entityId, weights },
      }).then((r) => {
        expect(r.body.success, 'simpan bobot via API').to.eq(true);
        return { count: items.length, values };
      }));
    });
  }

  /** Tugaskan kantor pertama yang tersedia ke officer QA. Mengembalikan nama kantor. */
  assignFirstOfficeViaApi(officerId) {
    return cy.request(`/rka/accountofficer/officers/offices/list?officer_id=${officerId}`).then((res) => {
      const office = res.body.offices[0];
      expect(office, 'minimal ada 1 kantor ACTIVE untuk penugasan').to.exist;
      return csrfToken().then((token) => cy.request({
        method: 'POST', url: '/rka/accountofficer/officers/assign', form: true,
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: { _token: token, account_officer_id: officerId, 'office_ids[]': office.id },
      }).then(() => office.name));
    });
  }

  /**
   * CLEANUP column-scoped: hapus semua rka_entity yang kolom "Nama Account Officer"
   * PERSIS = name (name wajib diawali "QA"), lalu (opsional) hapus officer-nya.
   */
  cleanup(name, officerId) {
    if (!name || !String(name).startsWith('QA')) return this;
    this.entityIdsByName(name).then((ids) => {
      csrfToken().then((token) => {
        ids.forEach((id) => {
          cy.request({
            method: 'DELETE', url: `/rka/accountofficer/${id}`, headers: { 'X-CSRF-TOKEN': token },
            failOnStatusCode: false,
          });
        });
        if (officerId) {
          cy.request({
            url: `/rka/accountofficer/officers/${officerId}/assignments`, failOnStatusCode: false,
          }).then((res) => {
            const list = (res.body && res.body.data) || [];
            list.forEach((a) => cy.request({
              method: 'DELETE', url: `/rka/accountofficer/officers/assignments/${a.id}`,
              headers: { 'X-CSRF-TOKEN': token }, failOnStatusCode: false,
            }));
          });
          cy.request({
            method: 'DELETE', url: `/rka/accountofficer/officers/${officerId}`,
            headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' }, failOnStatusCode: false,
          });
        }
      });
    });
    return this;
  }

  /** Detail entity via endpoint GET (read-only) — untuk verifikasi hasil edit. */
  details(entityId) {
    return cy.request(`/rka/accountofficer/${entityId}/details`).its('body');
  }

  text($el) {
    return normText($el.text());
  }
}

export default new RkaAccountOfficerPage();
