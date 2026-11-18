import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore - JS serverless function module
import { fetchDriveFolderPhotos } from './api/photos.js';
// @ts-ignore - JS serverless function module
import { sanitizeUploadFilename } from './api/upload.js';
// @ts-ignore - JS shared auth module
import { DEFAULT_ALLOWED_EMAILS, isValidEmail, normalizeEmail } from './lib/auth.js';

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function readLocalAllowedList(allowlistFile: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(allowlistFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.allowedEmails)) {
      const cleaned = parsed.allowedEmails.map(normalizeEmail).filter(isValidEmail);
      if (cleaned.length > 0) return cleaned;
    }
  } catch {
    // Fallback
  }
  return [...DEFAULT_ALLOWED_EMAILS];
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-api-middlewares',
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

        server.middlewares.use('/api/content', async (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          const contentFile = path.resolve(process.cwd(), 'public/site-content.json');
          const allowlistFile = path.resolve(process.cwd(), 'config/allowed-admins.json');
          const googleClientId =
            process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';

          if (req.method === 'GET') {
            try {
              const raw = await fs.readFile(contentFile, 'utf8');
              const allowedEmails = await readLocalAllowedList(allowlistFile);
              res.end(
                JSON.stringify({
                  ok: true,
                  content: JSON.parse(raw),
                  googleClientId,
                  configured: {
                    hasGoogleClientId: Boolean(googleClientId),
                    hasGithubToken: true,
                  },
                  localDev: true,
                  localAllowedEmails: allowedEmails,
                })
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
            return;
          }

          if (req.method === 'POST') {
            try {
              const body = await readJsonBody(req);
              const allowedEmails = await readLocalAllowedList(allowlistFile);

              if (body.action === 'sandbox-login' || body.action === 'verify-session') {
                const requestedEmail = normalizeEmail(
                  body.email || allowedEmails[0] || 'gfexatschool@gmail.com'
                );
                if (!allowedEmails.includes(requestedEmail)) {
                  res.statusCode = 403;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      code: 'FORBIDDEN_EMAIL',
                      error: `Access denied: ${requestedEmail} is not on the approved editors list.`,
                    })
                  );
                  return;
                }
                res.end(
                  JSON.stringify({
                    ok: true,
                    sessionToken: `local-dev-session:${requestedEmail}`,
                    user: {
                      email: requestedEmail,
                      name: requestedEmail.split('@')[0],
                      picture: '',
                    },
                    allowedEmails,
                    envPinnedEmails: [],
                    localDev: true,
                  })
                );
                return;
              }

              if (body.action === 'update-allowlist') {
                const nextEmails: string[] = Array.from(
                  new Set(
                    (Array.isArray(body.allowedEmails) ? body.allowedEmails : [])
                      .map(normalizeEmail)
                      .filter(isValidEmail)
                  )
                );
                if (nextEmails.length === 0) {
                  res.statusCode = 400;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'At least one Google account must remain on the allowed list.',
                    })
                  );
                  return;
                }
                await fs.mkdir(path.dirname(allowlistFile), { recursive: true });
                await fs.writeFile(
                  allowlistFile,
                  JSON.stringify(
                    { allowedEmails: nextEmails, updatedAt: new Date().toISOString() },
                    null,
                    2
                  ) + '\n',
                  'utf8'
                );
                res.end(
                  JSON.stringify({
                    ok: true,
                    allowedEmails: nextEmails,
                    envPinnedEmails: [],
                  })
                );
                return;
              }

              const stamped = {
                ...body.content,
                version: Number(body.content?.version || 1),
                updatedAt: new Date().toISOString(),
              };
              await fs.writeFile(contentFile, JSON.stringify(stamped, null, 2) + '\n', 'utf8');
              res.end(JSON.stringify({ ok: true, content: stamped, localDev: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
        });

        server.middlewares.use('/api/upload', async (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
            return;
          }
          try {
            const body = await readJsonBody(req);
            const rawBase64 = String(body.contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
            const safeName = sanitizeUploadFilename(body.filename || 'photo.jpg');
            const uploadDir = path.resolve(process.cwd(), 'public/media/uploads');
            await fs.mkdir(uploadDir, { recursive: true });
            await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(rawBase64, 'base64'));
            res.end(
              JSON.stringify({
                ok: true,
                url: `/media/uploads/${safeName}`,
                relativePath: `media/uploads/${safeName}`,
              })
            );
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      },
    },
  ],
  server: {
    host: true,
    allowedHosts: true,
  },
  // Use relative paths so assets load correctly on both GitHub Pages subpaths and custom domains
  base: './',
});
