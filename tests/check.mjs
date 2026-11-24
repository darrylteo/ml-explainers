// Checks that the explainers' maths (site/shared/unsup.js) and data (site/shared/pollution.js) give exactly R's
// numbers (tests/reference.json, written by tests/reference.R). Exit code 1 on any mismatch.
// Run: npm test
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const U = require('../site/shared/unsup.js');
const ref = JSON.parse(fs.readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../site/shared/pollution.js', import.meta.url), 'utf8'), box);
const P = box.window.POLLUTION;

let fails = 0, passes = 0;
function check(id, ok, msg) {
  if (ok) { passes++; return; }
  fails++; console.log(`FAIL ${id}: ${msg}`);
}
const maxDiff = (a, b) => {
  const fa = a.flat(Infinity), fb = b.flat(Infinity);
  if (fa.length !== fb.length) return Infinity;
  return Math.max(0, ...fa.map((v, i) => Math.abs(v - fb[i])));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TOL = 1e-9;

// D1: pollution.js holds exactly data/pollution.csv
const lines = fs.readFileSync(new URL('../data/pollution.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const csvCols = lines[0].split(',').map(s => s.trim()), csv = lines.slice(1).map(l => l.split(',').map(Number));
check('D1', same(csvCols, P.cols) && maxDiff(csv, P.rows) === 0, 'site/shared/pollution.js differs from data/pollution.csv');
check('D2', same(P.hand, ref.hand), `hand rows ${P.hand} differ from tests/reference.R (${ref.hand})`);
check('D3', same(P.kmeans4, ref.kmeans4), 'kmeans4 labels differ from R kmeans(set.seed(1), nstart = 20)');

// S1: scale() matches R scale()
const Z = U.scale(P.rows).X;
check('S1', maxDiff(Z, ref.scaled) < TOL, `scale() off by ${maxDiff(Z, ref.scaled)}`);

// H1–H3: hclust ward.D2 merge, height, order for raw, scaled and the 10-city by-hand tree
const col = name => P.cols.indexOf(name);
const handX = P.hand.map(r => [Z[r - 1][col('DENSReal')], Z[r - 1][col('MORTReal')]]);
for (const [id, X, R] of [['H1 scaled', Z, ref.hc_scaled], ['H2 raw', P.rows, ref.hc_raw], ['H3 hand', handX, ref.hc_hand]]) {
  const h = U.hclustWard(X);
  check(id + ' merge', same(h.merge, R.merge), 'merge matrix differs from R');
  check(id + ' height', maxDiff(h.height, R.height) < 1e-7 * Math.max(...R.height), `heights off by ${maxDiff(h.height, R.height)}`);
  check(id + ' order', same(h.order, R.order), `order ${h.order} vs R ${R.order}`);
}
// H4: by-hand Ward cost formula equals the hclust heights, step by step
{
  const h = U.hclustWard(handX);
  const off = h.steps.map(s => Math.abs(U.wardCost(handX, s.a, s.b) - s.h));
  check('H4 wardCost', Math.max(...off) < 1e-9, `wardCost differs from hclust height by ${Math.max(...off)}`);
}
// C1: cutree for k = 1..10
for (const [id, X, R] of [['C1 scaled', Z, ref.cut_scaled], ['C2 raw', P.rows, ref.cut_raw]]) {
  const h = U.hclustWard(X);
  R.forEach((want, i) => check(`${id} k=${i + 1}`, same(U.cutree(h, i + 1), want), 'cutree labels differ'));
}
// C3: cutHeight really leaves k groups
{
  const h = U.hclustWard(Z);
  for (let k = 1; k <= 12; k++) {
    const t = U.cutHeight(h, k), groups = 60 - h.height.filter(v => v <= t).length;
    check(`C3 k=${k}`, groups === k, `cutHeight(${k}) leaves ${groups} groups`);
  }
}
// C4: mean mortality per cluster (tapply in the script)
for (const [id, X, R] of [['C4 raw', P.rows, ref.mort_by_cluster_raw], ['C4 scaled', Z, ref.mort_by_cluster_scaled]]) {
  const g = U.cutree(U.hclustWard(X), 4), m = col('MORTReal');
  const mean = [1, 2, 3, 4].map(c => { const v = P.rows.filter((_, i) => g[i] === c).map(r => r[m]); return v.reduce((a, b) => a + b, 0) / v.length; });
  check(id, maxDiff(mean, R) < 1e-9, `tapply means ${mean} vs R ${R}`);
}
// P1–P3: prcomp sdev, rotation (with R's signs) and scores
const pick = (X, names) => X.map(r => names.map(n => r[col(n)]));
for (const [id, X, R, sg] of [
  ['P1 full', Z, ref.pca_full, P.rSigns.full],
  ['P2 hand', P.hand.map(r => Z[r - 1]).map(r => [r[col('EDUCReal')], r[col('WWDRKReal')]]), ref.pca_hand, P.rSigns.hand],
  ['P3 tri', pick(Z, ['EDUCReal', 'WWDRKReal', 'HOUSReal']), ref.pca_tri, P.rSigns.tri],
]) {
  const pr = U.prcomp(X, sg);
  check(id + ' sdev', maxDiff(pr.sdev, R.sdev) < 1e-9, `sdev off by ${maxDiff(pr.sdev, R.sdev)}`);
  check(id + ' rotation', maxDiff(pr.rotation, R.rotation) < 1e-8, `rotation off by ${maxDiff(pr.rotation, R.rotation)}`);
  check(id + ' scores', maxDiff(pr.x, R.x) < 1e-8, `scores off by ${maxDiff(pr.x, R.x)}`);
}

// E1: the eigenvector page's eigenvalues of cov(hand) are R's prcomp variances (eigen(cov(hand))$values)
{
  const pr = U.prcomp(P.hand.map(r => Z[r - 1]).map(r => [r[col('EDUCReal')], r[col('WWDRKReal')]]), P.rSigns.hand);
  const ev = U.eigenSym(pr.cov).values, want = ref.pca_hand.sdev.map(s => s * s);
  check('E1 eigenvalues', maxDiff(ev, want) < 1e-9, `eigen(cov) ${ev} vs R ${want}`);
}

console.log(`${passes} passed, ${fails} failed (reference: ${ref.r_version})`);
process.exit(fails ? 1 : 0);
