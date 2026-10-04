// check-syntax.js — `node --check` untuk file Cypress yang memakai import/export.
//
//   node scripts/check-syntax.js [file|folder ...]   (default: cypress/)
//
// package.json = commonjs, jadi `node --check` polos melempar "Cannot use import
// statement outside a module" untuk file ESM. Script ini menyalin file ke .mjs
// sementara lalu mengecek ulang, sehingga error sintaks ASLI tetap tertangkap.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const targets = args.length ? args : ['cypress'];
const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (/node_modules|downloads|videos|screenshots|reports/.test(p)) return;
    fs.readdirSync(p).forEach((n) => walk(path.join(p, n)));
  } else if (/\.(c|m)?js$/.test(p)) files.push(p);
};
targets.forEach((t) => walk(path.resolve(root, t)));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-syntax-'));
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const isEsm = /^\s*(import|export)\s/m.test(src);
  let target = f;
  if (isEsm) {
    target = path.join(tmp, `${path.basename(f)}.${files.indexOf(f)}.mjs`);
    fs.writeFileSync(target, src);
  }
  const r = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  if (r.status !== 0) {
    bad += 1;
    console.log(`FAIL ${path.relative(root, f)}\n${(r.stderr || '').split('\n').slice(0, 6).join('\n')}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${files.length - bad}/${files.length} file lolos cek sintaks`);
process.exit(bad ? 1 : 0);
