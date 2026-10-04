// ApprovalPage — halaman /approval (ApprovalController@index).
//
// Sumber markup (origin/develop):
//   resources/views/approval/index.blade.php           — nav-pills 5 tab + script DataTables
//   resources/views/approval/customerapproval.blade.php — tab "Pembukuan"   (#data-table-customer)
//   resources/views/approval/officeapproval.blade.php   — tab "Transaksi"   (#data-table-office)
//   resources/views/approval/onlineapproval.blade.php   — tab "Pengajuan Online" (#data-table-online)
//   resources/views/approval/loanadjustmentapproval.blade.php  — tab "Penyesuaian Pinjaman"
//   resources/views/approval/loanstatuschangeapproval.blade.php — tab "Perubahan Status Pinjaman"
//
// Kelima tabel di-init SEKALIGUS saat halaman dimuat (semua tab ada di DOM),
// masing-masing memanggil endpoint GET sendiri. Tab aktif dipilih server lewat
// query `?menu=<id tab>`.
//
// Approve/Reject = modal Bootstrap berisi form POST (PIN + alasan), BUKAN
// window.confirm(). "Batal" = button[data-dismiss=modal].

import BasePage from '../BasePage';

const text = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');

class ApprovalPage extends BasePage {
  elements = {
    pills: () => cy.get('ul.nav.nav-pills'),
    tabLink: (menu) => cy.get(`ul.nav-pills a[href="#${menu}"]`),
    tabItem: (menu) => cy.get(`ul.nav-pills a[href="#${menu}"]`).parent('li'),
    pane: (paneSel) => cy.get(paneSel),
    toolbar: (paneSel) => cy.get(`${paneSel} .table-toolbar`),
    sidebarTitles: () => cy.get('ul.page-sidebar-menu span.title'),
    username: () => cy.get('.dropdown-user span.username').first(),
    modal: (modalSel) => cy.get(modalSel),
    modalTitle: (modalSel) => cy.get(`${modalSel} .modal-title`),
    modalPin: (modalSel) => cy.get(`${modalSel} input[name="pin"]`),
    modalNotes: (modalSel) => cy.get(`${modalSel} input[name="notes"]`),
    modalSubmit: (modalSel) => cy.get(`${modalSel} button[type="submit"]`),
    modalCancel: (modalSel) => cy.get(`${modalSel} .modal-footer button[data-dismiss="modal"]`),
    modalForm: (modalSel) => cy.get(`${modalSel} form`),
    excelButton: (paneSel) => cy.get(`${paneSel} .buttons-excel`),
  };

  // ---------------------------------------------------------------------
  // Navigasi
  // ---------------------------------------------------------------------

  /** Daftarkan alias intercept untuk endpoint data kelima tab: @data_<key>. */
  interceptTables(fx) {
    Object.entries(fx.tabs).forEach(([key, tab]) => {
      cy.intercept({ method: 'GET', pathname: tab.data }).as(`data_${key}`);
    });
    return this;
  }

  /**
   * Buka /approval?menu=<tab> lalu tunggu request data tab itu + tabel selesai.
   * Intercept didaftarkan SEBELUM visit (semua tabel memuat saat load).
   */
  openTab(fx, key) {
    const tab = fx.tabs[key];
    this.interceptTables(fx);
    this.open(`${fx.path}?menu=${tab.menu}`);
    this.assertNotRedirectedToLogin().assertUrl(fx.path);
    cy.wait(`@data_${key}`, { timeout: fx.timeout.table })
      .its('response.statusCode')
      .should('eq', 200);
    this.waitTable(tab.table, fx.timeout.table);
    return this;
  }

  /** Tab aktif = <li class="active"> + pane .active. */
  assertActiveTab(tab) {
    this.elements.tabItem(tab.menu).should('have.class', 'active');
    this.elements.pane(tab.pane).should('have.class', 'active');
    return this;
  }

