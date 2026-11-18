import {
  authenticateAdminSession,
  getMasterAdminPassword,
  getMasterAdminUsername,
} from '../lib/auth.js';

const DEFAULT_REPO = 'Gflex39/alter-haiti';
const DEFAULT_BRANCH = 'main';
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_BYTES = 3.5 * 1024 * 1024;

export function sanitizeUploadFilename(originalName) {
  const raw = String(originalName || 'photo.jpg').trim();
  const parts = raw.split('.');
  const rawExt = parts.length > 1 ? parts.pop().toLowerCase() : 'jpg';
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : 'jpg';
  const stem =
    parts
      .join('.')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'photo';
  return `${Date.now()}-${stem}.${ext}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
  const githubToken = process.env.GITHUB_TOKEN || '';
  const masterUsername = getMasterAdminUsername();
  const masterPassword = getMasterAdminPassword();

  const missing = [
    ...(!masterPassword ? ['ADMIN_PASSWORD'] : []),
    ...(!githubToken ? ['GITHUB_TOKEN'] : []),
  ];
  if (missing.length > 0) {
    return res.status(200).json({
      ok: false,
      code: 'ENV_NOT_CONFIGURED',
      missing,
      error: `Missing Vercel environment variable(s): ${missing.join(', ')}`,
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const auth = await authenticateAdminSession({
    sessionToken: body.sessionToken,
    repo,
    branch,
    githubToken,
    masterUsername,
    masterPassword,
  });

  if (!auth.ok) {
    return res.status(auth.status).json({
      ok: false,
      code: auth.code,
      error: auth.error,
    });
  }

  const rawBase64 = String(body.contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!rawBase64) {
    return res.status(400).json({ ok: false, error: 'Missing image file data.' });
  }

  const byteLength = Buffer.byteLength(rawBase64, 'base64');
  if (byteLength > MAX_BYTES) {
    return res.status(400).json({
      ok: false,
      error: 'Image is too large. Please use an image under 3.5 MB.',
    });
  }

  const safeFilename = sanitizeUploadFilename(body.filename || 'photo.jpg');
  const repoFilePath = `public/media/uploads/${safeFilename}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${repoFilePath}`;

  try {
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Alter-Haiti-CMS',
      },
      body: JSON.stringify({
        message: `media: upload ${safeFilename} via visual editor (@${auth.user.username})`,
        content: rawBase64,
        branch,
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return res.status(500).json({
        ok: false,
        error: `GitHub upload failed (${putRes.status}): ${errText.slice(0, 200)}`,
      });
    }

    const instantUrl = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${repoFilePath}`;
    return res.status(200).json({
      ok: true,
      url: instantUrl,
      relativePath: `media/uploads/${safeFilename}`,
    });
  } catch (err) {
    console.error('Error uploading image:', err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Upload failed.',
    });
  }
}
