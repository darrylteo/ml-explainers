# Reference numbers for the clustering and PCA explainers, straight from R.
# Follows the Week 10 script (dist -> hclust ward.D2 -> cutree; scale; kmeans; prcomp).
# Run:  Rscript tests/reference.R   (writes tests/reference.json; needs jsonlite)
library(jsonlite)
p <- read.csv("data/pollution.csv")
ps <- data.frame(scale(p)); colnames(ps) <- names(p)

HAND <- c(1, 5, 9, 16, 24, 28, 33, 41, 49, 59)          # the 10 cities learners work with by hand
tree <- function(h) list(merge = h$merge, height = h$height, order = h$order)
pc <- function(pr) list(sdev = pr$sdev, rotation = unname(pr$rotation), x = unname(pr$x))

h_scaled <- hclust(dist(ps, method = "euclidean"), method = "ward.D2")      # clusterpollution2
h_raw    <- hclust(dist(p,  method = "euclidean"), method = "ward.D2")      # clusterpollution1
h_hand   <- hclust(dist(ps[HAND, c("DENSReal", "MORTReal")]), method = "ward.D2")

set.seed(1)
km <- kmeans(ps, centers = 4, nstart = 20)                                   # clusterpollution3

out <- list(
  r_version = R.version.string,
  hand = HAND,
  scaled = unname(as.matrix(ps)),
  hc_scaled = tree(h_scaled), hc_raw = tree(h_raw), hc_hand = tree(h_hand),
  cut_scaled = lapply(1:10, function(k) unname(cutree(h_scaled, k))),
  cut_raw = lapply(1:10, function(k) unname(cutree(h_raw, k))),
  mort_by_cluster_raw = unname(tapply(p$MORTReal, cutree(h_raw, 4), mean)),
  mort_by_cluster_scaled = unname(tapply(p$MORTReal, cutree(h_scaled, 4), mean)),
  kmeans4 = unname(km$cluster), kmeans_tot_withinss = km$tot.withinss,
  pca_full = pc(prcomp(ps, scale = FALSE)),
  pca_hand = pc(prcomp(ps[HAND, c("EDUCReal", "WWDRKReal")])),
  pca_tri = pc(prcomp(ps[, c("EDUCReal", "WWDRKReal", "HOUSReal")]))
)
write_json(out, "tests/reference.json", digits = NA, auto_unbox = TRUE)
cat("wrote tests/reference.json with", R.version.string, "\n")
