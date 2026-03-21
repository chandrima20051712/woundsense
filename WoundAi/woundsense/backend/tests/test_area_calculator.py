import pytest
from app.utils.area_calculator import calculate_wound_area

# Example test for area calculation

def test_calculate_area_basic():
    # Example: 10x10 px wound, px_per_mm = 1 (so px_per_cm = 10, px_per_cm2 = 100)
    import numpy as np
    mask = np.ones((10, 10), dtype=np.uint8)
    px_per_mm = 1.0
    area_cm2, _, _ = calculate_wound_area(mask, px_per_mm)
    # 100 pixels, px_per_cm2 = 100, so area should be 1.0 cm^2
    assert abs(area_cm2 - 1.0) < 1e-3
