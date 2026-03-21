#!/usr/bin/env bash
# deploy.sh — WoundSense PHC Deployment Script
# Run on each PHC server (Ubuntu 20.04+, 4GB RAM minimum)
# Usage: ./deploy.sh [--update] [--with-models]

set -euo pipefail

REPO_URL="https://github.com/your-org/woundsense"
DEPLOY_DIR="/opt/woundsense"
SERVICE_NAME="woundsense"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Check prerequisites ───────────────────────────────────────────────────────
check_deps() {
  info "Checking dependencies..."
  command -v docker >/dev/null 2>&1 || error "Docker not installed. Run: curl -fsSL https://get.docker.com | sh"
  command -v docker-compose >/dev/null 2>&1 || \
    (sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
     -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose)
  info "Docker version: $(docker --version)"
}

# ── Install ───────────────────────────────────────────────────────────────────
install() {
  info "Installing WoundSense to ${DEPLOY_DIR}..."
  sudo mkdir -p "${DEPLOY_DIR}/models"
  sudo chown -R "$USER":"$USER" "${DEPLOY_DIR}"

  if [ -d "${DEPLOY_DIR}/.git" ]; then
    warn "Directory exists — pulling latest code"
    cd "${DEPLOY_DIR}" && git pull
  else
    git clone "${REPO_URL}" "${DEPLOY_DIR}"
    cd "${DEPLOY_DIR}"
  fi

  # Create .env from example if not present
  if [ ! -f "${DEPLOY_DIR}/.env" ]; then
    cp "${DEPLOY_DIR}/.env.example" "${DEPLOY_DIR}/.env"
    warn "Created .env from example — edit ${DEPLOY_DIR}/.env before production use"
  fi
}

# ── Download models ───────────────────────────────────────────────────────────
download_models() {
  info "Downloading ONNX models..."
  MODEL_BASE_URL="${MODEL_CDN_URL:-https://cdn.woundsense.in/models/v1}"
  MODEL_DIR="${DEPLOY_DIR}/models"

  for model in wound_unet.onnx tissue_classifier.pkl; do
    if [ ! -f "${MODEL_DIR}/${model}" ]; then
      info "Downloading ${model}..."
      curl -fL "${MODEL_BASE_URL}/${model}" -o "${MODEL_DIR}/${model}"
      info "✅ ${model} downloaded ($(du -h "${MODEL_DIR}/${model}" | cut -f1))"
    else
      info "✅ ${model} already present"
    fi
  done
}

# ── Start services ─────────────────────────────────────────────────────────────
start() {
  info "Building and starting WoundSense..."
  cd "${DEPLOY_DIR}"
  docker-compose pull redis 2>/dev/null || true
  docker-compose build --no-cache backend
  docker-compose up -d

  info "Waiting for backend to become healthy..."
  for i in {1..30}; do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
      info "✅ WoundSense is UP at http://$(hostname -I | awk '{print $1}'):8000"
      info "   API docs: http://$(hostname -I | awk '{print $1}'):8000/docs"
      return 0
    fi
    sleep 2
    echo -n "."
  done
  error "Backend did not start in time. Check: docker-compose logs backend"
}

# ── Update ─────────────────────────────────────────────────────────────────────
update() {
  info "Updating WoundSense..."
  cd "${DEPLOY_DIR}"
  git pull
  docker-compose build --no-cache backend
  docker-compose up -d --force-recreate backend
  info "✅ Update complete"
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  local do_update=false
  local with_models=false

  for arg in "$@"; do
    case $arg in
      --update)     do_update=true ;;
      --with-models) with_models=true ;;
    esac
  done

  check_deps

  if $do_update; then
    update
  else
    install
    $with_models && download_models
    start
  fi

  info "PHC Deployment complete 🏥"
}

main "$@"
