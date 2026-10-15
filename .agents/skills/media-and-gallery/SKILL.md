---
name: media-and-gallery
description: Manage photos, videos, and the Community Gallery in the Alter Haiti website. Use when adding, removing, reordering, optimizing, or auditing images and videos in public/media/ or updating GALLERY_IMAGES and video banners in src/App.tsx.
---

# Media & Community Gallery Management

This skill governs how static images (`public/media/*.jpg`) and videos (`public/media/*.mp4`) are added, referenced, and validated in the Alter Haiti Foundation website.

## Critical Path Rule (GitHub Pages Subpath Compatibility)

The site is built with Vite (`base: './'` in `vite.config.ts`) and deployed to GitHub Pages under a repository subpath (`/alter-haiti/`).

- **ALWAYS use relative paths without a leading slash** when referencing files in `public/media/` inside JSX/HTML:
  - Correct: `src="media/img1.jpg"`, `src="media/jacmel3.mp4"`
  - Incorrect: `src="/media/img1.jpg"` (breaks on GitHub Pages subpaths by resolving to the domain root)

## Adding New Photos to the Community Gallery

1. **Place the image file** in `public/media/`:
   - Follow the naming convention `img<N>.jpg` (e.g., `img17.jpg`) or a descriptive lowercase filename if used outside the numbered gallery.
   - Keep image sizes reasonable for web delivery (ideally `< 500 KB` per photo, `4:3` friendly aspect ratio since `.photo-card` uses `aspect-ratio: 4 / 3` and `object-fit: cover`).
2. **Register the image** in `src/App.tsx`:
   - Add `'media/img<N>.jpg'` to the `GALLERY_IMAGES` array at the top of `src/App.tsx`.
3. **Preserve accessibility and performance attributes**:
   - Keep `loading="lazy"` on gallery `<img>` elements.
   - Ensure `alt` text accurately describes the Jacmel mission activity if custom captions/alt text are added.

## Adding or Updating Hero & Banner Videos

1. Place MP4 video files in `public/media/`.
2. Use the required autoplay video attributes in `src/App.tsx` so mobile and desktop browsers play them inline without user interaction:
   ```tsx
   <video
     src="media/your-video.mp4"
     className="hero-video" // or "banner-video"
     autoPlay
     muted
     loop
     playsInline
   />
   ```
3. Keep video files compressed (ideally `< 5 MB`) to avoid slow initial page loads.

## Validation Script

Run the bundled media audit script from the repository root to verify all media references, check for accidental leading-slash paths, find unused media files, and flag oversized assets:

```bash
bash .agents/skills/media-and-gallery/scripts/check-media.sh
```
