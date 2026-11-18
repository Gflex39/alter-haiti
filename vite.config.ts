import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore - JS serverless function module
import { fetchDriveFolderPhotos } from './api/photos.js';
// @ts-ignore - JS serverless function module
import { sanitizeUploadFilename } from './api/upload.js';
// @ts-ignore - JS shared auth module
import {
  computeMasterPwdTag,
  createHashedUserRecord,
  createSessionToken,
  normalizeUsername,
  safeTimingEqualStrings,
  toPublicUserSummaries,
  verifySessionToken,
  verifyUserPassword,
} from './lib/auth.js';

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

const LOCAL_MASTER_USERNAME = normalizeUsername(process.env.ADMIN_USERNAME || 'admin');
const LOCAL_MASTER_PASSWORD = process.env.ADMIN_PASSWORD || 'alterhaiti';
const LOCAL_PEPPER = `local-dev-pepper:${LOCAL_MASTER_PASSWORD}`;
const LOCAL_SECRET = `local-dev-secret:${LOCAL_MASTER_PASSWORD}`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-api-middlewares',
      configureServer(server) {
        // Keep sandbox test editor accounts in memory so git stays clean
        let localStoredUsers: any[] = [];

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

          if (req.method === 'GET') {
            try {
              const raw = await fs.readFile(contentFile, 'utf8');
              res.end(
                JSON.stringify({
                  ok: true,
                  content: JSON.parse(raw),
                  configured: {
                    hasAdminPassword: true,
                    hasGithubToken: true,
                  },
                  localDev: true,
                  localUsers: toPublicUserSummaries(localStoredUsers, LOCAL_MASTER_USERNAME),
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
              const action = body.action || 'publish';

              if (action === 'login') {
                const u = normalizeUsername(body.username);
                const p = String(body.password || '');

                if (u === LOCAL_MASTER_USERNAME && safeTimingEqualStrings(p, LOCAL_MASTER_PASSWORD)) {
                  const pwdTag = computeMasterPwdTag(LOCAL_MASTER_PASSWORD, LOCAL_PEPPER);
                  const sessionToken = createSessionToken(
                    { username: LOCAL_MASTER_USERNAME, role: 'owner', pwdTag },
                    LOCAL_SECRET
                  );
                  res.end(
                    JSON.stringify({
                      ok: true,
                      sessionToken,
                      user: { username: LOCAL_MASTER_USERNAME, role: 'owner' },
                      users: toPublicUserSummaries(localStoredUsers, LOCAL_MASTER_USERNAME),
                    })
                  );
                  return;
                }

                const matched = localStoredUsers.find(
                  (item) => normalizeUsername(item.username) === u
                );
                if (matched && verifyUserPassword(matched, p, LOCAL_PEPPER)) {
                  const sessionToken = createSessionToken(
                    {
                      username: u,
                      role: 'editor',
                      pwdTag: String(matched.hash || '').slice(0, 16),
                    },
                    LOCAL_SECRET
                  );
                  res.end(
                    JSON.stringify({
                      ok: true,
                      sessionToken,
                      user: { username: u, role: 'editor' },
                      users: toPublicUserSummaries(localStoredUsers, LOCAL_MASTER_USERNAME),
                    })
                  );
                  return;
                }

                res.statusCode = 401;
                res.end(
                  JSON.stringify({
                    ok: false,
                    code: 'UNAUTHORIZED',
                    error: 'Incorrect username or password.',
                  })
                );
                return;
              }

              // Authenticate local session (also accept auto-preview token in localDev)
              let activeUser: { username: string; role: 'owner' | 'editor' } | null = null;
              if (body.sessionToken === 'local-dev-owner') {
                activeUser = { username: LOCAL_MASTER_USERNAME, role: 'owner' };
              } else {
                const decoded = verifySessionToken(body.sessionToken, LOCAL_SECRET);
                if (decoded) {
                  if (decoded.role === 'owner' && decoded.username === LOCAL_MASTER_USERNAME) {
                    activeUser = { username: LOCAL_MASTER_USERNAME, role: 'owner' };
                  } else {
                    const m = localStoredUsers.find(
                      (item) => normalizeUsername(item.username) === decoded.username
                    );
                    if (m && String(m.hash || '').slice(0, 16) === decoded.pwdTag) {
                      activeUser = { username: decoded.username, role: 'editor' };
                    }
                  }
                }
              }

              if (action === 'verify-session') {
                if (!activeUser) {
                  res.statusCode = 401;
                  res.end(JSON.stringify({ ok: false, code: 'UNAUTHORIZED' }));
                  return;
                }
                res.end(
                  JSON.stringify({
                    ok: true,
                    user: activeUser,
                    users: toPublicUserSummaries(localStoredUsers, LOCAL_MASTER_USERNAME),
                  })
                );
                return;
              }

              if (!activeUser) {
                res.statusCode = 401;
                res.end(
                  JSON.stringify({
                    ok: false,
                    code: 'UNAUTHORIZED',
                    error: 'Session expired. Please sign in again.',
                  })
                );
                return;
              }

              if (action === 'upsert-user') {
                if (activeUser.role !== 'owner') {
                  res.statusCode = 403;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'Only the Master Admin account can add or update users.',
                    })
                  );
                  return;
                }
                const target = normalizeUsername(body.username);
                if (target === LOCAL_MASTER_USERNAME) {
                  res.statusCode = 400;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: `"${LOCAL_MASTER_USERNAME}" is the Master Admin username.`,
                    })
                  );
                  return;
                }
                const record = createHashedUserRecord(target, body.password, LOCAL_PEPPER);
                const idx = localStoredUsers.findIndex(
                  (item) => normalizeUsername(item.username) === target
                );
                if (idx >= 0) {
                  localStoredUsers[idx] = record;
                } else {
                  localStoredUsers.push(record);
                }
                res.end(
                  JSON.stringify({
                    ok: true,
                    users: toPublicUserSummaries(localStoredUsers, LOCAL_MASTER_USERNAME),
                  })
                );
                return;
              }

              if (action === 'delete-user') {
                if (activeUser.role !== 'owner') {
                  res.statusCode = 403;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'Only the Master Admin account can remove users.',
                    })
                  );
                  return;
                }
                const target = normalizeUsername(body.username);
                localStoredUsers = localStoredUsers.filter(
                  (item) => normalizeUsername(item.username) !== target
                );
                res.end(
                  JSON.stringify({
                    ok: true,
                    users: toPublicUserSummaries(localStoredUsers, LOCAL_MASTER_USERNAME),
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
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
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
