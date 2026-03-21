"""
Evaluation script for backend wound segmentation and tissue classification.
- Loads test images/masks from a folder
- Calls backend API or functions
- Computes Dice/IoU metrics
- Saves CSV and plots
"""
import os
import numpy as np
import pandas as pd
from app.utils.area_calculator import calculate_area
from app.utils.tissue_classifier import classify_tissue
# Add imports for segmentation as needed

def dice_coef(mask_gt, mask_pred):
    mask_gt = np.asarray(mask_gt).astype(bool)
    mask_pred = np.asarray(mask_pred).astype(bool)
    intersection = np.logical_and(mask_gt, mask_pred).sum()
    return 2. * intersection / (mask_gt.sum() + mask_pred.sum() + 1e-8)

def iou_coef(mask_gt, mask_pred):
    mask_gt = np.asarray(mask_gt).astype(bool)
    mask_pred = np.asarray(mask_pred).astype(bool)
    intersection = np.logical_and(mask_gt, mask_pred).sum()
    union = np.logical_or(mask_gt, mask_pred).sum()
    return intersection / (union + 1e-8)

# Example: dummy evaluation loop
results = []
for i in range(3):  # Replace with real test set
    mask_gt = np.random.randint(0, 2, (512, 512))
    mask_pred = np.random.randint(0, 2, (512, 512))
    dice = dice_coef(mask_gt, mask_pred)
    iou = iou_coef(mask_gt, mask_pred)
    results.append({"case": i, "dice": dice, "iou": iou})

# Save results
results_df = pd.DataFrame(results)
results_df.to_csv("evaluation_results.csv", index=False)
print("Saved evaluation_results.csv")

# Plot (optional)
try:
    import matplotlib.pyplot as plt
    plt.hist(results_df["dice"], bins=10, alpha=0.7, label="Dice")
    plt.hist(results_df["iou"], bins=10, alpha=0.7, label="IoU")
    plt.legend()
    plt.title("Backend Evaluation Metrics")
    plt.savefig("evaluation_metrics.png")
    print("Saved evaluation_metrics.png")
except ImportError:
    print("matplotlib not installed; skipping plot.")
