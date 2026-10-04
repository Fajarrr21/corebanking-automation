// DownloadPage — menu Download (/downloads): daftar file hasil export antrean (queue).
//
// Sumber: resources/views/downloads/index.blade.php, DownloadController (origin/develop).
// - Tabel #data-table2 = DataTables CLIENT-SIDE (default urut kolom ID naik,
//   10 baris/halaman) → baris lain ada di API DataTables, tidak di DOM. Helper
//   `allRows()` membaca SEMUA baris lewat `DataTable().rows().nodes()`.
// - Kolom: ID | File | Dibuat | Oleh | Prompt | Jadwal Hapus | Status.
//   File berstatus DONE = <a href="/downloads/{id}/file">; selain itu teks biasa.
//   Status: SCHEDULED → "Processing" (+ .blob), DONE → "Selesai", lainnya → "Gagal".
// - Halaman auto-reload tiap 10 detik bila ada baris Processing.
// - User pusat (office_id 0) melihat download SEMUA user.

import BasePage from '../BasePage';

const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

class DownloadPage extends BasePage {
  elements = {
    note: () => cy.get('.note.note-info'),
    table: () => cy.get('#data-table2'),
    rows: () => cy.get('#data-table2 tbody tr'),
    searchBox: () => cy.get('#data-table2_filter input'),
    errorModal: () => cy.get('#modalErrorDetail'),
  };

  visit(fx) {
    return this.open(fx.path);
  }

  /** Semua baris tabel (termasuk halaman lain DataTables) → array objek kolom. */
  allRows(fx) {
    this.elements.table().should('exist');
    return cy.window().then((win) => {
      const $ = win.$ || win.jQuery;
      const k = fx.kolom;
      let nodes;
      if ($ && $.fn && $.fn.dataTable && $.fn.dataTable.isDataTable('#data-table2')) {
        nodes = $('#data-table2').DataTable().rows().nodes().toArray();
      } else {
        nodes = Array.from(win.document.querySelectorAll('#data-table2 tbody tr'));
      }
      return nodes
        .map((tr) => {
          const td = tr.querySelectorAll('td');
          if (td.length < 7) return null; // baris "Data Tidak Ada" (colspan)
          const a = td[k.file].querySelector('a');
          return {
            id: txt(td[k.id]),
            file: txt(td[k.file]),
            href: a ? a.getAttribute('href') : null,
            dibuat: txt(td[k.dibuat]),
            oleh: txt(td[k.oleh]),
            prompt: txt(td[k.prompt]),
            jadwalHapus: txt(td[k.jadwalHapus]),
            status: txt(td[k.status]).replace(/\s*lihat detail\s*$/i, '').trim(),
          };
        })
        .filter(Boolean);
    });
  }

  /**
   * Tunggu baris file `fileName` berstatus `status` (mis. "Selesai"). Tidak memakai
   * wait angka: halaman sendiri reload tiap 10 detik selama ada baris Processing,
   * dan `.should` me-retry query sampai `timeout`. Yield objek baris.
   */
  waitStatus(fx, fileName, status, timeout) {
    let found = null;
    cy.get('#data-table2', { timeout }).should(($t) => {
      const win = $t[0].ownerDocument.defaultView;
      const $ = win.$ || win.jQuery;
      const nodes =
        $ && $.fn && $.fn.dataTable && $.fn.dataTable.isDataTable($t[0])
          ? $($t[0]).DataTable().rows().nodes().toArray()
          : Array.from($t[0].querySelectorAll('tbody tr'));
      const tr = nodes.find((n) => n.textContent.includes(fileName));
      expect(tr, `baris file ${fileName}`).to.exist;
      const td = tr.querySelectorAll('td');
      const st = txt(td[fx.kolom.status]).replace(/\s*lihat detail\s*$/i, '').trim();
      expect(st, `status file ${fileName}`).to.eq(status);
      const a = td[fx.kolom.file].querySelector('a');
      found = { id: txt(td[fx.kolom.id]), file: txt(td[fx.kolom.file]), href: a ? a.getAttribute('href') : null, status: st };
    });
    return cy.then(() => found);
  }

  /** Saring tabel (client-side) dengan teks — dipakai untuk menemukan file tertentu. */
  search(text) {
    this.elements.searchBox().clear().type(text, { delay: 0 });
    return this;
  }

  /** Baris yang mengandung nama file (setelah search). */
  rowByFile(fileName, timeout) {
    return cy.contains('#data-table2 tbody tr', fileName, { timeout });
  }

  /** "dd-mm-yyyy[ HH:MM]" → Date (lokal, jam diabaikan). */
  parseDmy(s) {
    const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s || '');
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  /**
   * Baca baris header (row 1) sheet pertama file xlsx dari body biner (cy.request
   * encoding 'binary'). Memakai JSZip yang dimuat halaman CBS (bundel DataTables
   * Buttons). Mendukung JSZip v2 (sync) & v3 (async). Yield array string.
   */
  readXlsxHeader(binary) {
    return cy.window().then((win) => {
      const JSZip = win.JSZip;
      expect(JSZip, 'JSZip tersedia di halaman (dibutuhkan untuk membaca isi xlsx)').to.exist;
      const parse = (sheetXml, ssXml) => {
        const dp = new win.DOMParser();
        const shared = ssXml
          ? Array.from(dp.parseFromString(ssXml, 'application/xml').getElementsByTagName('si')).map((si) =>
              si.textContent.trim(),
            )
          : [];
        const sheet = dp.parseFromString(sheetXml, 'application/xml');
        const row1 = sheet.getElementsByTagName('row')[0];
        if (!row1) return [];
        return Array.from(row1.getElementsByTagName('c')).map((c) => {
          const t = c.getAttribute('t');
          if (t === 's') {
            const v = c.getElementsByTagName('v')[0];
            return shared[Number(v ? v.textContent : -1)] || '';
          }
          return c.textContent.trim();
        });
      };
      if (typeof JSZip.loadAsync === 'function') {
        const p = JSZip.loadAsync(binary, { binary: true }).then((zip) => {
          const ss = zip.file('xl/sharedStrings.xml');
          return Promise.all([
            zip.file('xl/worksheets/sheet1.xml').async('string'),
            ss ? ss.async('string') : Promise.resolve(''),
          ]).then(([s, sst]) => parse(s, sst));
        });
        return cy.wrap(p, { timeout: 30000 });
      }
      // eslint-disable-next-line new-cap
      const zip = new JSZip(binary, { binary: true });
      const ss = zip.file('xl/sharedStrings.xml');
      return cy.wrap(parse(zip.file('xl/worksheets/sheet1.xml').asText(), ss ? ss.asText() : ''));
    });
  }
}

export default new DownloadPage();
