# Maintainer reference

Detail behind `AGENTS.md` (the rules live there). Paths are from the project root.

## Shared files

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

## Deep links

The clustering, PCA and eigenvector pages accept deep links that jump to a step with the earlier ones done: `hierarchical-clustering/#merge`, `#all`, `#cut`, `#scale`; `pca/#spin`, `#three`, `#all`, `#map`; `eigenvectors/#stretch`, `#find`, `#spread`, `#repeat`.

## What `npm test` covers

`tests/check.mjs` checks every number the clustering and PCA pages show against R (`tests/reference.json`): the data, `scale`, `hclust` merge/height/order for the raw, scaled and by-hand trees, `cutree` for k = 1–10, the `tapply` means, `prcomp` sdev/rotation/scores, the eigenvector page's `cov()` and eigenvalues, and PCA step 3's best PC2 when a learner keeps their own PC1. It also checks that `site/shared/pollution.js` matches `data/pollution.csv`. It exits 1 on any mismatch.

`tests/notation.mjs` checks every formula on every page: one `\tip` key per distinct symbol (z_ij and z_kj need two), and every key defined in `MATH_TIPS`.