  // ---------------------------------------------------------------------
  // Prasyarat role
  // ---------------------------------------------------------------------

  /**
   * Akun test harus super-admin (tombol approve Penyesuaian hanya untuk
   * super-admin; ApprovalController@indexDataLoanAdjustment). Bukti di DOM:
   * menu sidebar khusus super-admin (navigation.blade.php: Karyawan/Kantor/Produk).
   */
  assertSuperAdmin(fx) {
    this.elements.sidebarTitles().should(($t) => {
      const titles = Cypress.$.makeArray($t).map(text);
      expect(
        titles.includes(fx.page.superAdminOnlyMenu),
        `PRASYARAT: akun test harus super-admin (menu sidebar "${fx.page.superAdminOnlyMenu}" tidak ditemukan) — butuh akun super-admin`,
      ).to.eq(true);
    });
    return this;
  }

  /** Nama user login (teks node pertama span.username di header). */
  currentUserName() {
    return this.elements.username().then(($s) => {
      const first = Cypress.$.makeArray($s[0].childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
      return cy.then(() => (first ? first.textContent.replace(/\s+/g, ' ').trim() : ''));
    });
  }

  /** PIN approver HANYA dari --env approvalPin (tidak pernah dari fixture). */
  requirePin() {
    const pin = Cypress.env('approvalPin');
    if (pin === undefined || pin === null || String(pin) === '') {
      throw new Error('PRASYARAT: jalankan dengan --env approvalPin=<PIN akun test> (PIN tidak disimpan di repo)');
    }
    return String(pin);
  }

  // ---------------------------------------------------------------------
  // Tabel
  // ---------------------------------------------------------------------

  /** Baca seluruh baris data (tanpa empty-state) jadi array of array teks sel. */
  readRows(tableSel) {
    return cy.get(`${tableSel} tbody tr`).then(($rows) => {
      const rows = Cypress.$.makeArray($rows)
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
        .map((r) => Cypress.$(r).find('td').toArray().map(text));
      return cy.then(() => rows);
    });
  }

  /** Index baris data (DOM order) pertama yang memenuhi predicate(cells, $row). -1 jika tidak ada. */
  findRowIndex(tableSel, predicate) {
    return cy.get(`${tableSel} tbody tr`).then(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
      const idx = data.findIndex((r) => predicate(Cypress.$(r).find('td').toArray().map(text), Cypress.$(r)));
      return cy.then(() => idx);
    });
  }

  dataRow(tableSel, idx) {
    return this.dataRows(tableSel).eq(idx);
  }

  /**
   * Tunggu request alias yang URL-nya memenuhi predicate (DataTables bisa
   * mengirim beberapa request berturut-turut, mis. saat mengetik pencarian).
   */
  waitForRequest(alias, predicate, timeout = 30000, attempt = 0) {
    return cy.wait(alias, { timeout }).then((i) => {
      const url = decodeURIComponent(i.request.url).replace(/\+/g, ' ');
      if (predicate(url)) {
        expect(i.response && i.response.statusCode, `status ${alias}`).to.eq(200);
        return cy.then(() => i);
      }
      if (attempt > 10) throw new Error(`request ${alias} yang sesuai tidak ditemukan`);
      return this.waitForRequest(alias, predicate, timeout, attempt + 1);
    });
  }

  /** Ganti filter <select> (select2me tetap <select> asli; handler jQuery 'change' menerima event native). */
  applyFilter(fx, key, filterSel, value, param) {
    const tab = fx.tabs[key];
    cy.get(filterSel).select(String(value), { force: true });
    const re = new RegExp(`[?&]${param}=${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(&|$)`);
    this.waitForRequest(`@data_${key}`, (url) => re.test(url), fx.timeout.table);
    this.waitTable(tab.table, fx.timeout.table);
    return this;
  }

