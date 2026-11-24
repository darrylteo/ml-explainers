// Every formula symbol gets its own tooltip: one \tip key must always wrap the same symbol, and every key used
// must be defined in that page's MATH_TIPS. Checks every data-tex on every page. Exit code 1 on any problem.
// Run: npm test
import fs from 'node:fs';
import path from 'node:path';

const site = new URL('../site/', import.meta.url);
const pages = fs.readdirSync(site, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(new URL(`${d.name}/index.html`, site)))
  .map(d => d.name);

// \tip{key}{tex} with nested braces; returns [{key, tex}] including tips nested inside tex
function tips(s) {
  const out = [];
  const group = i => { let d = 0, j = i; do { if (s[j] === '{') d++; else if (s[j] === '}') d--; j++; } while (d && j < s.length); return [s.slice(i + 1, j - 1), j]; };
  for (let i = s.indexOf('\\tip{'); i >= 0; i = s.indexOf('\\tip{', i + 1)) {
    const [key, j] = group(i + 4), [tex] = group(j);
    out.push({ key, tex });
  }
  return out;
}
// the symbol a tip shows, with nested tips reduced to their own text
const plain = tex => tex.replace(/\\tip\{[^{}]*\}/g, '').replace(/[{}\s]/g, '');

let fails = 0, checked = 0;
for (const p of pages) {
  const html = fs.readFileSync(new URL(`${p}/index.html`, site), 'utf8');
  const texes = [...html.matchAll(/data-tex="([^"]*)"/g)].map(m => m[1]);
  if (!texes.length) continue;
  const defs = (html.match(/window\.MATH_TIPS\s*=\s*\{([\s\S]*?)\n\};/) || ['', ''])[1];
  const defined = new Set([...defs.matchAll(/^\s*"?([A-Za-z0-9_]+)"?\s*:/gm)].map(m => m[1]));
  const seen = new Map();
  for (const t of texes) for (const { key, tex } of tips(t)) {
    checked++;
    const sym = plain(tex);
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key).add(sym);
    if (!defined.has(key)) { fails++; console.log(`FAIL N2 ${p}: \\tip{${key}} has no entry in MATH_TIPS`); }
  }
  for (const [key, syms] of seen) if (syms.size > 1) {
    fails++; console.log(`FAIL N1 ${p}: tooltip "${key}" is shared by different symbols: ${[...syms].join('  |  ')}`);
  }
}
console.log(`notation: ${checked} symbols on ${pages.length} pages, ${fails} problems`);
process.exit(fails ? 1 : 0);
