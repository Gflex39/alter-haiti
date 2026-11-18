import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const USERS_FILE_PATH = 'config/admin-users.json';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function normalizeUsername(input) {
  return String(input || '').trim().toLowerCase();
}

export function isValidUsername(username) {
  const normalized = normalizeUsername(username);
  return /^[a-z0-9._-]{2,40}$/.test(normalized);
}

export function getMasterAdminUsername() {
  return normalizeUsername(process.env.ADMIN_USERNAME || 'admin') || 'admin';
}

export function getMasterAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || '');
}

export function getPepperSecret(adminPassword) {
  const base = process.env.SESSION_SECRET || adminPassword || '';
  if (!base) return '';
  return `alter-haiti-pwd-pepper:${base}`;
}

export function getSessionSecret({ githubToken, adminPassword }) {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (githubToken && adminPassword) {
    return `alter-haiti-session:${githubToken}:${adminPassword}`;
  }
  return '';
}

export function safeTimingEqualStrings(aStr, bStr) {
  const aHash = crypto.createHash('sha256').update(String(aStr)).digest();
  const bHash = crypto.createHash('sha256').update(String(bStr)).digest();
  return crypto.timingSafeEqual(aHash, bHash) && String(aStr).length === String(bStr).length;
}

export function computeMasterPwdTag(adminPassword, pepper) {
  return crypto
    .createHmac('sha256', pepper || 'local')
    .update(`owner:${adminPassword}`)
    .digest('hex')
    .slice(0, 16);
}

