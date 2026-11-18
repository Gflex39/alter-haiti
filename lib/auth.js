import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ALLOWLIST_PATH = 'config/allowed-admins.json';
export const DEFAULT_ALLOWED_EMAILS = ['gfexatschool@gmail.com'];
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254;
}

export function getEnvPinnedEmails() {
  const raw = process.env.ALLOWED_ADMIN_EMAILS || '';
  if (!raw.trim()) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map(normalizeEmail)
        .filter(isValidEmail)
    )
  );
}

export function getSessionSecret({ githubToken, googleClientId }) {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (githubToken && googleClientId) {
    return `alter-haiti-session:${githubToken}:${googleClientId}`;
  }
  return '';
}

export function createSessionToken(user, secret) {
  const payload = {
    email: normalizeEmail(user.email),
    name: String(user.name || user.email || ''),
    picture: String(user.picture || ''),
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !secret) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || !payload.email || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }
    return {
      email: normalizeEmail(payload.email),
      name: String(payload.name || payload.email),
      picture: String(payload.picture || ''),
    };
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken, expectedClientId) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Google credential token.');
  }
  if (!expectedClientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server.');
  }

  const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(verifyUrl);
  if (!res.ok) {
    throw new Error('Invalid or expired Google sign-in token.');
  }

  const data = await res.json();
  if (data.aud !== expectedClientId) {
    throw new Error('Google token client ID mismatch.');
  }
  if (
    data.iss !== 'accounts.google.com' &&
    data.iss !== 'https://accounts.google.com'
  ) {
    throw new Error('Invalid token issuer.');
  }
  const emailVerified = data.email_verified === true || data.email_verified === 'true';
  if (!emailVerified || !data.email) {
    throw new Error('Your Google account email must be verified.');
  }
  if (data.exp && Number(data.exp) * 1000 < Date.now()) {
    throw new Error('Google sign-in token expired. Please sign in again.');
  }

  return {
    email: normalizeEmail(data.email),
    name: String(data.name || data.email),
    picture: String(data.picture || ''),
  };
}

async function readLocalAllowlistFallback() {
  try {
    const filePath = path.join(process.cwd(), ALLOWLIST_PATH);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.allowedEmails)) {
      return parsed.allowedEmails.map(normalizeEmail).filter(isValidEmail);
    }
  } catch {
    // Fallback to default
  }
  return [...DEFAULT_ALLOWED_EMAILS];
}

export async function fetchAllowedEmails({ repo, branch, githubToken }) {
  const envPinned = getEnvPinnedEmails();
  let storedEmails = null;

  if (githubToken) {
    try {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${ALLOWLIST_PATH}?ref=${encodeURIComponent(branch)}`;
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Alter-Haiti-CMS',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.content) {
          const parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
          if (parsed && Array.isArray(parsed.allowedEmails)) {
            storedEmails = parsed.allowedEmails.map(normalizeEmail).filter(isValidEmail);
          }
        }
      }
    } catch (err) {
      console.warn('GitHub allowlist lookup failed, falling back:', err);
    }
  }

  if (!storedEmails) {
    storedEmails = await readLocalAllowlistFallback();
  }

  const merged = Array.from(new Set([...envPinned, ...storedEmails]));
  return {
    allowedEmails: merged.length > 0 ? merged : [...DEFAULT_ALLOWED_EMAILS],
    envPinnedEmails: envPinned,
  };
}

export async function saveAllowedEmailsToGithub({
  repo,
  branch,
  githubToken,
  allowedEmails,
  actorEmail,
}) {
  const cleaned = Array.from(
    new Set((Array.isArray(allowedEmails) ? allowedEmails : []).map(normalizeEmail).filter(isValidEmail))
  );

  if (cleaned.length === 0) {
    throw new Error('At least one Google account must remain on the allowed list.');
  }
  if (actorEmail && !cleaned.includes(normalizeEmail(actorEmail))) {
    throw new Error('You cannot remove your own signed-in Google account from the allowed list.');
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${ALLOWLIST_PATH}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Alter-Haiti-CMS',
  };

  let existingSha = undefined;
  const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (getRes.ok) {
    const existing = await getRes.json();
    existingSha = existing.sha;
  } else if (getRes.status !== 404) {
    const errText = await getRes.text();
    throw new Error(`GitHub allowlist lookup failed (${getRes.status}): ${errText.slice(0, 180)}`);
  }

  const payload = {
    allowedEmails: cleaned,
    updatedAt: new Date().toISOString(),
  };

  const encoded = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8').toString('base64');
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: 'security: update allowed Google editor emails',
      content: encoded,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Failed to save allowed emails (${putRes.status}): ${errText.slice(0, 200)}`);
  }

  const envPinned = getEnvPinnedEmails();
  return Array.from(new Set([...envPinned, ...cleaned]));
}

export async function authenticateAdminSession({
  sessionToken,
  repo,
  branch,
  githubToken,
  googleClientId,
}) {
  const secret = getSessionSecret({ githubToken, googleClientId });
  const user = verifySessionToken(sessionToken, secret);
  if (!user) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'Your session expired or is invalid. Please sign in with Google again.',
    };
  }

  const { allowedEmails, envPinnedEmails } = await fetchAllowedEmails({
    repo,
    branch,
    githubToken,
  });

  if (!allowedEmails.includes(user.email)) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_EMAIL',
      error: `${user.email} is no longer on the allowed editors list.`,
    };
  }

  return {
    ok: true,
    user,
    allowedEmails,
    envPinnedEmails,
  };
}
