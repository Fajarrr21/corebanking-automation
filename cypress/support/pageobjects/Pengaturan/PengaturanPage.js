// PengaturanPage — /setting (satu halaman, 10 tab nav-pills; tab aktif dari query ?menu=<key>).
//
// Sumber markup (origin/develop): resources/views/setting/index.blade.php + partial
//   fee, collectibilities, tax, journal, level_approval, due_date, sub_account,
//   teller_balance, employee_balance, signature (.blade.php).
// Otorisasi: SettingController::__construct → hanya super-admin.
//
// ⚠️ Banyak input ber-name sama di beberapa form (mis. name="name" di form jurnal, tanda tangan,
// sub account). Selalu scope lewat `form[action$="<path>"]` — action = URL absolut dari route().
//
// Helper request (cy.request — TIDAK lewat cy.intercept/guardWrites) dipakai untuk capture nilai
// asli & restore pengaturan global, serta cleanup data QA. Token CSRF diambil dari <meta name="csrf-token">.

import BasePage from '../BasePage';

class PengaturanPage extends BasePage {
  elements = {
    sidebarMenu: (title) => cy.contains('ul.page-sidebar-menu span.title', title).closest('a'),
    tabLinks: () => cy.get('.page-content ul.nav-pills > li > a'),
    tabLink: (pane) => cy.get(`.page-content ul.nav-pills a[href="${pane}"]`),
    activeTabItems: () => cy.get('.page-content ul.nav-pills > li.active'),
    pane: (pane) => cy.get(pane),
    form: (path) => cy.get(`form[action$="${path}"]`),
    field: (path, name) => cy.get(`form[action$="${path}"] [name="${name}"]`),
    submit: (path) => cy.get(`form[action$="${path}"] button[type="submit"]`),
  };

  /** Daftarkan pengabaian error JS yang SUDAH dikenal (kandidat bug) agar test lain tetap bisa berjalan. */
  ignoreKnownJsErrors(patterns) {
    const res = patterns.map((p) => new RegExp(p));
    cy.on('uncaught:exception', (err) => {
      if (res.some((re) => re.test(err.message))) return false;
      return undefined;
    });
    return this;
  }

  openSetting(menu) {
    this.open(menu ? `/setting?menu=${menu}` : '/setting');
    this.assertNotRedirectedToLogin();
    this.assertBreadcrumb('Pengaturan');
    return this;
  }

  assertTabActive(tab) {
    this.elements.tabLink(tab.pane).parent('li').should('have.class', 'active');
    this.elements.pane(tab.pane).should('have.class', 'active').and('be.visible');
    return this;
  }

  /** Field pertama yang invalid menurut constraint validation browser (atau null). */
  firstInvalidName(path) {
    return this.elements.form(path).then(($f) => {
      const bad = Cypress.$($f).find(':input').toArray().find((el) => el.willValidate && !el.checkValidity());
      return cy.then(() => (bad ? bad.name : null));
    });
  }

  /** Semua baris tabel (lintas halaman bila DataTables), sebagai array of string[] per sel. */
  allRows(tableSel) {
    return cy.window().then((win) => {
      const $ = win.jQuery;
      const rows = $ && $.fn && $.fn.dataTable && $.fn.dataTable.isDataTable(tableSel)
        ? $(tableSel).DataTable().rows().nodes().toArray()
        : Cypress.$(`${tableSel} tbody tr`).toArray();
      const out = rows
        .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length && Cypress.$(r).find('td').length > 1)
        .map((r) => Cypress.$(r).find('td').toArray().map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
      return cy.then(() => out);
    });
  }

  /** Ketik di kotak search DataTables tabel (kalau ada). */
  search(tableSel, text) {
    const id = tableSel.replace('#', '');
    cy.get('body').then(($b) => {
      if ($b.find(`#${id}_filter input`).length) cy.get(`#${id}_filter input`).clear().type(text);
    });
    return this;
  }

  /** Baris tabel yang KOLOM `colIdx`-nya persis `text` (column-scoped). */
  rowWhereColumn(tableSel, colIdx, text) {
    return cy.get(`${tableSel} tbody tr`).filter((i, tr) => (
      Cypress.$(tr).find('td').eq(colIdx).text().replace(/\s+/g, ' ').trim() === text
    ));
  }

  // -------------------------------------------------------------------------
  // cy.request helpers
  // -------------------------------------------------------------------------