  /** Pencarian DataTables: set value sekali + 1 event keyup (hindari request per karakter). */
  search(fx, key, term) {
    const tab = fx.tabs[key];
    this.tableSearch(tab.table).invoke('val', term).trigger('keyup');
    this.waitForRequest(`@data_${key}`, (url) => url.includes(`search[value]=${term}`), fx.timeout.table);
    this.waitTable(tab.table, fx.timeout.table);
    return this;
  }

  /**
   * Assert sel aksi tiap baris berstatus `statusLabel`:
   *   expectButtons=true  → ada tombol Disetujui & Ditolak + link Lihat
   *   expectButtons=false → hanya link Lihat, tanpa tombol
   */
  assertActionsForStatus(fx, tableSel, cols, statusLabel, expectButtons) {
    cy.get(`${tableSel} tbody tr`).should(($rows) => {
      const data = Cypress.$.makeArray($rows).filter((r) => !Cypress.$(r).find('td.dataTables_empty').length);
      data.forEach((r) => {
        const $td = Cypress.$(r).find('td');
        const st = text($td.get(cols.status));
        if (!st.startsWith(statusLabel)) return;
        const $aksi = Cypress.$($td.get(cols.aksi));
        const btns = $aksi.find('button').toArray().map(text);
        const lihat = $aksi.find('a').toArray().map(text);
        expect(lihat, `link "${fx.buttons.view}" pada baris status ${st}`).to.include(fx.buttons.view);
        if (expectButtons) {
          expect(btns, `tombol pada baris ${st}`).to.include.members([fx.buttons.approve, fx.buttons.reject]);
        } else {
          expect(btns, `tidak boleh ada tombol approve/reject pada baris ${st}`).to.have.length(0);
        }
      });
    });
    return this;
  }

  // ---------------------------------------------------------------------
  // Modal approve/reject
  // ---------------------------------------------------------------------

  /** Klik tombol (Disetujui/Ditolak) di baris data ke-idx. */
  clickRowButton(tableSel, idx, label) {
    this.dataRow(tableSel, idx).find('button').contains(label).click();
    return this;
  }

  /** Ambil id pengajuan dari atribut onClick tombol, mis. setApprovedAdjustmentId('12'). */
  rowApprovalId(tableSel, idx, label) {
    return this.dataRow(tableSel, idx)
      .find('button')
      .contains(label)
      .closest('button')
      .invoke('attr', 'onclick')
      .then((attr) => {
        const m = String(attr || '').match(/\('([^']+)'\)/);
        return cy.then(() => (m ? m[1] : ''));
      });
  }

  assertModalOpen(modal) {
    this.elements.modal(modal.id).should('be.visible').and('have.class', 'in');
    this.elements.modalTitle(modal.id).should('contain.text', modal.title);
    return this;
  }

  assertModalClosed(modal) {
    this.elements.modal(modal.id).should('not.be.visible');
    return this;
  }

  cancelModal(modal) {
    this.elements.modalCancel(modal.id).click();
    return this.assertModalClosed(modal);
  }

  /**
   * Buka modal tanpa lewat baris tabel, dengan id pengajuan diisi manual.
   * Dipakai untuk uji validasi server dengan id yang PASTI tidak ada (0).
   */
  openModalWithId(modal, id) {
    cy.window().then((win) => {
      win.$(modal.hiddenId).val(id);
      win.$(modal.id).modal('show');
    });
    this.elements.modal(modal.id).should('be.visible');
    cy.get(modal.hiddenId).should('have.value', String(id));
    return this;
  }

  fillModal(modal, { pin, notes } = {}) {
    if (pin !== undefined) this.elements.modalPin(modal.id).clear().type(pin, { log: false });
    if (notes !== undefined) this.elements.modalNotes(modal.id).clear().type(notes);
    return this;
  }

  submitModal(modal) {
    this.elements.modalSubmit(modal.id).click();
    return this;
  }
}

export default new ApprovalPage();
