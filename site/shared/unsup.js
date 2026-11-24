/*
 * Unsupervised maths shared by the clustering and PCA explainers. Each function copies what R does,
 * so the pages show R's numbers (tests/check.mjs compares every one against R 4.4.2):
 *   scale(X)            R scale(): centre each column, divide by its sd (n − 1)
 *   hclustWard(X)       R hclust(dist(X), method = "ward.D2"): merge, height and order exactly as R reports them
 *   cutree(h, k)        R cutree(): group numbers in order of first appearance
 *   prcomp(X)           R prcomp(X): sdev, rotation, scores x (column signs are arbitrary; pass R's signs to match)
 * Runs in the browser (window.Unsup) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  function colMeans(X) {
    const p = X[0].length, m = new Array(p).fill(0);
    for (const r of X) for (let j = 0; j < p; j++) m[j] += r[j];
    return m.map(v => v / X.length);
  }
  function colSds(X, m) {
    const p = X[0].length, s = new Array(p).fill(0);
    for (const r of X) for (let j = 0; j < p; j++) s[j] += (r[j] - m[j]) ** 2;
    return s.map(v => Math.sqrt(v / (X.length - 1)));
  }
  function scale(X) {
    const m = colMeans(X), s = colSds(X, m);
    return { X: X.map(r => r.map((v, j) => (v - m[j]) / s[j])), center: m, sd: s };
  }
  const sq = (a, b) => { let d = 0; for (let j = 0; j < a.length; j++) d += (a[j] - b[j]) ** 2; return d; };
  const dist = (a, b) => Math.sqrt(sq(a, b));

  // Ward.D2 cost of merging two groups of rows: sqrt(2·nA·nB/(nA+nB)) · ‖mean(A) − mean(B)‖
  function wardCost(X, A, B) {
    const ca = colMeans(A.map(i => X[i])), cb = colMeans(B.map(i => X[i]));
    return Math.sqrt(2 * A.length * B.length / (A.length + B.length)) * dist(ca, cb);
  }

  /*
   * Agglomerative clustering, Ward.D2, mirroring R's Fortran (hclust.f + hcass2):
   * squared distances, Lance–Williams updates, the merged cluster keeps the lower index, ties go to the lowest
   * (i, j). Merge rows use R's convention (−k = observation k, +s = the cluster formed at step s).
   * Also returns, per step, the members of each side so the pages can animate merges.
   */
  function hclustWard(X) {
    const n = X.length, D = [];
    for (let i = 0; i < n; i++) { D.push(new Float64Array(n)); for (let j = 0; j < n; j++) D[i][j] = sq(X[i], X[j]); }
    const size = new Array(n).fill(1), active = new Array(n).fill(true);
    const members = Array.from({ length: n }, (_, i) => [i]);
    const ia = [], ib = [], height = [], steps = [];
    for (let s = 0; s < n - 1; s++) {
      let bi = -1, bj = -1, best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!active[i]) continue;
        for (let j = i + 1; j < n; j++) if (active[j] && D[i][j] < best) { best = D[i][j]; bi = i; bj = j; }
      }
      ia.push(bi); ib.push(bj); height.push(Math.sqrt(best));
      steps.push({ a: members[bi].slice(), b: members[bj].slice(), h: Math.sqrt(best) });
      const ni = size[bi], nj = size[bj];
      for (let k = 0; k < n; k++) {
        if (!active[k] || k === bi || k === bj) continue;
        const nk = size[k];
        const v = ((ni + nk) * D[k][bi] + (nj + nk) * D[k][bj] - nk * D[bi][bj]) / (ni + nj + nk);
        D[k][bi] = D[bi][k] = v;
      }
      active[bj] = false; size[bi] = ni + nj; members[bi] = members[bi].concat(members[bj]);
    }
    // hcass2: observation indices -> R merge matrix
    const last = new Array(n).fill(0), merge = [];
    for (let s = 0; s < n - 1; s++) {
      let a = last[ia[s]] ? last[ia[s]] : -(ia[s] + 1);
      let b = last[ib[s]] ? last[ib[s]] : -(ib[s] + 1);
      if (a > 0 && b < 0) [a, b] = [b, a];
      else if (a > 0 && b > 0 && a > b) [a, b] = [b, a];
      merge.push([a, b]);
      last[ia[s]] = s + 1; last[ib[s]] = s + 1;
    }
    // leaf order: expand from the root, left before right
    let order = [merge[n - 2][0], merge[n - 2][1]];
    for (let s = n - 2; s >= 1; s--) {
      const j = order.indexOf(s);
      if (j >= 0) order.splice(j, 1, merge[s - 1][0], merge[s - 1][1]);
    }
    order = order.map(v => -v);
    return { merge, height, order, steps, n };
  }

  // R cutree(tree, k): apply the first n − k merges, number groups in order of their first observation
  function cutree(h, k) {
    const n = h.n, parent = Array.from({ length: n }, (_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let s = 0; s < n - k; s++) {
      const st = h.steps[s];
      parent[find(st.b[0])] = find(st.a[0]);
    }
    const lab = new Map(), out = [];
    for (let i = 0; i < n; i++) { const r = find(i); if (!lab.has(r)) lab.set(r, lab.size + 1); out.push(lab.get(r)); }
    return out;
  }
  // height of the cut that leaves exactly k groups (midway between merges n−k and n−k+1)
  function cutHeight(h, k) {
    const H = h.height, n = h.n;
    if (k >= n) return 0;
    if (k <= 1) return H[n - 2] * 1.06;
    return (H[n - k - 1] + H[n - k]) / 2;
  }

  // symmetric eigen-decomposition (cyclic Jacobi); fine for p ≤ 16
  function eigenSym(A) {
    const p = A.length, a = A.map(r => r.slice()), V = a.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) off += a[i][j] ** 2;
      if (off < 1e-24) break;
      for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) {
        if (Math.abs(a[i][j]) < 1e-300) continue;
        const th = (a[j][j] - a[i][i]) / (2 * a[i][j]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < p; k++) {
          const aki = a[k][i], akj = a[k][j];
          a[k][i] = c * aki - s * akj; a[k][j] = s * aki + c * akj;
        }
        for (let k = 0; k < p; k++) {
          const aik = a[i][k], ajk = a[j][k];
          a[i][k] = c * aik - s * ajk; a[j][k] = s * aik + c * ajk;
        }
        for (let k = 0; k < p; k++) {
          const vki = V[k][i], vkj = V[k][j];
          V[k][i] = c * vki - s * vkj; V[k][j] = s * vki + c * vkj;
        }
      }
    }
    const idx = a.map((_, i) => i).sort((x, y) => a[y][y] - a[x][x]);
    return { values: idx.map(i => a[i][i]), vectors: idx.map(i => V.map(r => r[i])) };   // vectors[c] = column c
  }

  /*
   * R prcomp(X) with the default center = TRUE, scale. = FALSE.
   * rotation[j][c] = loading of column j on PC c; x[i][c] = score of row i. signs[c] = ±1 flips PC c to match R.
   */
  function prcomp(X, signs) {
    const n = X.length, p = X[0].length, m = colMeans(X);
    const C = X.map(r => r.map((v, j) => v - m[j]));
    const S = Array.from({ length: p }, () => new Array(p).fill(0));
    for (const r of C) for (let i = 0; i < p; i++) for (let j = i; j < p; j++) S[i][j] += r[i] * r[j];
    for (let i = 0; i < p; i++) for (let j = i; j < p; j++) S[j][i] = S[i][j] = S[i][j] / (n - 1);
    const e = eigenSym(S), k = Math.min(n, p);
    const vecs = e.vectors.slice(0, k).map((v, c) => {
      // canonical sign: the largest |loading| is positive. signs[c] = −1 flips PC c from there (to match R).
      let big = 0; v.forEach(x => { if (Math.abs(x) > Math.abs(big)) big = x; });
      const f = (big < 0 ? -1 : 1) * (signs && signs[c] === -1 ? -1 : 1);
      return v.map(x => x * f);
    });
    const rotation = Array.from({ length: p }, (_, j) => vecs.map(v => v[j]));
    const sdev = e.values.slice(0, k).map(v => Math.sqrt(Math.max(v, 0)));
    const x = C.map(r => vecs.map(v => v.reduce((s, w, j) => s + w * r[j], 0)));
    const tot = sdev.reduce((s, v) => s + v * v, 0);
    const pve = sdev.map(v => v * v / tot);
    let c = 0; const cpve = pve.map(v => (c += v));
    return { sdev, rotation, x, center: m, pve, cpve, cov: S };
  }

  const api = { colMeans, colSds, scale, dist, sq, wardCost, hclustWard, cutree, cutHeight, eigenSym, prcomp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Unsup = api;
})(typeof window !== 'undefined' ? window : globalThis);
