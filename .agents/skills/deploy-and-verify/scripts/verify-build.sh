#!/usr/bin/env bash
set -euo pipefail

echo "=== Alter Haiti Build & Deployment Verification ==="

# 1. Run media check if available
if [ -f ".agents/skills/media-and-gallery/scripts/check-media.sh" ]; then
  bash .agents/skills/media-and-gallery/scripts/check-media.sh
fi

# 2. Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "[INFO] Installing dependencies via npm ci..."
  npm ci
fi

# 3. Run TypeScript check and Vite production build
echo "[INFO] Running npm run build (tsc && vite build)..."
npm run build

# 4. Verify dist/index.html exists and uses relative asset paths
if [ ! -f "dist/index.html" ]; then
  echo "[ERROR] dist/index.html was not generated!"
  exit 1
fi

if grep -qE '(src|href)="/assets/' dist/index.html; then
  echo "[ERROR] dist/index.html contains root-absolute '/assets/' paths. Ensure base: './' is set in vite.config.ts."
  exit 1
fi

echo "[OK] dist/index.html uses relative asset paths for GitHub Pages."
echo "=== Build verification succeeded! ==="
