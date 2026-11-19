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

Keep animation cheap: nothing full-screen should move (a drifting full-screen starfield halved the frame rate on software-composited machines).

## Run and deploy

Open any `index.html` directly in a browser, or serve the whole site locally:

```bash
npm install
npm run dev
```

`npm run deploy` uploads `site/` to Cloudflare as static assets only (`wrangler.jsonc`), so there is no Worker script and requests are free.

## Rules

- The numbers must match the real libraries. Each explainer's full-scale run uses the defaults of the library it names (R `randomForest`, Python `XGBRegressor`); after a change, re-check its predictions against that library on the same 10 rows, as an adversarial review once found 122 of 400 XGBoost predictions off.
- These pages are projected in lecture halls: text a learner has to read stays readable from the back row. Where animation is the point, small labels are fine; where words are the point, cut words rather than shrink them.
- After any change, open the page in a browser, run the whole flow, and check the console stays clean and the animation stays smooth.
