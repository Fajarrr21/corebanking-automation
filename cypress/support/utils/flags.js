// flags.js — gate untuk spec yang melakukan aksi TIDAK BISA DIBATALKAN
// (data tidak bisa dihapus, transaksi keuangan, kirim email/WA, dsb).
//
// Spec semacam itu dibungkus `describeIfFlag('allowXxx', 'judul', fn)` dan hanya
// jalan bila dijalankan dengan `--env allowXxx=true`. Tanpa flag, suite di-skip
// (tercatat pending), BUKAN dianggap lulus.

export const flagOn = (name) => {
  const v = Cypress.env(name);
  return v === true || v === 'true';
};

export const describeIfFlag = (flag, title, fn) =>
  (flagOn(flag) ? describe : describe.skip)(`${title} [butuh --env ${flag}=true]`, fn);
