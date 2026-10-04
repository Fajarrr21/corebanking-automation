// commands.js — custom command shared lintas modul CBS.
//
// CBS memakai markup Metronic/Bootstrap 3 + jQuery DataTables (bukan
// Radix/shadcn seperti school v3).
//
// ⚠️ File BERSAMA. Jangan menambah command khusus satu modul di sini — taruh
// di page object modul tsb.

// ---------------------------------------------------------------------------
// Write guard — untuk test read-only / negatif.
//
// Semua POST/PUT/PATCH/DELETE ke origin aplikasi dibalas 418 (TIDAK diteruskan
// ke server), lalu `cy.assertNoWritesLeaked()` memastikan tidak ada satu pun
// request tulis yang dikirim. Request pihak ketiga (Google Analytics dll) tidak
// disentuh karena matcher dibatasi ke origin baseUrl.
//
// `allow` = daftar RegExp path yang BOLEH lewat (mis. endpoint POST yang
// sebenarnya hanya membaca data, contoh filter laporan). Request itu
// diteruskan ke server dan tidak dihitung sebagai bocor.
// ---------------------------------------------------------------------------
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
// Login boleh lewat supaya urutan guard vs cy.session tidak jadi jebakan.
const ALWAYS_ALLOW = [/^\/login$/];
// GET yang MENGUBAH data di server (side effect) — selalu diblokir & dihitung bocor.
// Sumber: routes/web.php (origin/develop).
//   /bookkeeping                     → SavingController@bookkeeping menjalankan BookKeepingJob
//   /setting/level_approval/reset    → SettingController@resetLevelApproval menghapus level approval
//   /loan/delete2                    → LoanController@delete menghapus pinjaman + tagihan + transaksi
//   /loan/{refId}/adjustment/reset   → LoanController@adjustmentReset
//   /loan-plan/{id}/cancel           → LoanPlanController@cancel
const DANGEROUS_GETS = [
  /^\/bookkeeping\/?$/,
  /^\/setting\/level_approval\/reset\/?$/,
  /^\/loan\/delete2\/?$/,
  /^\/loan\/[^/]+\/adjustment\/reset\/?$/,
  /^\/loan-plan\/[^/]+\/cancel\/?$/,
];
let blockedWrites = [];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

Cypress.Commands.add('guardWrites', ({ allow = [] } = {}) => {
  blockedWrites = [];
  const origin = new URL(Cypress.config('baseUrl')).origin;
  const urlRe = new RegExp(`^${escapeRe(origin)}/`);
  allow = [...ALWAYS_ALLOW, ...allow];

  cy.intercept({ method: 'GET', url: urlRe }, (req) => {
    const path = new URL(req.url).pathname;
    if (!DANGEROUS_GETS.some((re) => re.test(path))) return;
    blockedWrites.push(`GET ${path}`);
    req.reply({ statusCode: 418, body: 'blocked by cypress write-guard (GET dengan side effect)' });
  });

  WRITE_METHODS.forEach((method) => {
    cy.intercept({ method, url: urlRe }, (req) => {
      const path = new URL(req.url).pathname;
      if (allow.some((re) => re.test(path))) {
        req.continue();
        return;
      }
      blockedWrites.push(`${method} ${path}`);
      req.reply({ statusCode: 418, body: 'blocked by cypress write-guard' });
    }).as(`writeGuard${method}`);
  });
});

Cypress.Commands.add('assertNoWritesLeaked', () => {
  cy.then(() => {
    expect(blockedWrites, 'request tulis yang terkirim (seharusnya kosong)').to.deep.eq([]);
  });
});

/** Ambil daftar request tulis yang terblokir (untuk test negatif yang memang mengharapkan percobaan submit). */
Cypress.Commands.add('blockedWrites', () => cy.then(() => [...blockedWrites]));

// ---------------------------------------------------------------------------
// Data uji yang bisa dikenali (staging dipakai bersama tim lain).
//   nama : QA<timestamp><seq>
//   email: qa+<ts>@example.invalid
// ---------------------------------------------------------------------------
let seq = 0;

Cypress.Commands.add('qaName', (prefix = '') => {
  seq += 1;
  const name = `QA${Date.now()}${seq}${prefix ? ` ${prefix}` : ''}`;
  return cy.wrap(name, { log: false });
});

Cypress.Commands.add('qaEmail', () => {
  seq += 1;
  return cy.wrap(`qa+${Date.now()}${seq}@example.invalid`, { log: false });
});

// ---------------------------------------------------------------------------
// Format angka Indonesia (titik ribuan) — CBS menampilkan nominal "1.000.000".
// ---------------------------------------------------------------------------
Cypress.Commands.add('parseRupiah', (text) => {
  const n = Number(String(text).replace(/[^0-9,-]/g, '').replace(',', '.'));
  return cy.wrap(n, { log: false });
});
