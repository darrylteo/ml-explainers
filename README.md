# ML Explainers

Hands-on, animated explainers for teaching machine learning. Each one starts with a 10-row table: the learner builds the first model by hand, then watches the algorithm repeat the recipe at full scale and make a prediction.

**Live:** https://ml-explainers.sutdpm.workers.dev

| Explainer | What the learner does |
|---|---|
| [Random Forest by hand](site/random-forest/index.html) | Draws a bootstrap sample, splits Tree 1 by choosing between 2 random features (with the Gini reduction shown for each), watches 499 more trees grow, then drops a new row through all 500 plinko-style and takes the mode. |
| [XGBoost by hand](site/xgboost/index.html) | Starts from the mean, builds 3 trees on the residuals by choosing splits (gain shown for all 5 features), watches the other 97 rounds with Python `XGBRegressor` defaults, sees the outlier's residual go to zero (compared with a random forest), then drops a new row through all 100 trees and sums the outputs. |

Each explainer is a single HTML file with no build step: open it in a browser, or host the `site/` folder anywhere.
