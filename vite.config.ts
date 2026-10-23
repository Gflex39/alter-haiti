import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore - JS serverless function module
import { fetchDriveFolderPhotos } from './api/photos.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-api-photos',
      configureServer(server) {
        server.middlewares.use('/api/photos', async (req, res) => {
          const url = new URL(req.url || '', 'http://localhost');
          const folderInput =
            url.searchParams.get('folderId') ||
            url.searchParams.get('folder') ||
            process.env.GOOGLE_DRIVE_FOLDER_ID ||
            process.env.VITE_GOOGLE_DRIVE_FOLDER_URL ||
            '';
          const apiKey =
            url.searchParams.get('apiKey') ||
            process.env.GOOGLE_DRIVE_API_KEY ||
            process.env.VITE_GOOGLE_DRIVE_API_KEY ||
            '';

          res.setHeader('Content-Type', 'application/json');
          if (!folderInput) {
            res.end(JSON.stringify({ photos: [], configured: false }));
            return;
          }
          try {
            const photos = await fetchDriveFolderPhotos(folderInput, apiKey);
            res.end(JSON.stringify({ photos, configured: true }));
          } catch (err) {
            res.end(
              JSON.stringify({
                photos: [],
                configured: true,
                error: err instanceof Error ? err.message : 'Unknown error',
              })
            );
          }
        });
      },
    },
  ],
  // Use relative paths so assets load correctly on both GitHub Pages subpaths and custom domains
  base: './',
});

