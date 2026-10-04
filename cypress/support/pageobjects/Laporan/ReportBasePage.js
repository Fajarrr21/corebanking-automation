// ReportBasePage — helper bersama halaman LAPORAN CBS (read-only).
//
// Sumber markup: resources/views/report/** (origin/develop). Pola umum laporan:
//   - DataTables server-side, ajax GET ke `<path>/data?...` (tidak ada POST).
//   - Tombol export = DataTables Buttons HTML5 (`.buttons-csv`, `.buttons-excel`),
//     file dibuat DI BROWSER (Blob + URL.createObjectURL), bukan request server.
//   - Filter tanggal = bootstrap-datepicker pada <input readonly>, perubahan
//     memicu handler jQuery `$('#date').on('change')` yang menggambar ulang tabel.
//
// Helper di sini khusus modul Laporan (tidak ditaruh di commands.js bersama).
// Usulan: `interceptGet`, `spyBlobDownload/lastBlob`, `waitForRequest` layak
// dipindah ke BasePage bila modul lain butuh (lihat laporan akhir).

import BasePage from '../BasePage';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pad = (n) => String(n).padStart(2, '0');

export const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
export const normLower = (s) => norm(s).toLowerCase();

/** Angka dari JSON laporan: float, "1234.50", "" (baris judul) → number (judul = 0). */
export const toNum = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

export default class ReportBasePage extends BasePage {
  // -------------------------------------------------------------------
  // Tanggal (format sama dengan bootstrap-datepicker & PHP date()).
  // -------------------------------------------------------------------
  /** "M - yyyy" → mis. "Oct - 2026" (filter bulan Neraca / Laba Rugi). */
  monthLabel(d) {
    return `${MONTHS[d.getMonth()]} - ${d.getFullYear()}`;
  }

