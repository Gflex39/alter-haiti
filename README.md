# Alter Haiti Foundation Inc.

Official website and built-in visual CMS for **Alter Haiti Foundation Inc.** and its **Jacmel Revitalization Mission** — focused on solar illumination, education, and community sanitation in Jacmel, Haiti.

## Features

- **Section-Driven Site (`public/site-content.json`)** — Supports configurable `hero`, `mission`, `banner`, `split`, `pillars`, `cta`, and `gallery` sections alongside customizable theme colors, font presets (`editorial`, `serif`, `modern`), header, and footer settings.
- **Visual Admin Studio (`/admin`)** — Browser-based editor accessible at `/admin` (or `#admin`, `#edit`, `?edit=1`) for editing content inline, uploading images, managing approved editor emails, and publishing directly to the repository.
- **Google Sign-In & Allowlist Auth** — Admin write actions verify Google ID tokens, issue signed 12-hour session tokens, and enforce an editor allowlist stored in `config/allowed-admins.json`.
- **Google Drive Photo Gallery** — Automatically syncs community photos from a shared Google Drive folder via `/api/photos` without requiring an API key (with optional Drive v3 API support).
- **Local Dev Middleware** — `vite.config.ts` emulates `/api/content`, `/api/upload`, and `/api/photos` locally so you can test edits and uploads directly against local files without configuring production tokens.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite 5, `lucide-react`
- **Backend / CMS API:** Vercel Serverless Functions (`api/`) + GitHub Contents API
- **Static Hosting:** Vercel (recommended for full CMS API support) and GitHub Pages (`.github/workflows/deploy.yml`)

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
npm install
npm run dev
```

Open the local Vite dev server in your browser, and visit `/admin` to try the visual editor locally (changes write directly to `public/site-content.json`, `public/media/uploads/`, and `config/allowed-admins.json`).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with local API middleware |
| `npm run build` | Run TypeScript type-checking (`tsc`) and build production assets to `dist/` |
| `npm run preview` | Preview the production build locally |

## Environment Variables

Configure these environment variables in Vercel (or a local `.env` file when testing against Google services):

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | For `/admin` in production | Google OAuth Client ID used to verify Admin Studio sign-in (`VITE_GOOGLE_CLIENT_ID` is also supported as a client fallback) |
| `GITHUB_TOKEN` | For `/admin` in production | GitHub token with repository `Contents: Read and write` permission for committing content, uploads, and allowlist changes |
| `GITHUB_REPO` | Optional | Target GitHub repository in `owner/repo` format (defaults to `Gflex39/alter-haiti`) |
| `GITHUB_BRANCH` | Optional | Target branch for reads and commits (defaults to `main`) |
| `ALLOWED_ADMIN_EMAILS` | Optional | Comma- or space-separated Google emails pinned as allowed admins in addition to `config/allowed-admins.json` |
| `SESSION_SECRET` | Optional | Secret used to sign admin session tokens |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional | Shared Google Drive folder URL or ID for gallery photos (`VITE_GOOGLE_DRIVE_FOLDER_URL` is also supported) |
| `GOOGLE_DRIVE_API_KEY` | Optional | Google Drive API v3 key (falls back to Google Drive's public embedded folder view when omitted) |

## API Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/content` | `GET` | Returns `public/site-content.json` and CMS configuration status |
| `/api/content` | `POST` | Authenticates Google sign-in (`google-login`), validates sessions (`verify-session`), updates `config/allowed-admins.json` (`update-allowlist`), or publishes content to GitHub |
| `/api/upload` | `POST` | Uploads an image (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, up to 3.5 MB) to `public/media/uploads/` |
| `/api/photos` | `GET` | Fetches image entries from the configured public Google Drive folder |

## Project Structure

```text
.
├── api/                     # Vercel serverless functions (content, photos, upload)
├── config/                  # Allowed admin Google accounts (allowed-admins.json)
├── lib/                     # Shared Google OAuth & session verification helpers
├── public/
│   ├── media/               # Static images, videos, and uploaded media
│   └── site-content.json    # Live site content & theme configuration
├── src/
│   ├── components/          # SiteRenderer, AdminStudio, EditableText
│   ├── services/            # CMS, Google Drive, and Instagram helpers
│   ├── types/               # SiteContent schema and defaults
│   ├── App.tsx              # Public site / Admin Studio router
│   └── config.ts            # Client-side integration defaults
├── .github/workflows/       # GitHub Pages deployment workflow
├── vercel.json              # Vercel rewrites (/admin -> /index.html)
└── vite.config.ts           # Vite config + local dev API middleware
```

## Deployment

- **Vercel:** Connect the repository in Vercel and set `GOOGLE_CLIENT_ID` and `GITHUB_TOKEN` to enable the full Admin Studio and serverless API endpoints. `vercel.json` automatically rewrites `/admin` to `/index.html`.
- **GitHub Pages:** Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds `dist/` and publishes the static site automatically.
