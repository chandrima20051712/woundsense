# WoundSense

![Tests](https://github.com/chandrima20051712/WoundAi/actions/workflows/tests.yml/badge.svg)

AI-powered wound assessment and monitoring system.

## Features

- Wound segmentation using deep learning (U-Net ONNX)
- Coin-based calibration for accurate area measurement
- Tissue classification (granulation, slough, necrotic)
- TIME framework scoring
- Patient tracking and wound progress monitoring
- PDF report generation

## Backend

```bash
cd woundsense/backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Tests

```bash
cd woundsense/backend
pytest tests --cov=app --cov-report=html
```

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, ONNX Runtime
- **Frontend**: React Native (Expo)
- **AI/ML**: OpenCV, NumPy, U-Net segmentation model
