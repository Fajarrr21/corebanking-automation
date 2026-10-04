const { defineConfig } = require("cypress");
const fs = require("fs");
const environments = require("./cypress/config/environments");

module.exports = defineConfig({
  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "cypress/reports",
    overwrite: false,
    html: false,
    json: true,
    timestamp: "mmddyyyy_HHMMss",
  },
  e2e: {
    // Default statis di-OVERRIDE per environment di setupNodeEvents (lihat blok
    // "ENVIRONMENT SWITCH" di bawah). Nilai ini cuma placeholder.
    baseUrl: "https://staging-cbs.cazh.id",
    viewportWidth: 1366,
    viewportHeight: 768,
    defaultCommandTimeout: 10000,
    video: true,
    videoCompression: 32,
    videosFolder: "cypress/videos",
    screenshotOnRunFailure: true,
    screenshotsFolder: "cypress/screenshots",
    retries: {
      runMode: 0,
      openMode: 0,
    },
    // 🎯 Cuma scan folder cbs
    specPattern: "cypress/e2e/cbs/**/*.cy.{js,ts}",
    downloadsFolder: "cypress/downloads",
    setupNodeEvents(on, config) {
      // =====================================================================
      // ENVIRONMENT SWITCH — satu repo bisa melayani beberapa environment.
      // Sumber URL: cypress/config/environments.js. Kredensial: cypress.env.json.
      //
      // Repo ini pure staging → DEFAULT ke "staging" kalau tidak ada flag,
      // supaya `npx cypress open` / `run` polos langsung jalan. Masih bisa
      // di-override eksplisit via --env environment=<nama> (atau CYPRESS_ENV=...)
      // bila kelak ada environment lain.
      // =====================================================================
      const DEFAULT_ENV = "staging";
      const environment =
        config.env.environment || process.env.CYPRESS_ENV || DEFAULT_ENV;
      const envCfg = environments[environment];
      if (!envCfg) {
        throw new Error(
          `environment "${environment}" tidak dikenal. Pilihan: ${Object.keys(
            environments
          ).join(", ")}`
        );
      }
      if (!envCfg.baseUrl) {
        throw new Error(
          `environment "${environment}" belum dikonfigurasi (baseUrl kosong di cypress/config/environments.js).`
        );
      }
      // Kredensial dari cypress.env.json (RAHASIA, git-ignored). Cypress memuat
      // cypress.env.json ke config.env otomatis.
      const creds = (config.env.creds || {})[environment];
      if (!creds || !creds.email || !creds.password) {
        throw new Error(
          [
            "",
            "==================================================================",
            `✖ Kredensial "${environment}" tidak ditemukan.`,
            "  Buat file cypress.env.json (lihat cypress.env.example.json) berisi:",
            `    { "creds": { "${environment}": { "email": "...", "password": "..." } } }`,
            "  File ini di-git-ignore (jangan commit).",
            "==================================================================",
            "",
          ].join("\n")
        );
      }
      config.baseUrl = envCfg.baseUrl;
      config.env.environment = environment;
      config.env.appBase = envCfg.baseUrl;
      config.env.appLogin = envCfg.loginPath;
      config.env.appDashboard = envCfg.dashboardPath;
      config.env.appEmail = creds.email;
      config.env.appPassword = creds.password;
      // eslint-disable-next-line no-console
      console.log(`\n🎯 CYPRESS ENVIRONMENT = ${environment} (${envCfg.baseUrl})\n`);

      // 🗑️ Hapus video kalau spec lulus semua (hemat disk; cuma keep video FAIL).
      on("after:spec", (spec, results) => {
        if (!results || !results.video) return;
        const failed = (results.tests || []).some((t) =>
          (t.attempts || []).some((a) => a.state === "failed")
        );
        if (!failed) {
          try {
            fs.unlinkSync(results.video);
          } catch (_) {
            // file mungkin sudah ke-hapus / belum sempat ter-write; abaikan.
          }
        }
      });

      // WAJIB: kembalikan config supaya override baseUrl + env di atas berlaku.
      return config;
    },
  },
});
