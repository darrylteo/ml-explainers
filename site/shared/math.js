/*
 * LaTeX formulas with hover tooltips for every symbol.
 *
 * Markup:   <div data-tex="\tip{G}{G} = 1 - \sum_k p_k^2" data-plain="G = 1 − Σ p_k²"></div>
 * Glossary: window.MATH_TIPS = { G: { name: 'Gini impurity', def: '…' }, … }  (set before this script runs)
 *
 * \tip{key}{tex} wraps a symbol in a span with class "mxt-key"; hovering, focusing or tapping it shows the
 * glossary entry. Needs KaTeX (loaded from the CDN before this file); without it the data-plain text is shown.
 */
(function () {
  'use strict';
  const OPTS = {
    throwOnError: false, strict: false,
    trust: ctx => ctx.command === '\\htmlClass',
    macros: { '\\tip': '\\htmlClass{mxt-#1}{#2}' },
  };
  let tipEl = null, current = null;

  function keyOf(el) { for (const c of el.classList) if (c.startsWith('mxt-')) return c.slice(4); return null; }
  function symbolAt(target) { return target && target.closest ? target.closest('[class*="mxt-"]') : null; }
  // KaTeX lays invisible layout spans over parts of fractions, so the element under the pointer is not always the
  // symbol. Instead pick the smallest symbol in this formula whose box contains the pointer.
  function symbolAtPoint(x, y, target) {
    const f = target && target.closest ? (target.closest('[data-tex]') || target.closest('.mcard')) : null; if (!f) return null;
    let best = null, area = Infinity;
    f.querySelectorAll('[class*="mxt-"]').forEach(s => {
      const r = s.getBoundingClientRect();
      if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) { const a = r.width * r.height; if (a < area) { area = a; best = s; } }
    });
    return best;
  }

  function show(sym) {
    const key = keyOf(sym), entry = (window.MATH_TIPS || {})[key];
    if (!entry) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'mathtip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    tipEl.innerHTML = `<b>${entry.name}</b><span>${entry.def}</span>${entry.val ? `<em>${entry.val}</em>` : ''}`;
    tipEl.classList.add('show');
    if (current && current !== sym) current.classList.remove('mx-on');
    sym.classList.add('mx-on'); current = sym;
    const r = sym.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight, m = 10;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + m;
    if (y + th > window.innerHeight - m) y = r.top - th - m;
    x = Math.max(m, Math.min(window.innerWidth - tw - m, x));
    tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(m, y) + 'px';
  }
  function hide() { if (tipEl) tipEl.classList.remove('show'); if (current) current.classList.remove('mx-on'); current = null; }

  function render(root) {
    (root || document).querySelectorAll('[data-tex]').forEach(el => {
      const display = el.dataset.display !== 'inline';
      if (!window.katex) { el.textContent = el.dataset.plain || el.dataset.tex; el.classList.add('math-plain'); return; }
      try { window.katex.render(el.dataset.tex, el, Object.assign({ displayMode: display }, OPTS)); }
      catch (e) { el.textContent = el.dataset.plain || el.dataset.tex; el.classList.add('math-plain'); }
    });
    (root || document).querySelectorAll('[class*="mxt-"]').forEach(s => {
      const entry = (window.MATH_TIPS || {})[keyOf(s)];
      if (!entry) return;
      s.tabIndex = 0; s.setAttribute('role', 'button'); s.setAttribute('aria-label', entry.name);
    });
  }

  document.addEventListener('mousemove', e => {
    const s = symbolAtPoint(e.clientX, e.clientY, e.target);
    if (s && s !== current) show(s); else if (!s && current) hide();
  }, { passive: true });
  document.addEventListener('focusin', e => { const s = symbolAt(e.target); if (s) show(s); });
  document.addEventListener('focusout', e => { if (symbolAt(e.target)) hide(); });
  document.addEventListener('click', e => { const s = symbolAtPoint(e.clientX, e.clientY, e.target) || symbolAt(e.target); if (s) show(s); else if (current) hide(); });   // tap support
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);

  window.MathTips = { render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render()); else render();
})();
