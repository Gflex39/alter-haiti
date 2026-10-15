---
name: instagram-feed-integration
description: Configure, update, or render the Alter Haiti Instagram feed using src/config.ts and src/services/instagram.ts. Use when adding Instagram posts, embedding reels/posts on the page, or connecting the Meta Instagram Graph API.
---

# Instagram Feed Integration

This skill covers how to manage and display posts from `@alterhaitinyfoundationinc` using the existing service layer in `src/config.ts` and `src/services/instagram.ts`.

## Architecture Overview

- **`src/config.ts`**: Exports `INSTAGRAM_CONFIG` containing:
  - `username`: `'alterhaitinyfoundationinc'`
  - `accountUrl`: `'https://www.instagram.com/alterhaitinyfoundationinc/'`
  - `accessToken`: Optional Meta Graph API token.
- **`src/services/instagram.ts`**: Exports `FetchedInstagramPost` and `fetchAllAccountPosts(): Promise<FetchedInstagramPost[]>`:
  - **Live Mode**: When `INSTAGRAM_CONFIG.accessToken` is non-empty, queries `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=...` and maps results into `FetchedInstagramPost` objects.
  - **Fallback Mode**: When no token is configured or the request fails, returns a curated array of fallback post objects with `id`, `permalink`, and `embedUrl` (`https://www.instagram.com/p/<SHORTCODE>/embed`).

## Security & Environment Variables

- **Never commit a live Meta Graph API token directly as a hardcoded string in `src/config.ts`.**
- Instead, read from Vite environment variables with an empty-string fallback:
  ```ts
  accessToken: import.meta.env.VITE_INSTAGRAM_ACCESS_TOKEN || ''
  ```
- Note that client-side tokens in static GitHub Pages builds are visible in network requests; only use read-only Instagram Basic Display / Graph tokens or prefer the curated `embedUrl` fallback list for zero-secret static hosting.

## Updating Curated Fallback Posts

To add or update static Instagram posts in `src/services/instagram.ts`:

1. Extract the shortcode from the Instagram post or reel URL (e.g., `https://www.instagram.com/p/ABC123xyz/` -> shortcode `ABC123xyz`).
2. Add an entry to the fallback array in `fetchAllAccountPosts()`:
   ```ts
   {
     id: 'ABC123xyz',
     permalink: 'https://www.instagram.com/p/ABC123xyz/',
     embedUrl: 'https://www.instagram.com/p/ABC123xyz/embed'
   }
   ```
3. Ensure each item in the fallback list has a unique `id` and a distinct shortcode (avoid duplicate placeholder entries when rendering in production).

## Rendering the Feed in React (`src/App.tsx`)

When wiring `fetchAllAccountPosts()` into `src/App.tsx` or a dedicated component:

1. Fetch posts inside a `React.useEffect` hook and store them in `useState<FetchedInstagramPost[]>([])`.
2. If `post.mediaUrl` is available (Graph API mode), render native `<img>` or `<video>` cards matching `.photo-card` in `src/index.css`, linking out to `post.permalink`.
3. If only `post.embedUrl` is available (Fallback mode), render responsive `<iframe src={post.embedUrl} ... loading="lazy" />` cards or link cards pointing to `INSTAGRAM_CONFIG.accountUrl`.
