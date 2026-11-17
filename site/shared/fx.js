/*
 * Canvas effects shared by the explainers. Glows use pre-rendered radial sprites drawn with
 * additive blending, never ctx.shadowBlur, so hundreds of glowing balls stay at full frame rate.
 */
(function () {
  'use strict';
  const cache = {};
  const TAU = Math.PI * 2;
  function sprite(col) {
    if (cache[col]) return cache[col];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, col); gr.addColorStop(.18, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    return (cache[col] = c);
  }
  function glow(ctx, x, y, R, col, a) {
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    ctx.drawImage(sprite(col), x - R, y - R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  }
  // p = {x, y, r}; b = the ball object (holds its trail); opts = {trail, glow}
  function ball(ctx, b, p, col, opts) {
    const o = opts || {}, big = p.r > 4;
    if (o.trail && b) {
      const tr = b.trail || (b.trail = []);
      tr.push(p.x, p.y); if (tr.length > 22) tr.splice(0, 2);
      const n = tr.length / 2;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n - 1; i++) {
        const k = (i + 1) / n;
        ctx.globalAlpha = .3 * k; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(tr[2 * i], tr[2 * i + 1], p.r * (.3 + .6 * k), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (o.glow !== false) glow(ctx, p.x, p.y, p.r * (big ? 3.6 : 3), col, big ? .8 : .6);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fillStyle = col; ctx.fill();
    if (big) { ctx.beginPath(); ctx.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .38, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); }
  }
  // sprinkle a few twinkling stars into the page's .cosmos-stars layer (cheap: tiny elements, opacity only)
  function stars() {
    const host = document.querySelector('.cosmos-stars'); if (!host || host.querySelector('b')) return;
    let h = '';
    for (let i = 0; i < 24; i++) h += `<b style="left:${(i * 137.5 + 11) % 100}%;top:${(i * 61.8 + 7) % 100}%;animation-delay:-${(i * .37).toFixed(2)}s"></b>`;
    host.insertAdjacentHTML('beforeend', h);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stars); else stars();
  window.FX = { sprite, glow, ball };
})();
