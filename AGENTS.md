# Notes for coding agents

Read this before you change an explainer. It holds the maintainer notes that used to sit in the README.

## Layout

Each explainer is one HTML file in `site/<name>/index.html`: no build step and no dependencies apart from Google Fonts. `site/index.html` is the gallery; add a new entry to its `EXPLAINERS` list when you add an explainer.

Shared by every page, in `site/shared/`:

| File | What it does |
|---|---|
| `cosmos.css` | The dark "cosmos" theme: colour tokens, nebula background, static starfield with a few twinkling stars, glowing panels and buttons. Load it after the page's own `<style>`. |
| `sound.js` | `Sound`: generative ambient music (Web Audio, no audio files) with a hall reverb and ping-pong delay, plus effects tuned to the current chord. `Sound.mood('intro' / 'build' / 'forest' / 'predict')` sets how busy the music is; Music and Sound toggles are remembered per browser. |
| `math.js` | Typesets formulas with KaTeX (CDN, pinned 0.16.11) and shows a tooltip for each symbol. Write `<div data-tex="..." data-plain="...">`, wrap symbols as `\tip{key}{tex}`, and define `window.MATH_TIPS = { key: { name, def, val? } }` before loading it. Falls back to the plain text if KaTeX can't load. |
| `fx.js` | `FX`: canvas glow sprites and ball trails, drawn with additive blending instead of `shadowBlur` so hundreds of balls stay at 60 fps. |
| `code.js` | `Code`: the R / Python script panel. `Code.mount(sel, { R: [[id, line], …], Python: [...] })`, then `Code.focus([ids])` lights the lines for the current step. Lines with the same id stay in step across languages. |
| `unsup.js` | `Unsup`: R-exact `scale`, `hclustWard` (ward.D2 merge, height, order), `cutree`, `cutHeight` and `prcomp`, for the clustering and PCA pages. Also loads in Node for the tests. |
| `pollution.js` | `POLLUTION`: the Week 10 `pollution.csv` (60 × 16), the 10 by-hand rows, R's PC signs and R's k-means labels (R's random starts can't be replayed in JS). |

The clustering, PCA and eigenvector pages accept deep links that jump to a step with the earlier ones done: `hierarchical-clustering/#merge`, `#all`, `#cut`, `#scale`; `pca/#spin`, `#three`, `#all`, `#map`; `eigenvectors/#stretch`, `#find`, `#spread`, `#repeat`.

PCA and eigenvectors teach the idea first: their code panel starts folded (`Code.mount(..., { collapsed: true })`).

Keep animation cheap: nothing full-screen should move (a drifting full-screen starfield halved the frame rate on software-composited machines).

## Run and deploy

Open any `index.html` directly in a browser, or serve the whole site locally:

```bash
npm install
npm run dev
```

`npm run deploy` uploads `site/` to Cloudflare as static assets only (`wrangler.jsonc`), so there is no Worker script and requests are free.

## Tests

`npm test` checks every number the clustering and PCA pages show against R (`tests/reference.json`): the data, `scale`, `hclust` merge/height/order for the raw, scaled and by-hand trees, `cutree` for k = 1–10, the `tapply` means, `prcomp` sdev/rotation/scores, the eigenvector page's `cov()` and eigenvalues, and PCA step 3's best PC2 when a learner keeps their own PC1. It exits 1 on any mismatch. `tests/notation.mjs` (also in `npm test`) checks every formula on every page: one `\tip` key per distinct symbol (z_ij and z_kj need two), and every key defined in `MATH_TIPS`. `npm run reference` regenerates the JSON from `data/pollution.csv` (needs R with `jsonlite`); if you change the by-hand rows, change them in `tests/reference.R` and `site/shared/pollution.js` together.

## Rules

- The numbers must match the real libraries. Each explainer's full-scale run uses the defaults of the library it names (R `randomForest`, Python `XGBRegressor`); after a change, re-check its predictions against that library on the same 10 rows, as an adversarial review once found 122 of 400 XGBoost predictions off.
- These pages are projected in lecture halls: text a learner has to read stays readable from the back row. Where animation is the point, small labels are fine; where words are the point, cut words rather than shrink them.
- After any change, open the page in a browser, run the whole flow, and check the console stays clean and the animation stays smooth.
