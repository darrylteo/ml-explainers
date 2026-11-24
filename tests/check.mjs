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

// E2: the spread matrix A on the eigenvector page (and its box areas, 9 × A) is R's cov(); E3: lambda1's share is R's PVE
{
  const pr = U.prcomp(P.hand.map(r => Z[r - 1]).map(r => [r[col('EDUCReal')], r[col('WWDRKReal')]]), P.rSigns.hand);
  check('E2 cov(hand)', maxDiff(pr.cov, ref.cov_hand) < 1e-12, `A ${pr.cov} vs R ${ref.cov_hand}`);
  const l = U.eigenSym(pr.cov).values, s2 = ref.pca_hand.sdev.map(s => s * s);
  check('E3 share', Math.abs(l[0] / (l[0] + l[1]) - s2[0] / (s2[0] + s2[1])) < 1e-12, 'lambda1 share differs from R');
}
// P4: PCA step 3 with the learner's own PC1 (same recipe as setPC1 on the page): look down u, then the best
// screen in what is left. For R's PC1 it must give R's PC2; for any other u, R's top eigenvalue of the leftover.
{
  const T3 = Z.map(r => [r[col('EDUCReal')], r[col('WWDRKReal')], r[col('HOUSReal')]]), N = T3.length;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const pr = U.prcomp(T3, P.rSigns.tri), PCV = k => pr.rotation.map(r => r[k]);
  const best2 = f => {
    f = nrm(f); const p3 = PCV(2), e1 = nrm(p3.map((x, i) => x - dot(p3, f) * f[i])), e2 = cross(f, e1);
    const RES = T3.map(p => [dot(p, e1), dot(p, e2)]);
    let a = 0, b = 0, c = 0; RES.forEach(([x, y]) => { a += x * x; b += y * y; c += x * y; });
    const h = .5 * Math.atan2(2 * c, a - b), v = RES.reduce((s, [x, y]) => s + (Math.cos(h) * x + Math.sin(h) * y) ** 2, 0) / (N - 1);
    return { v, dir: e1.map((x, i) => Math.cos(h) * x + Math.sin(h) * e2[i]), var1: T3.reduce((s, p) => s + dot(p, f) ** 2, 0) / (N - 1) };
  };
  const t = best2(PCV(0));
  check('P4 PC2 variance', Math.abs(t.v - ref.pca_tri.sdev[1] ** 2) < 1e-9, `${t.v} vs R ${ref.pca_tri.sdev[1] ** 2}`);
  check('P4 PC2 direction', Math.abs(Math.abs(dot(t.dir, PCV(1))) - 1) < 1e-9, 'best screen after PC1 is not PC2');
  const o = best2(ref.own_u);
  check('P4 own PC1 variance', Math.abs(o.var1 - ref.own_u_var) < 1e-9, `${o.var1} vs R ${ref.own_u_var}`);
  check('P4 own PC2 variance', Math.abs(o.v - ref.own_u_best2) < 1e-9, `${o.v} vs R ${ref.own_u_best2}`);
}

console.log(`${passes} passed, ${fails} failed (reference: ${ref.r_version})`);
process.exit(fails ? 1 : 0);
