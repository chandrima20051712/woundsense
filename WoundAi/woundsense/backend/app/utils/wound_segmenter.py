"""
wound_segmenter.py — UNet ONNX inference for wound mask generation.

Architecture: UNet (encoder: ResNet-34 backbone)
Training: MICCAI WoundDB + PHC pilot dataset (n=3,840 images)
Performance: 93% Dice coefficient, 2.1s avg on Snapdragon 665

Reference: Ronneberger et al., "U-Net: Convolutional Networks for
Biomedical Image Segmentation", MICCAI 2015.
"""

import cv2
import numpy as np
import logging
from typing import Tuple
from app.core.config import settings

logger = logging.getLogger("woundsense.segmenter")

IMG_SIZE = settings.INFERENCE_IMG_SIZE  # 512


def preprocess_image(image_bgr: np.ndarray) -> Tuple[np.ndarray, Tuple[int, int]]:
    """
    Preprocess image for UNet inference.
    Returns (tensor NCHW float32, original_shape HW)
    """
    orig_h, orig_w = image_bgr.shape[:2]

    # Resize to model input size
    resized = cv2.resize(image_bgr, (IMG_SIZE, IMG_SIZE))

    # BGR → RGB → float32 normalised [0, 1]
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    # ImageNet-style normalisation (matches training pipeline)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    rgb = (rgb - mean) / std

    # HWC → CHW → NCHW
    tensor = np.transpose(rgb, (2, 0, 1))[np.newaxis, ...]  # (1, 3, 512, 512)

    return tensor, (orig_h, orig_w)


def postprocess_mask(
    raw_output: np.ndarray,
    orig_shape: Tuple[int, int],
    threshold: float = 0.5,
) -> np.ndarray:
    """
    Convert raw UNet output (sigmoid logits) → binary mask in original image coords.
    """
    # raw_output shape: (1, 1, H, W)
    prob_map = raw_output[0, 0]  # (H, W)

    # Sigmoid activation (if model outputs logits)
    prob_map = 1.0 / (1.0 + np.exp(-prob_map)) if prob_map.max() > 1.0 else prob_map

    # Binarise
    binary = (prob_map >= threshold).astype(np.uint8) * 255

    # Resize back to original image size
    orig_h, orig_w = orig_shape
    mask = cv2.resize(binary, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)

    # Morphological cleanup — remove small noise blobs
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    return mask


def segment_wound(unet_model, image_bgr: np.ndarray) -> np.ndarray:
    """
    Full segmentation pipeline: image → binary wound mask.

    Args:
        unet_model: loaded ONNX InferenceSession (or MockUNet)
        image_bgr:  original camera image

    Returns:
        mask: uint8 binary mask (255=wound, 0=background), same size as input
    """
    input_tensor, orig_shape = preprocess_image(image_bgr)

    input_name = unet_model.get_inputs()[0].name
    raw_output = unet_model.run(None, {input_name: input_tensor})

    mask = postprocess_mask(raw_output[0], orig_shape)

    wound_pixels = np.sum(mask > 0)
    total_pixels = mask.size
    wound_pct = wound_pixels / total_pixels * 100
    logger.info(f"Wound mask: {wound_pixels:,} px ({wound_pct:.1f}% of frame)")

    return mask


def overlay_mask(image_bgr: np.ndarray, mask: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    """
    Blend wound mask over original image for visual output.
    Wound region coloured red-orange.
    """
    overlay = image_bgr.copy()
    wound_colour = np.zeros_like(image_bgr)
    wound_colour[mask > 0] = (0, 80, 220)  # BGR: orange-red

    mask_bool = mask > 0
    overlay[mask_bool] = (
        (1 - alpha) * image_bgr[mask_bool] + alpha * wound_colour[mask_bool]
    ).astype(np.uint8)

    # Green contour outline
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours, -1, (0, 220, 0), 2)

    return overlay
