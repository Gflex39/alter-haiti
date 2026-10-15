---
name: deploy-and-verify
description: Build, typecheck, and verify the Alter Haiti website for GitHub Pages deployment. Use before committing changes, when debugging build or asset-loading issues, or when checking the GitHub Actions deployment workflow (.github/workflows/deploy.yml).
---

# Build Verification & GitHub Pages Deployment

This skill ensures that changes to the Alter Haiti website compile cleanly with TypeScript, bundle properly with Vite, and preserve relative asset paths required by GitHub Pages.

## Build & Deployment Pipeline

- **Local Build Command**: `npm run build` (runs `tsc && vite build`)
- **Output Directory**: `./dist`
- **Vite Config (`vite.config.ts`)**: Uses `base: './'` so generated HTML and CSS reference `./assets/...` relatively.
- **CI/CD Workflow (`.github/workflows/deploy.yml`)**:
  - Triggers automatically on push to `main` or manual `workflow_dispatch`.
  - Runs on `ubuntu-latest` with Node 20 (`npm ci` -> `npm run build`), uploads `./dist` via `actions/upload-pages-artifact@v3`, and deploys via `actions/deploy-pages@v4`.

## Pre-Commit Verification Procedure

Run the verification script from the repository root after making code or asset changes:

```bash
bash .agents/skills/deploy-and-verify/scripts/verify-build.sh
```

What the verification checks:
1. **Media Audit**: Runs `.agents/skills/media-and-gallery/scripts/check-media.sh` (if present) to verify all `media/...` paths.
2. **TypeScript & Vite Build**: Runs `npm run build` (`tsc && vite build`).
3. **Dist Output Inspection**: Verifies `dist/index.html` exists and uses relative `./assets/` paths rather than root-absolute `/assets/` paths.
