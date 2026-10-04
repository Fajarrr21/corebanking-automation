// environments.js — URL per environment untuk CBS (Core Banking System).
//
// ⚠️ KREDENSIAL TIDAK di sini. Email/password ada di `cypress.env.json`
// (git-ignored, RAHASIA) di bawah key `creds.<environment>`. cypress.config.js
// menggabungkan URL dari file ini + kredensial dari cypress.env.json, lalu
// menaruhnya ke Cypress.env. LoginPage memakainya — jadi TIDAK ada spec/fixture
// yang perlu diedit saat pindah env.
//
// Default = staging (pure staging) — `npx cypress open`/`run` polos jalan.
// Override opsional bila kelak ada env lain:
//   npx cypress run  --env environment=<nama>
//
// dashboardPath = tujuan redirect setelah login sukses (dipakai untuk validasi
// sesi). CBS = form POST biasa, sukses -> full-page redirect ke /home.

module.exports = {
  staging: {
    baseUrl: 'https://staging-cbs.cazh.id',
    loginPath: '/login',
    dashboardPath: '/home',
  },
};
