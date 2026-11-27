# Notes for coding agents

Read this before you change an explainer. Reference detail (each shared file, deep links, what the tests cover) is in `docs/maintainers.md`.

## Layout

Each explainer is one HTML file in `site/<name>/index.html`: no build step and no dependencies apart from Google Fonts and KaTeX (jsDelivr CDN, pinned 0.16.11). `site/index.html` is the gallery; add a new entry to its `EXPLAINERS` list when you add an explainer. Code shared by every page lives in `site/shared/`.

## Run, test, deploy

- Open any `index.html` directly in a browser, or serve the whole site with `npm install` then `npm run dev`.
- `npm test` checks every number the clustering and PCA pages show against R (`tests/reference.json`) and every formula's symbol tooltips. It exits 1 on any mismatch.
- `npm run reference` regenerates the JSON from `data/pollution.csv` (needs R with `jsonlite`). If you change the by-hand rows, change them in `tests/reference.R` and `site/shared/pollution.js` together.
- `npm run deploy` uploads `site/` to Cloudflare as static assets only (`wrangler.jsonc`), so there is no Worker script and requests are free.

## Rules

- The numbers must match the real libraries. Each explainer's full-scale run uses the defaults of the library it names (R `randomForest`, Python `XGBRegressor`); after a change, re-check its predictions against that library on the same 10 rows, as an adversarial review once found 122 of 400 XGBoost predictions off.
- These pages are projected in lecture halls: text a learner has to read stays readable from the back row. Where animation is the point, small labels are fine; where words are the point, cut words rather than shrink them.
- Keep animation cheap: nothing full-screen should move (a drifting full-screen starfield halved the frame rate on software-composited machines).
- PCA and eigenvectors teach the idea first: their code panel starts folded (`Code.mount(..., { collapsed: true })`).
- Formulas use `site/shared/math.js`: one `\tip{key}{tex}` per distinct symbol, every key defined in `window.MATH_TIPS`.
- After any change, open the page in a browser, run the whole flow, and check the console stays clean and the animation stays smooth.
