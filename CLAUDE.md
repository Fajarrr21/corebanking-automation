# CLAUDE.md

Cypress E2E test suite untuk **CBS (Core Banking System)** — target **staging** `https://staging-cbs.cazh.id`. Tes, nama folder, dan deskripsi ditulis dalam **Bahasa Indonesia** — ikuti bahasa itu saat menambah tes.

> ℹ️ **Tech stack CBS BEDA dengan school v3.** CBS = **Laravel + Metronic (Bootstrap + jQuery)**, server-rendered. Bukan Next.js/Radix/shadcn.
> - **Login = FORM POST biasa** (`<form action=".../login" method="post">` + hidden `_token` CSRF), sukses = **full-page redirect ke `/home`**. TIDAK ada API XHR login untuk di-intercept — validasi sukses lewat URL.
> - Selector target markup **Metronic/Bootstrap**: `input[name="..."]`, `id`, class Metronic (`page-sidebar-menu`, `nav-link`, `btn-submit`), ikon `<i class="icon-...">` / FontAwesome `fa fa-...`. **Bukan** `data-slot`.

### Environment (env-switch, satu repo)

- **URL per-env**: `cypress/config/environments.js` (aman di-commit). **Kredensial per-env**: `cypress.env.json` di key `creds.<env>` — **RAHASIA, git-ignored, JANGAN commit** (template: `cypress.env.example.json`). `cypress.config.js` menggabungkan keduanya → override `baseUrl` + taruh ke `Cypress.env`; `LoginPage.loginViaSession` memakainya. Jadi **tidak ada spec/fixture yang perlu diedit** saat pindah env.
- **Default = `staging`.** Repo ini pure staging, jadi `npx cypress open` / `npx cypress run` polos langsung jalan tanpa flag apa pun.
  - Override eksplisit tetap bisa (kalau kelak ada env lain): `--env environment=<nama>` atau `CYPRESS_ENV=<nama>`.
- Saat ini **hanya ada environment `staging`** (tidak ada production). Struktur env-switch dipertahankan agar mudah menambah env baru bila diperlukan.
- Sesi login di-namespace per-env (`session-<env>-<email>`).

## Commands

- Hanya folder `cypress/e2e/cbs/**/*.cy.{js,ts}` yang di-scan (`specPattern`).
- `npx cypress open` — interactive. `npx cypress run` — headless. (Default staging, tanpa flag.)
- Single spec: `npx cypress run --spec "cypress/e2e/cbs/Auth/login.cy.js"`.
- `retries: 0` di run & open — flaky = failure nyata.

## Workflow

- **PRD-first**: jangan mengarang requirement. Kalau belum ada, tanya dulu.
- **Order per modul**: Test Case sheet → element analysis (minta HTML asli, jangan menebak selector) → code (POM + spec + fixture).
- **Generate dulu, jangan langsung run Cypress** — tanya sebelum eksekusi.
- Jalankan `node --check <file>` tiap file JS sebelum dianggap selesai. (Catatan: file ESM yang pakai `import` akan melempar `Cannot use import statement outside a module` karena `package.json` = commonjs — ini WAJAR, Cypress yang bundling; abaikan error spesifik ini, cek error sintaks lain.)

## Test conventions

- **Page Object Model**: tiap halaman = class singleton (`export default new LoginPage()`) di `cypress/support/pageobjects/`. Getter elemen di objek `elements`; method chainable (`return this`).
- **Selectors**: prefer `name`/`id`, teks stabil (`span.title` untuk menu), href untuk navigasi. Hindari class warna/CSS var.
- **Login**: reuse via `cy.session` (`LoginPage.loginViaSession()`); `beforeEach` clear cookies/localStorage untuk isolasi.
- **Hindari flaky wait**: jangan `cy.wait(<number>)`. CBS full-page nav — tunggu URL/elemen.
- **Fixtures drive everything**: URL, kredensial, label, data uji dari `cypress/fixtures/*.json` — jangan hardcode di spec.
- **Naming**: `describe` bertingkat per grup skenario; judul `it` = `TC-### : <deskripsi Bahasa Indonesia>`.

## Git

- **Commit hanya kalau diminta.** Jangan commit/branch sendiri.
