# ML Explainers

Hands-on, animated explainers for teaching machine learning. Each one starts with a 10-row table: the learner builds the first model by hand, then watches the algorithm repeat the recipe at full scale. A code panel beside each step shows the matching R or Python line.

**Live:** https://ml-explainers.sutdpm.workers.dev

| Explainer | What the learner does |
|---|---|
| [Random Forest by hand](site/random-forest/index.html) | Draws a bootstrap sample, splits Tree 1 by choosing between 2 random features (with the Gini reduction shown for each), watches 499 more trees grow, then drops a new row through all 500 plinko-style and takes the mode. |
| [XGBoost by hand](site/xgboost/index.html) | Starts from the mean, builds 3 trees on the residuals by choosing splits (gain shown for all 5 features), watches the other 97 rounds with Python `XGBRegressor` defaults, sees the outlier's residual go to zero (compared with a random forest), then drops a new row through all 100 trees and sums the outputs. |
| [Hierarchical clustering by hand](site/hierarchical-clustering/index.html) | Merges 10 cities from `pollution.csv` one pair at a time by Ward's rule (with the merge cost shown), watches `hclust` merge all 60 on 16 columns, drags a cut line across the dendrogram to choose k, then switches `scale()` off and sees density take over. |
| [PCA by hand](site/pca/index.html) | Turns a screen between two suns until 10 planets' shadows spread widest (PC1), adds PC2, picks PC1, PC2 and PC3 one at a time in a 3-D cloud and compares four views, reads the 16 components, then walks a city along the arrows of the PC1–PC2 map and builds a city of their own. |
| [Eigenvectors by hand](site/eigenvectors/index.html) | Watches the spread matrix of the same 10 cities stretch a ring of arrows, hunts for the two arrows it does not turn, sees that their stretch is the shadows' spread from the PCA page, then repeats A·v until any arrow swings to PC1 (the power method). |

Each explainer is a single HTML file with no build step: open it in a browser, or host the `site/` folder anywhere.
