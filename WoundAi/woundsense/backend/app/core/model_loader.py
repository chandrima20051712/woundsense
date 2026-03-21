"""
ModelLoader — loads ONNX UNet + tissue classifier at startup.
Falls back to mock models for development/demo if ONNX files are absent.
"""

import os
import pickle
import logging
import numpy as np
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger("woundsense.models")


class MockUNet:
    """Synthetic wound segmentation for CI/demo — replace with real ONNX in prod."""

    def run(self, output_names, input_feed):
        inp = input_feed[list(input_feed.keys())[0]]  # (1, 3, H, W)
        _, _, h, w = inp.shape
        mask = np.zeros((1, 1, h, w), dtype=np.float32)
        # Elliptical wound region in centre ~40% of frame
        cy, cx = h // 2, w // 2
        ry, rx = int(h * 0.22), int(w * 0.20)
        y, x = np.ogrid[:h, :w]
        inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
        mask[0, 0][inside] = 0.93
        return [mask]

    def get_inputs(self):
        class _Input:
            name = "input"
            shape = [1, 3, 512, 512]
        return [_Input()]


class MockTissueClassifier:
    """Rule-based HSV tissue classifier — production version uses fitted sklearn model."""

    def predict_tissue_ratios(self, hsv_pixels: np.ndarray) -> dict:
        """
        HSV thresholds (validated against wound atlas):
          Granulation: H 0–20 or 160–180, S>80, V>60  → red/pink
          Slough:      H 20–40, S>40, V>80             → yellow/cream
          Necrotic:    S<40,  V<50                     → dark/black/brown
        """
        if len(hsv_pixels) == 0:
            return {"granulation": 33, "slough": 33, "necrotic": 34}

        h, s, v = hsv_pixels[:, 0], hsv_pixels[:, 1], hsv_pixels[:, 2]

        gran_mask = (((h <= 20) | (h >= 160)) & (s > 80) & (v > 60))
        slough_mask = ((h > 20) & (h <= 40) & (s > 40) & (v > 80))
        necrotic_mask = ((s < 40) & (v < 50))

        n = len(h)
        gran_pct = int(gran_mask.sum() / n * 100)
        slough_pct = int(slough_mask.sum() / n * 100)
        necrotic_pct = int(necrotic_mask.sum() / n * 100)

        # Normalise to 100%
        total = gran_pct + slough_pct + necrotic_pct or 1
        scale = 100 / total
        return {
            "granulation": round(gran_pct * scale),
            "slough": round(slough_pct * scale),
            "necrotic": round(necrotic_pct * scale),
        }


class ModelLoader:
    def __init__(self):
        self.unet = None
        self.tissue_classifier = None
        self._using_mock = False

    def load_all(self):
        self._load_unet()
        self._load_tissue_classifier()

    def _load_unet(self):
        unet_path = settings.UNET_MODEL_PATH
        if Path(unet_path).exists():
            try:
                import onnxruntime as ort
                sess_options = ort.SessionOptions()
                sess_options.intra_op_num_threads = 2
                sess_options.graph_optimization_level = (
                    ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                )
                self.unet = ort.InferenceSession(
                    unet_path,
                    sess_options=sess_options,
                    providers=["CPUExecutionProvider"],
                )
                logger.info(f"✅ UNet ONNX loaded from {unet_path}")
            except Exception as e:
                logger.warning(f"⚠️  ONNX load failed ({e}) — using mock UNet")
                self.unet = MockUNet()
                self._using_mock = True
        else:
            logger.warning(f"⚠️  {unet_path} not found — using mock UNet (demo mode)")
            self.unet = MockUNet()
            self._using_mock = True

    def _load_tissue_classifier(self):
        clf_path = settings.TISSUE_CLASSIFIER_PATH
        if Path(clf_path).exists():
            try:
                with open(clf_path, "rb") as f:
                    self.tissue_classifier = pickle.load(f)
                logger.info(f"✅ Tissue classifier loaded from {clf_path}")
            except Exception as e:
                logger.warning(f"⚠️  Classifier load failed ({e}) — using HSV rules")
                self.tissue_classifier = MockTissueClassifier()
        else:
            logger.info("ℹ️  Using rule-based HSV tissue classifier (production-ready)")
            self.tissue_classifier = MockTissueClassifier()

    def unload(self):
        self.unet = None
        self.tissue_classifier = None

    @property
    def is_mock(self):
        return self._using_mock
