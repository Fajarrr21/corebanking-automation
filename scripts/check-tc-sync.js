// check-tc-sync.js — pastikan ID di TC sheet (JSON) cocok 1:1 dengan judul `it` di spec.
//
//   node scripts/check-tc-sync.js
//
// Tiap docs/test-cases/src/TC_*.json wajib punya field "spec" (path spec, relatif
// root repo). Judul `it` harus diawali "TC-<KODE>-<AKSI>-### | ".
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'docs', 'test-cases', 'src');
const ID_IN_SPEC = /\bit(?:\.skip|\.only)?\(\s*[`'"](TC-[A-Z0-9]+-[A-Z0-9]+-\d{3}) \|/g;

let failed = false;
for (const f of fs.readdirSync(srcDir).filter((n) => /^TC_.*\.json$/.test(n)).sort()) {
  const tc = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
  const specs = [].concat(tc.spec || []);
  if (!specs.length) {
    console.log(`FAIL ${f}: field "spec" kosong`);
    failed = true;
    continue;
  }
  const inSpec = new Set();
  for (const s of specs) {
    const p = path.join(root, s);
    if (!fs.existsSync(p)) {
      console.log(`FAIL ${f}: spec tidak ada: ${s}`);
      failed = true;
      continue;
    }
    for (const m of fs.readFileSync(p, 'utf8').matchAll(ID_IN_SPEC)) inSpec.add(m[1]);
  }
  const inSheet = new Set(tc.cases.map((c) => c.id));
  const missing = [...inSheet].filter((id) => !inSpec.has(id));
  const extra = [...inSpec].filter((id) => !inSheet.has(id));
  if (missing.length || extra.length) {
    failed = true;
    console.log(`FAIL ${f}`);
    if (missing.length) console.log(`  di sheet, tidak ada di spec: ${missing.join(', ')}`);
    if (extra.length) console.log(`  di spec, tidak ada di sheet: ${extra.join(', ')}`);
  } else {
    console.log(`OK   ${f} (${inSheet.size} TC)`);
  }
}
process.exit(failed ? 1 : 0);