export function hashPassword(password, saltHex, pepper) {
  const peppered = crypto
    .createHmac('sha256', pepper)
    .update(String(password))
    .digest();
  return crypto.scryptSync(peppered, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

export function createHashedUserRecord(username, plainPassword, pepper) {
  const cleanUser = normalizeUsername(username);
  if (!isValidUsername(cleanUser)) {
    throw new Error(
      'Username must be 2–40 characters using letters, numbers, dots, hyphens, or underscores.'
    );
  }
  if (!plainPassword || String(plainPassword).length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(plainPassword, salt, pepper);
  const now = new Date().toISOString();
  return {
    username: cleanUser,
    salt,
    hash,
    createdAt: now,
    updatedAt: now,
  };
}

export function verifyUserPassword(userRecord, plainPassword, pepper) {
  if (!userRecord || !userRecord.salt || !userRecord.hash || !plainPassword || !pepper) {
    return false;
  }
  const computedHex = hashPassword(plainPassword, userRecord.salt, pepper);
  const a = Buffer.from(computedHex, 'hex');
  const b = Buffer.from(userRecord.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSessionToken({ username, role, pwdTag }, secret) {
  const payload = {
    username: normalizeUsername(username),
    role: role === 'owner' ? 'owner' : 'editor',
    pwdTag: String(pwdTag || ''),
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
    if (!payload || !payload.username || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }
    return {
      username: normalizeUsername(payload.username),
      role: payload.role === 'owner' ? 'owner' : 'editor',
      pwdTag: String(payload.pwdTag || ''),
    };
  } catch {
    return null;
  }
}

async function readLocalUsersFallback() {
  try {
    const filePath = path.join(process.cwd(), USERS_FILE_PATH);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.users)) {
      return parsed.users;
    }
  } catch {
    // Fallback to empty list
  }
  return [];
}

export async function fetchStoredUsers({ repo, branch, githubToken }) {
  if (githubToken) {
    try {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${USERS_FILE_PATH}?ref=${encodeURIComponent(branch)}`;
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
          if (parsed && Array.isArray(parsed.users)) {
            return { users: parsed.users, sha: data.sha };
          }
        }
      } else if (res.status === 404) {
        return { users: [], sha: undefined };
      }
    } catch (err) {
      console.warn('GitHub users lookup failed, falling back:', err);
    }
  }

  const fallbackUsers = await readLocalUsersFallback();
  return { users: fallbackUsers, sha: undefined };
}

export function toPublicUserSummaries(storedUsers, masterUsername) {
  const items = [
    {
      username: masterUsername,
      role: 'owner',
      updatedAt: null,
    },
  ];
  for (const u of storedUsers) {
    if (u && u.username && normalizeUsername(u.username) !== masterUsername) {
      items.push({
        username: normalizeUsername(u.username),
        role: 'editor',
        updatedAt: u.updatedAt || u.createdAt || null,
      });
    }
  }
  return items;
}

export async function saveUsersToGithub({ repo, branch, githubToken, users, existingSha, message }) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${USERS_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Alter-Haiti-CMS',
  };

  let sha = existingSha;
  if (!sha) {
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      throw new Error(`GitHub users lookup failed (${getRes.status}): ${errText.slice(0, 180)}`);
    }
  }

  const payload = {
    users,
    updatedAt: new Date().toISOString(),
  };

  const encoded = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8').toString('base64');
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: message || 'security: update website studio user accounts',
      content: encoded,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Failed to save user accounts (${putRes.status}): ${errText.slice(0, 200)}`);
  }
}

export async function authenticateCredentials({
  username,
  password,
  repo,
  branch,
  githubToken,
  masterUsername,
  masterPassword,
}) {
  const cleanUsername = normalizeUsername(username);
  const rawPassword = String(password || '');
  const pepper = getPepperSecret(masterPassword);

  if (!cleanUsername || !rawPassword) {
    return { ok: false, error: 'Please enter both username and password.' };
  }

  const { users } = await fetchStoredUsers({ repo, branch, githubToken });

  // 1. Check Master Owner credentials from Vercel Environment Variables
  if (cleanUsername === masterUsername) {
    if (safeTimingEqualStrings(rawPassword, masterPassword)) {
      const pwdTag = computeMasterPwdTag(masterPassword, pepper);
      return {
        ok: true,
        user: { username: masterUsername, role: 'owner' },
        pwdTag,
        users: toPublicUserSummaries(users, masterUsername),
      };
    }
    return { ok: false, error: 'Incorrect username or password.' };
  }

  // 2. Check Managed Editor Accounts in config/admin-users.json
  const matched = users.find((u) => normalizeUsername(u.username) === cleanUsername);
  if (matched && verifyUserPassword(matched, rawPassword, pepper)) {
    return {
      ok: true,
      user: { username: cleanUsername, role: 'editor' },
      pwdTag: String(matched.hash || '').slice(0, 16),
      users: toPublicUserSummaries(users, masterUsername),
    };
  }

  return { ok: false, error: 'Incorrect username or password.' };
}

export async function authenticateAdminSession({
  sessionToken,
  repo,
  branch,
  githubToken,
  masterUsername,
  masterPassword,
}) {
  const secret = getSessionSecret({ githubToken, adminPassword: masterPassword });
  const pepper = getPepperSecret(masterPassword);
  const decoded = verifySessionToken(sessionToken, secret);
  if (!decoded) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'Your session expired or is invalid. Please sign in again.',
    };
  }

  const { users, sha } = await fetchStoredUsers({ repo, branch, githubToken });

  if (decoded.role === 'owner' && decoded.username === masterUsername) {
    const expectedTag = computeMasterPwdTag(masterPassword, pepper);
    if (decoded.pwdTag !== expectedTag) {
      return {
        ok: false,
        status: 401,
        code: 'UNAUTHORIZED',
        error: 'Session invalidated because the master password changed. Please sign in again.',
      };
    }
    return {
      ok: true,
      user: { username: masterUsername, role: 'owner' },
      storedUsers: users,
      storedUsersSha: sha,
      users: toPublicUserSummaries(users, masterUsername),
    };
  }

  const matched = users.find((u) => normalizeUsername(u.username) === decoded.username);
  if (!matched || String(matched.hash || '').slice(0, 16) !== decoded.pwdTag) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_USER',
      error: 'Your account access was updated or revoked. Please sign in again.',
    };
  }

  return {
    ok: true,
    user: { username: decoded.username, role: 'editor' },
    storedUsers: users,
    storedUsersSha: sha,
    users: toPublicUserSummaries(users, masterUsername),
  };
}
