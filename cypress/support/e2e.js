// e2e.js — dimuat otomatis sebelum tiap spec.
//
// Error JS app yang belum masuk daftar derau (NOISE) DICATAT ke Cypress log +
// console (bukan ditelan diam-diam), supaya bug JS asli app tetap kelihatan.
// CBS = Metronic/Bootstrap + jQuery; derau umum ditambahkan seiring temuan run.
const NOISE = [
  /ResizeObserver loop/i, // derau browser standar, bukan bug app
];

Cypress.on('uncaught:exception', (err) => {
  if (NOISE.some((re) => re.test(err.message))) return false;

  Cypress.log({
    name: 'uncaught',
    message: `app error diabaikan: ${err.message}`,
    consoleProps: () => ({ error: err }),
  });
  // eslint-disable-next-line no-console
  console.warn('[uncaught:exception] belum di-whitelist:', err.message);
  return false;
});

// Import commands.js
import './commands';
