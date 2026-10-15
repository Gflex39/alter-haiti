#!/usr/bin/env bash
set -euo pipefail

echo "=== Alter Haiti Media & Gallery Audit ==="

ERRORS=0

# 1. Check for leading-slash /media/ references in src/
if grep -rn '"/media/' src/ || grep -rn "'/media/" src/; then
  echo "[ERROR] Found root-relative '/media/' path in src/. Use 'media/...' (no leading slash) for GitHub Pages compatibility."
  ERRORS=$((ERRORS + 1))
else
  echo "[OK] No root-relative '/media/' paths found in src/."
fi

# 2. Check that all media/... references in src/ exist in public/media/
REFERENCED=$(grep -rhoE "media/[a-zA-Z0-9._-]+" src/ | sort -u)
for ref in $REFERENCED; do
  if [ ! -f "public/$ref" ]; then
    echo "[ERROR] Missing file in public/: public/$ref (referenced in src/)"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "[OK] Checked $(echo "$REFERENCED" | wc -w) referenced media paths in src/."

# 3. Check for unused files in public/media/
for file in public/media/*; do
  [ -e "$file" ] || continue
  rel="${file#public/}"
  if ! echo "$REFERENCED" | grep -qx "$rel"; then
    echo "[WARN] Unused media file in public/$rel (not referenced in src/)"
  fi
done

# 4. Check for oversized images (>1MB) or videos (>10MB)
for file in public/media/*.jpg public/media/*.jpeg public/media/*.png public/media/*.webp; do
  [ -e "$file" ] || continue
  size=$(stat -c%s "$file")
  if [ "$size" -gt 1048576 ]; then
    echo "[WARN] Large image (>1MB): $file ($((size / 1024)) KB)"
  fi
done

for file in public/media/*.mp4 public/media/*.webm; do
  [ -e "$file" ] || continue
  size=$(stat -c%s "$file")
  if [ "$size" -gt 10485760 ]; then
    echo "[WARN] Large video (>10MB): $file ($((size / 1024 / 1024)) MB)"
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo "=== Audit failed with $ERRORS error(s). ==="
  exit 1
fi

echo "=== Media audit passed! ==="
