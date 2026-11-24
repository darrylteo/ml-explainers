/*
 * Code panel: the script the learner is following, in R or Python, with the lines for the current step lit up.
 *
 *   Code.mount('#code', { R: [['id', 'line'], ['', '# context line'], …], Python: [...] })
 *   Code.focus(['hclust', 'plot'])   lights those lines in both languages and scrolls the first into view
 *
 * Lines that share an id across languages stay in step when the learner switches tabs. The language choice is
 * remembered per browser.
 */
(function () {
  'use strict';
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const KW = /^(library|import|from|for|in|if|else|function|return|TRUE|FALSE|True|False|None)$/;

  // tiny tokenizer: comments, strings, numbers, function calls, arrows; everything else plain
  function paint(line) {
    let out = '', i = 0;
    const re = /(#.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w.]*)(?=\s*\()|(<-|=|\$)|([A-Za-z_][\w.]*)/g;
    let m;
    while ((m = re.exec(line))) {
      out += esc(line.slice(i, m.index));
      if (m[1]) out += `<span class="c-com">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="c-str">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="c-num">${m[3]}</span>`;
      else if (m[4]) out += KW.test(m[4]) ? `<span class="c-kw">${m[4]}</span>` : `<span class="c-fn">${esc(m[4])}</span>`;
      else if (m[5]) out += `<span class="c-op">${esc(m[5])}</span>`;
      else out += KW.test(m[6]) ? `<span class="c-kw">${m[6]}</span>` : esc(m[6]);
      i = m.index + m[0].length;
    }
    return out + esc(line.slice(i));
  }

  let host = null, src = null, lang = 'R', lit = [], open = true;
  function render() {
    const langs = Object.keys(src);
    if (!open) {
      host.innerHTML = `<div class="code-h"><span class="code-t">The code behind this page</span><button class="code-open" data-open="1">Show R / Python</button></div>`;
      return;
    }
    host.innerHTML = `<div class="code-h"><span class="code-t">The script</span><div class="code-tabs" role="tablist">${
      langs.map(l => `<button role="tab" aria-selected="${l === lang}" data-lang="${l}">${l}</button>`).join('')}</div></div>
      <pre class="code-b"><code>${src[lang].map(([id, ln]) =>
        `<div class="cl${lit.includes(id) && id ? ' now' : ''}" data-id="${id}">${paint(ln) || ' '}</div>`).join('')}</code></pre>`;
  }
  function focus(ids) {
    lit = ids || [];
    if (!host) return;
    host.querySelectorAll('.cl').forEach(el => el.classList.toggle('now', !!el.dataset.id && lit.includes(el.dataset.id)));
    const first = host.querySelector('.cl.now'), box = host.querySelector('.code-b');
    if (first && box) {
      const y = first.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      box.scrollTo({ top: Math.max(0, y - box.clientHeight / 4), behavior: 'smooth' });
    }
  }
  // opts.collapsed: start as a one-line "Show R / Python" bar, for pages where the ideas come first
  function mount(sel, code, opts) {
    host = document.querySelector(sel); src = code; open = !(opts && opts.collapsed);
    const want = LS.get('mlx-code-lang');
    lang = want && src[want] ? want : Object.keys(src)[0];
    render();
    host.addEventListener('click', e => {
      if (e.target.closest('[data-open]')) { open = true; render(); focus(lit); return; }
      const b = e.target.closest('[data-lang]'); if (!b) return;
      lang = b.dataset.lang; LS.set('mlx-code-lang', lang); render(); focus(lit);
    });
  }
  window.Code = { mount, focus };
})();
