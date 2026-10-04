// rkaShared.js — helper khusus modul RKA (form target KPI, tabel daftar RKA,
// bobot, CSRF). Dipakai RkaAccountOfficerPage & RkaUnitPage.
//
// Sumber markup: resources/views/rka/accountofficer/tabs/rka-management.blade.php
// dan resources/views/rka/unit/index.blade.php (origin/develop).
//
// Catatan desain:
// - Form target punya 3 tab (Pinjaman/Simpanan/Lainnya). Tab kedua & ketiga
//   dikunci (pointer-events:none) sampai tab sebelumnya lengkap. Input di tab
//   tersembunyi tidak bisa diketik Cypress, jadi nilai diisi langsung ke DOM
//   lalu dipicu event NATIVE `input` + `change` (bubbling) — handler jQuery
//   aplikasi (delegated di document / #editRkaForm) ikut terpanggil sehingga
//   kalkulasi "Target Tahun Ini" & status tab berjalan seperti diketik user.
// - Tabel "Daftar RKA" (#sample_1) = DataTables client-side (pageLength 10).
//   Baris di halaman lain DILEPAS dari DOM, jadi pembacaan baris memakai
//   DataTable API milik aplikasi (rows().nodes()).

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

const setNative = (el, value) => {
  // eslint-disable-next-line no-param-reassign
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

/** Hitung target tahun ini persis seperti calculateTarget() di blade. */
export const calcTarget = ({ type, lastYear, percentage }) => {
  const last = Number(lastYear) || 0;
  const pct = Number(percentage) || 0;
  if (last === 0 || !type) return 0;
  if (pct === 0) return last;
  if (pct < 0) return 0;
  return Math.round(type === 'kenaikan' ? last + (last * pct) / 100 : last - (last * pct) / 100);
};

/**
 * Isi semua baris form target (select jenis target, target tahun lalu, persentase).
 * @param {string} formSel  '#form_rka_ao' (form utama) atau '#editRkaForm' (modal edit)
 * @param {object} data     { type, lastYear, percentage }
 * @param {object} opts     { only: ['pinjaman','simpanan','lainnya'], firstRowOnly: { percentage } }
 */
export const fillTargetForm = (formSel, data, { only, overrideFirst } = {}) => {
  cy.get(`${formSel} tbody tr`).should('have.length.greaterThan', 0).then(($rows) => {
    let first = true;
    $rows.each((_, tr) => {
      const pane = tr.closest('.tab-pane');
      const paneId = pane ? pane.id.replace(/^edit-/, '') : '';
      if (only && !only.includes(paneId)) return;
      const sel = tr.querySelector('select.target-type-select');
      const last = tr.querySelector('input.target-input');
      const pct = tr.querySelector('input.percentage-input');
      if (!sel || !last || !pct) return;
      const row = first && overrideFirst ? { ...data, ...overrideFirst } : data;
      first = false;
      setNative(sel, row.type);
      setNative(last, String(row.lastYear));
      setNative(pct, String(row.percentage));
    });
  });
};

/** Jumlah baris produk (Pinjaman + Simpanan) di form target. */
export const countProductRows = (formSel) =>
  cy.get(formSel).then(($f) => $f.find('#pinjaman tbody tr, #simpanan tbody tr').length);

/** Bangun body POST target dari nama field di DOM form (untuk seed via cy.request). */
export const buildTargetBody = (formSel, data, extra) =>
  cy.get(formSel).then(($f) => {
    const body = { _token: $f.find('input[name="_token"]').val(), ...extra };
    const result = calcTarget(data);
    $f.find('tbody tr').each((_, tr) => {
      const sel = tr.querySelector('select.target-type-select');
      const last = tr.querySelector('input.target-input');
      const pct = tr.querySelector('input.percentage-input');
      const res = tr.querySelector('input.target-result');
      if (!sel || !last || !pct || !res) return;
      body[sel.name] = data.type;
      body[last.name] = data.lastYear;
      body[pct.name] = data.percentage;
      body[res.name] = result;
    });
    return body;
  });

/**
 * Baca SEMUA baris tabel daftar RKA (termasuk yang di halaman lain DataTables).
 * Hasil: [{ id, cells: [teks kolom...] }] — baris empty-state dibuang.
 */
export const readTableRows = (tableSel = '#sample_1') =>
  cy.window({ log: false }).then((win) => {
    const $ = win.jQuery;
    const isDt = $ && $.fn.DataTable && $.fn.DataTable.isDataTable(tableSel);
    const nodes = isDt
      ? $(tableSel).DataTable().rows().nodes().toArray()
      : Cypress.$(`${tableSel} tbody tr`).toArray();
    return nodes
      .map((tr) => {
        const tds = Array.from(tr.querySelectorAll(':scope > td'));
        const del = tr.querySelector('.delete-rka');
        return { id: del ? String(del.getAttribute('data-id')) : '', cells: tds.map((td) => norm(td.textContent)) };
      })
      .filter((r) => r.cells.length > 1);
  });

/** Ambil token CSRF dari <meta name="csrf-token"> (layout navigation.blade.php). */
export const csrfToken = () => cy.get('meta[name="csrf-token"]', { log: false }).invoke('attr', 'content');

/** Bagi 100 ke n bobot BULAT (sisa ke elemen terakhir) — total pasti tepat 100. */
export const splitWeights = (n, total = 100) => {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const arr = Array(n).fill(base);
  arr[n - 1] = total - base * (n - 1);
  return arr;
};

/** Isi input bobot di modal (#rkaWeightModal .weight-input) secara berurutan. */
export const setWeights = (values) =>
  cy.get('#rkaWeightModal .weight-input').then(($inputs) => {
    $inputs.each((i, el) => setNative(el, String(values[i] != null ? values[i] : 0)));
  });

export const normText = norm;