  /** GET halaman lalu parse ke Document (DOMParser — script tidak dieksekusi). */
  fetchDoc(path) {
    return cy.request({ url: path, failOnStatusCode: true }).then((res) => {
      const doc = new DOMParser().parseFromString(res.body, 'text/html');
      return cy.then(() => doc);
    });
  }

  csrf(doc) {
    const meta = doc.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute('content');
    const inp = doc.querySelector('input[name="_token"]');
    return inp ? inp.value : '';
  }

  /** POST form-urlencoded dengan token CSRF segar. Mengembalikan response (setelah redirect). */
  postForm(path, body) {
    return this.fetchDoc('/setting').then((doc) => cy.request({
      method: 'POST',
      url: path,
      form: true,
      body: { _token: this.csrf(doc), ...body },
      failOnStatusCode: false,
    }));
  }

  /** Nilai input/select di dalam form tertentu dari Document hasil fetchDoc. */
  readFormValues(doc, path, names) {
    const form = Cypress.$(doc).find(`form[action$="${path}"]`);
    const out = {};
    names.forEach((n) => {
      const el = form.find(`[name="${n}"]`)[0];
      if (!el) {
        out[n] = undefined;
      } else if (el.tagName === 'SELECT') {
        const sel = Cypress.$(el).find('option[selected]')[0];
        out[n] = sel ? sel.value : '';
      } else {
        out[n] = (el.getAttribute('value') || '').trim();
      }
    });
    return out;
  }

  /** Capture nilai asli pengaturan global (fee / tax). Gagal jelas bila nilai belum pernah diset. */
  capture(menu, path, names) {
    return this.fetchDoc(`/setting?menu=${menu}`).then((doc) => {
      const v = this.readFormValues(doc, path, names);
      Object.entries(v).forEach(([k, val]) => {
        expect(val, `precondition: nilai asli ${k} terisi (restore harus bisa dijamin)`).to.match(/^-?[\w.]+$/);
        expect(val, `precondition: nilai asli ${k} bukan placeholder '-'`).to.not.eq('-');
      });
      return cy.then(() => v);
    });
  }

  /** Restore nilai asli lalu verifikasi ulang. */
  restore(menu, path, original) {
    this.postForm(path, original).its('status').should('eq', 200);
    this.fetchDoc(`/setting?menu=${menu}`).then((doc) => {
      const now = this.readFormValues(doc, path, Object.keys(original));
      Object.keys(original).forEach((k) => {
        const a = String(original[k]);
        const b = String(now[k]);
        const same = a === b || (Number.isFinite(Number(a)) && Number(a) === Number(b));
        expect(same, `restore ${k}: ${b} == ${a}`).to.eq(true);
      });
    });
    return this;
  }

  /**
   * Hapus data QA lewat endpoint delete. `rows` diambil dari tabel di Document; hanya baris yang
   * kolom nama-nya persis salah satu `names` (dan diawali "QA") yang dihapus.
   */
  cleanupByName({ menu, tableSel, nameCol, names, idFromRow, deletePath, idField }) {
    const targets = names.filter((n) => /^QA/.test(n));
    if (!targets.length) return this;
    this.fetchDoc(`/setting?menu=${menu}`).then((doc) => {
      const rows = Cypress.$(doc).find(`${tableSel} tbody tr`).toArray();
      rows.forEach((tr) => {
        const name = Cypress.$(tr).find('td').eq(nameCol).text().replace(/\s+/g, ' ').trim();
        if (!targets.includes(name)) return;
        const id = idFromRow(tr);
        if (id) this.postForm(deletePath, { [idField]: id });
      });
    });
    return this;
  }

  journalIdFromRow(tr) {
    const btn = Cypress.$(tr).find('button[onclick^="setDeleteJournal"]').attr('onclick') || '';
    const m = btn.match(/setDeleteJournal\('(\d+)'/);
    return m ? m[1] : null;
  }

  signatureIdFromRow(tr) {
    const btn = Cypress.$(tr).find('button[onclick^="setDeleteSignature"]').attr('onclick') || '';
    const m = btn.match(/setDeleteSignature\('(\d+)'/);
    return m ? m[1] : null;
  }

  /** Opsi pertama sebuah select di form tertentu (value) dari Document. */
  firstOptionValue(doc, path, name) {
    const o = Cypress.$(doc).find(`form[action$="${path}"] select[name="${name}"] option`).toArray()
      .find((x) => x.value && !x.disabled);
    return o ? o.value : null;
  }
}

export default new PengaturanPage();
