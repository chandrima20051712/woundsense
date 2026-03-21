FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=300 -r requirements.txt
RUN pip install --no-cache-dir --timeout=300 gdown

# Download models from Google Drive
RUN mkdir -p ./models
RUN gdown "1RWnBGC7s0xmGjgKiYT94SWE2qq6joDc5" -O ./models/wound_unet.onnx
RUN gdown "13TqusK04wu-ZQjZuqXa68_xgJOnr5s48" -O ./models/tissue_classifier.pkl

# Copy app code
COPY app/ ./app/

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]