  /** "yyyy-mm-dd" (filter harian Cashflow dsb). */
  ymd(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Tanggal pertama bulan lalu (supaya filter bulan pasti BERBEDA dari default). */
  previousMonth(base = new Date()) {
    return new Date(base.getFullYear(), base.getMonth() - 1, 1);
  }

  daysAgo(n, base = new Date()) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() - n);
  }

  /**
   * Set nilai input datepicker (readonly) lalu picu `change` lewat jQuery halaman —
   * sama dengan yang terjadi saat user memilih tanggal di kalender. Satu kali
   * trigger = satu request (tidak ada double-draw).
   */
  setDateValue(sel, value) {
    cy.get(sel).should('exist');
    cy.window().then((win) => {
      win.$(sel).val(value).trigger('change');
    });
    return this;
  }

  // -------------------------------------------------------------------
  // Network
  // -------------------------------------------------------------------
  /** Intercept GET data laporan. `dataPath` dari fixture, mis. "/sheet-balance/data". */
  interceptGet(dataPath, alias) {
    const re = new RegExp(`${escapeRe(dataPath)}/?(\\?|$)`);
    cy.intercept({ method: 'GET', url: re }).as(alias);
    return this;
  }

  /** Query param dari interception. */
  qp(interception, name) {
    return new URL(interception.request.url).searchParams.get(name);
  }

  /**
   * Tunggu request `alias` yang memenuhi predicate (abaikan request lain, mis.
   * draw awal). Maksimal `max` request diperiksa.
   */
  waitForRequest(alias, predicate, max = 6, timeout = 60000) {
    return cy.wait(`@${alias}`, { timeout }).then((i) => {
      if (predicate(i)) return i;
      if (max <= 1) {
        throw new Error(`Tidak ada request @${alias} yang memenuhi kondisi (terakhir: ${i.request.url})`);
      }
      return this.waitForRequest(alias, predicate, max - 1, timeout);
    });
  }

  /** Response DataTables harus 200 & punya array `data`. Yield body. */
  expectDataTablesOk(interception) {
    expect(interception.response, 'response data laporan').to.exist;
    expect(interception.response.statusCode, 'status data laporan').to.eq(200);
    expect(interception.response.body, 'body DataTables').to.have.property('data');
    expect(interception.response.body.data, 'data[]').to.be.an('array');
    return interception.response.body;
  }

  // -------------------------------------------------------------------
  // Pencarian bawaan DataTables (server-side) — 1 kali trigger = 1 request.
  // -------------------------------------------------------------------
  searchServer(tableSel, keyword) {
    this.tableSearch(tableSel).should('be.visible').invoke('val', keyword).trigger('input');
    return this;
  }

  // -------------------------------------------------------------------
  // Export DataTables Buttons (client-side Blob).
  // -------------------------------------------------------------------
  exportButton(kind) {
    return cy.get(`.dt-buttons .buttons-${kind}`).filter(':visible').first();
  }

  /** Pasang spy pada URL.createObjectURL di window AUT (panggil SETELAH halaman dimuat). */
  spyBlobDownload() {
    cy.window().then((win) => {
      cy.spy(win.URL, 'createObjectURL').as('blobUrl');
    });
    return this;
  }

  clickExport(kind) {
    this.exportButton(kind).should('be.visible').click();
    return this;
  }

  /** Yield Blob terakhir yang dibuat tombol export. */
  lastBlob() {
    return cy
      .get('@blobUrl')
      .should('have.been.called')
      .then((spy) => {
        const blob = spy.lastCall.args[0];
        expect(blob, 'Blob hasil export').to.exist;
        expect(blob.size, 'ukuran file export').to.be.greaterThan(0);
        return blob;
      });
  }

  /** CSV: cek tipe & baris header memuat semua sel yang diharapkan. */
  assertCsvExport(expectedHeaderCells) {
    this.lastBlob().then((blob) => {
      expect(blob.type, 'content-type CSV').to.match(/csv|text/i);
      return cy.wrap(blob.text()).then((text) => {
        const firstLine = String(text).replace(/^﻿/, '').split(/\r?\n/)[0];
        expectedHeaderCells.forEach((h) => {
          expect(firstLine, `header CSV memuat "${h}"`).to.include(h);
        });
      });
    });
    return this;
  }

  /** Excel: Blob xlsx (zip "PK") bertipe spreadsheet. */
  assertExcelExport() {
    this.lastBlob().then((blob) => {
      expect(blob.type, 'content-type Excel').to.match(/spreadsheetml|excel|octet-stream/i);
      return cy.wrap(blob.slice(0, 2).text()).then((magic) => {
        expect(magic, 'signature file xlsx (zip)').to.eq('PK');
      });
    });
    return this;
  }

  // -------------------------------------------------------------------
  // JSON laporan bertingkat (Neraca / Laba Rugi): item + _children.
  // -------------------------------------------------------------------
  flatten(data) {
    const out = [];
    (data || []).forEach((item) => {
      out.push({ name: norm(item.name), norek: norm(item.norek), balance: item.balance, child: false, parent: null });
      (item._children || []).forEach((c) =>
        out.push({ name: norm(c.name), norek: norm(c.norek), balance: c.balance, child: true, parent: norm(item.name) }),
      );
    });
    return out;
  }

  /** Cari baris (case-insensitive, exact setelah normalisasi; `prefix` untuk baris dinamis seperti "NPL - ..."). */
  findRow(rows, name, { prefix = false, childOnly = false, parent = null } = {}) {
    const n = normLower(name);
    return rows.find((r) => {
      if (childOnly && !r.child) return false;
      if (parent && normLower(r.parent) !== normLower(parent)) return false;
      const rn = normLower(r.name);
      return prefix ? rn.startsWith(n) : rn === n;
    });
  }

  /** Nilai baris (top-level) — gagal jelas bila baris tidak ada. */
  valueOf(rows, name) {
    const r = this.findRow(rows.filter((x) => !x.child), name);
    expect(r, `baris "${name}" ada di laporan`).to.exist;
    return toNum(r.balance);
  }

  /** Klik menu sidebar Laporan → submenu (navigasi, bukan visit langsung). */
  openViaSidebar(parentLabel, childHref) {
    cy.contains('ul.page-sidebar-menu span.title', parentLabel).click();
    cy.get(`ul.page-sidebar-menu a[href$="${childHref}"]`).first().click({ force: true });
    cy.location('pathname').should('eq', childHref);
    return this;
  }

  /** Klik tombol "Lihat Detail" pada kartu laporan dengan href tertentu. */
  openCard(href) {
    cy.get(`.page-content a[href="${href}"]`).first().click();
    cy.location('pathname').should('eq', href);
    return this;
  }
}
