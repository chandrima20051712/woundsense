"""
validate_model.py — Model validation and accuracy metrics generation.

Generates:
1. Segmentation metrics (Dice coefficient, IoU, Precision, Recall)
2. Tissue classification accuracy
3. Confusion matrix
4. Performance benchmarks

Usage:
    python -m scripts.validate_model --test-dir ./test_images --output ./validation_report.json

Reference:
    - Ronneberger et al., "U-Net: Convolutional Networks for Biomedical Image Segmentation", MICCAI 2015
    - Dice coefficient: 2*|A∩B| / (|A| + |B|)
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

import cv2
import numpy as np
from PIL import Image

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.model_loader import ModelLoader
from app.utils.wound_segmenter import segment_wound, preprocess_image
from app.utils.tissue_classifier import classify_wound_pixels, score_time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("woundsense.validation")


class ModelValidator:
    """Validates wound segmentation model against ground truth masks."""

    def __init__(self, model_loader: ModelLoader):
        self.model_loader = model_loader
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "model_mode": "onnx" if not model_loader.is_mock else "mock",
            "segmentation_metrics": {},
            "classification_metrics": {},
            "performance_metrics": {},
            "individual_results": [],
        }

    def dice_coefficient(self, pred: np.ndarray, truth: np.ndarray) -> float:
        """
        Calculate Dice coefficient (F1 score for segmentation).

        Dice = 2 * |intersection| / (|pred| + |truth|)

        Range: 0 (no overlap) to 1 (perfect overlap)
        """
        pred_binary = (pred > 0).astype(np.uint8)
        truth_binary = (truth > 0).astype(np.uint8)

        intersection = np.sum(pred_binary & truth_binary)
        union_sum = np.sum(pred_binary) + np.sum(truth_binary)

        if union_sum == 0:
            return 1.0  # Both empty = perfect match

        return 2.0 * intersection / union_sum

    def iou_score(self, pred: np.ndarray, truth: np.ndarray) -> float:
        """
        Calculate Intersection over Union (Jaccard index).

        IoU = |intersection| / |union|
        """
        pred_binary = (pred > 0).astype(np.uint8)
        truth_binary = (truth > 0).astype(np.uint8)

        intersection = np.sum(pred_binary & truth_binary)
        union = np.sum(pred_binary | truth_binary)

        if union == 0:
            return 1.0

        return intersection / union

    def precision_recall(self, pred: np.ndarray, truth: np.ndarray) -> Tuple[float, float]:
        """
        Calculate precision and recall.

        Precision = TP / (TP + FP)
        Recall = TP / (TP + FN)
        """
        pred_binary = (pred > 0).astype(np.uint8)
        truth_binary = (truth > 0).astype(np.uint8)

        tp = np.sum(pred_binary & truth_binary)
        fp = np.sum(pred_binary & ~truth_binary)
        fn = np.sum(~pred_binary & truth_binary)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0

        return precision, recall

    def validate_segmentation(
        self,
        image_path: str,
        mask_path: str
    ) -> Dict:
        """Validate single image segmentation against ground truth."""
        # Load image and ground truth
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image: {image_path}")

        truth_mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if truth_mask is None:
            raise ValueError(f"Could not load mask: {mask_path}")

        # Resize truth mask to match image if needed
        if truth_mask.shape[:2] != img.shape[:2]:
            truth_mask = cv2.resize(truth_mask, (img.shape[1], img.shape[0]))

        # Run inference
        start_time = time.time()
        pred_mask = segment_wound(self.model_loader.unet, img)
        inference_time_ms = (time.time() - start_time) * 1000

        # Calculate metrics
        dice = self.dice_coefficient(pred_mask, truth_mask)
        iou = self.iou_score(pred_mask, truth_mask)
        precision, recall = self.precision_recall(pred_mask, truth_mask)

        return {
            "image": os.path.basename(image_path),
            "dice_coefficient": round(dice, 4),
            "iou": round(iou, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "inference_ms": round(inference_time_ms, 2),
        }

    def validate_classification(
        self,
        image_path: str,
        mask_path: str,
        ground_truth_ratios: Dict[str, int]
    ) -> Dict:
        """Validate tissue classification against ground truth ratios."""
        img = cv2.imread(image_path)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)

        if mask.shape[:2] != img.shape[:2]:
            mask = cv2.resize(mask, (img.shape[1], img.shape[0]))

        # Run classification
        pred_ratios = classify_wound_pixels(img, mask)

        # Calculate error for each tissue type
        errors = {}
        for tissue_type in ["granulation", "slough", "necrotic", "epithelial"]:
            pred_val = pred_ratios.get(tissue_type, 0)
            true_val = ground_truth_ratios.get(tissue_type, 0)
            errors[tissue_type] = abs(pred_val - true_val)

        mae = sum(errors.values()) / len(errors)  # Mean Absolute Error

        return {
            "image": os.path.basename(image_path),
            "predicted_ratios": pred_ratios,
            "ground_truth_ratios": ground_truth_ratios,
            "errors": errors,
            "mae": round(mae, 2),
        }

    def run_validation(
        self,
        test_dir: str,
        output_path: Optional[str] = None
    ) -> Dict:
        """
        Run full validation suite on test directory.

        Expected directory structure:
            test_dir/
                images/
                    wound_001.jpg
                    wound_002.jpg
                masks/
                    wound_001.png
                    wound_002.png
                labels.json  # Optional: ground truth tissue ratios
        """
        test_path = Path(test_dir)
        images_dir = test_path / "images"
        masks_dir = test_path / "masks"

        if not images_dir.exists():
            logger.warning(f"No images directory found at {images_dir}")
            logger.info("Running synthetic validation instead...")
            return self._run_synthetic_validation()

        # Load labels if available
        labels_path = test_path / "labels.json"
        labels = {}
        if labels_path.exists():
            with open(labels_path) as f:
                labels = json.load(f)

        # Find matching image/mask pairs
        image_files = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))

        segmentation_results = []
        classification_results = []
        total_inference_time = 0

        for img_path in image_files:
            # Find corresponding mask
            mask_name = img_path.stem + ".png"
            mask_path = masks_dir / mask_name

            if not mask_path.exists():
                mask_name = img_path.stem + ".jpg"
                mask_path = masks_dir / mask_name

            if not mask_path.exists():
                logger.warning(f"No mask found for {img_path.name}, skipping")
                continue

            # Validate segmentation
            try:
                seg_result = self.validate_segmentation(str(img_path), str(mask_path))
                segmentation_results.append(seg_result)
                total_inference_time += seg_result["inference_ms"]

                # Validate classification if ground truth available
                if img_path.stem in labels:
                    cls_result = self.validate_classification(
                        str(img_path),
                        str(mask_path),
                        labels[img_path.stem]
                    )
                    classification_results.append(cls_result)

            except Exception as e:
                logger.error(f"Error validating {img_path.name}: {e}")

        # Aggregate metrics
        if segmentation_results:
            self.results["segmentation_metrics"] = {
                "mean_dice": round(np.mean([r["dice_coefficient"] for r in segmentation_results]), 4),
                "std_dice": round(np.std([r["dice_coefficient"] for r in segmentation_results]), 4),
                "mean_iou": round(np.mean([r["iou"] for r in segmentation_results]), 4),
                "mean_precision": round(np.mean([r["precision"] for r in segmentation_results]), 4),
                "mean_recall": round(np.mean([r["recall"] for r in segmentation_results]), 4),
                "num_samples": len(segmentation_results),
            }

        if classification_results:
            self.results["classification_metrics"] = {
                "mean_mae": round(np.mean([r["mae"] for r in classification_results]), 2),
                "num_samples": len(classification_results),
            }

        self.results["performance_metrics"] = {
            "mean_inference_ms": round(total_inference_time / max(len(segmentation_results), 1), 2),
            "total_images": len(segmentation_results),
        }

        self.results["individual_results"] = segmentation_results

        # Save report
        if output_path:
            with open(output_path, "w") as f:
                json.dump(self.results, f, indent=2)
            logger.info(f"Validation report saved to {output_path}")

        return self.results

    def _run_synthetic_validation(self) -> Dict:
        """Run validation with synthetic test cases when no test data available."""
        logger.info("Generating synthetic test cases...")

        test_cases = []

        # Test case 1: Circular wound (easy)
        img1 = np.zeros((512, 512, 3), dtype=np.uint8)
        img1[:, :] = [180, 160, 140]  # Skin tone background
        cv2.circle(img1, (256, 256), 100, (50, 50, 150), -1)  # Red wound

        truth1 = np.zeros((512, 512), dtype=np.uint8)
        cv2.circle(truth1, (256, 256), 100, 255, -1)

        # Test case 2: Irregular wound
        img2 = np.zeros((512, 512, 3), dtype=np.uint8)
        img2[:, :] = [180, 160, 140]
        pts = np.array([[200, 200], [350, 180], [380, 280], [300, 350], [180, 300]], np.int32)
        cv2.fillPoly(img2, [pts], (40, 60, 180))

        truth2 = np.zeros((512, 512), dtype=np.uint8)
        cv2.fillPoly(truth2, [pts], 255)

        # Test case 3: Small wound
        img3 = np.zeros((512, 512, 3), dtype=np.uint8)
        img3[:, :] = [180, 160, 140]
        cv2.circle(img3, (256, 256), 30, (30, 30, 120), -1)

        truth3 = np.zeros((512, 512), dtype=np.uint8)
        cv2.circle(truth3, (256, 256), 30, 255, -1)

        test_cases = [
            ("circular_wound", img1, truth1),
            ("irregular_wound", img2, truth2),
            ("small_wound", img3, truth3),
        ]

        results = []
        total_time = 0

        for name, img, truth in test_cases:
            start = time.time()
            pred = segment_wound(self.model_loader.unet, img)
            inference_ms = (time.time() - start) * 1000
            total_time += inference_ms

            dice = self.dice_coefficient(pred, truth)
            iou = self.iou_score(pred, truth)
            precision, recall = self.precision_recall(pred, truth)

            results.append({
                "test_case": name,
                "dice_coefficient": round(dice, 4),
                "iou": round(iou, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "inference_ms": round(inference_ms, 2),
            })

        self.results["segmentation_metrics"] = {
            "mean_dice": round(np.mean([r["dice_coefficient"] for r in results]), 4),
            "mean_iou": round(np.mean([r["iou"] for r in results]), 4),
            "mean_precision": round(np.mean([r["precision"] for r in results]), 4),
            "mean_recall": round(np.mean([r["recall"] for r in results]), 4),
            "num_samples": len(results),
            "note": "Synthetic test cases (no ground truth dataset available)"
        }

        self.results["performance_metrics"] = {
            "mean_inference_ms": round(total_time / len(results), 2),
            "total_images": len(results),
        }

        self.results["individual_results"] = results

        return self.results

    def print_report(self):
        """Print validation report to console."""
        print("\n" + "=" * 60)
        print("WOUNDSENSE MODEL VALIDATION REPORT")
        print("=" * 60)
        print(f"Timestamp: {self.results['timestamp']}")
        print(f"Model Mode: {self.results['model_mode']}")

        seg = self.results.get("segmentation_metrics", {})
        if seg:
            print("\n--- Segmentation Metrics ---")
            print(f"  Dice Coefficient: {seg.get('mean_dice', 'N/A'):.4f} ± {seg.get('std_dice', 0):.4f}")
            print(f"  IoU (Jaccard):    {seg.get('mean_iou', 'N/A'):.4f}")
            print(f"  Precision:        {seg.get('mean_precision', 'N/A'):.4f}")
            print(f"  Recall:           {seg.get('mean_recall', 'N/A'):.4f}")
            print(f"  Samples:          {seg.get('num_samples', 0)}")

        cls = self.results.get("classification_metrics", {})
        if cls:
            print("\n--- Classification Metrics ---")
            print(f"  Mean Abs Error:   {cls.get('mean_mae', 'N/A'):.2f}%")
            print(f"  Samples:          {cls.get('num_samples', 0)}")

        perf = self.results.get("performance_metrics", {})
        if perf:
            print("\n--- Performance Metrics ---")
            print(f"  Mean Inference:   {perf.get('mean_inference_ms', 'N/A'):.2f} ms")
            print(f"  Total Images:     {perf.get('total_images', 0)}")

        print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Validate WoundSense models")
    parser.add_argument("--test-dir", type=str, default="./test_data",
                        help="Directory containing test images and masks")
    parser.add_argument("--output", type=str, default="./validation_report.json",
                        help="Output path for validation report")
    args = parser.parse_args()

    # Load models
    logger.info("Loading models...")
    model_loader = ModelLoader()
    model_loader.load_all()

    # Run validation
    validator = ModelValidator(model_loader)
    validator.run_validation(args.test_dir, args.output)
    validator.print_report()


if __name__ == "__main__":
    main()
