import fs from 'node:fs/promises';
import path from 'node:path';
import {
  authenticateAdminSession,
  authenticateCredentials,
  createHashedUserRecord,
  createSessionToken,
  getMasterAdminPassword,
  getMasterAdminUsername,
  getPepperSecret,
  getSessionSecret,
  normalizeUsername,
  saveUsersToGithub,
  toPublicUserSummaries,
} from '../lib/auth.js';

const DEFAULT_REPO = 'Gflex39/alter-haiti';
const DEFAULT_BRANCH = 'main';
const CONTENT_PATH = 'public/site-content.json';

async function readLocalContentFallback() {
  try {
    const localFile = path.join(process.cwd(), CONTENT_PATH);
    const raw = await fs.readFile(localFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchRemoteSiteContent({ repo, branch, githubToken }) {
  if (githubToken) {
    try {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(branch)}`;
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
          const decoded = Buffer.from(data.content, 'base64').toString('utf8');
          return JSON.parse(decoded);
        }
      }
    } catch (err) {
      console.warn('GitHub API content fetch failed, falling back:', err);
    }
  }

  try {
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${CONTENT_PATH}?t=${Math.floor(Date.now() / 10000)}`;
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'Alter-Haiti-CMS' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Raw GitHub content fetch failed, falling back to bundled file:', err);
  }

  return await readLocalContentFallback();
}

export async function commitContentToGithub({ repo, branch, githubToken, content, actorUsername }) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${CONTENT_PATH}`;
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
    throw new Error(`GitHub lookup failed (${getRes.status}): ${errText.slice(0, 200)}`);
  }

  const encoded = Buffer.from(JSON.stringify(content, null, 2) + '\n', 'utf8').toString('base64');
  const putBody = {
    message: `content: update website via visual editor (@${actorUsername || 'admin'})`,
    content: encoded,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub save failed (${putRes.status}): ${errText.slice(0, 240)}`);
  }

  const result = await putRes.json();
  return result?.commit?.html_url || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
  const githubToken = process.env.GITHUB_TOKEN || '';
  const masterUsername = getMasterAdminUsername();
  const masterPassword = getMasterAdminPassword();

  const configured = {
    hasAdminPassword: Boolean(masterPassword),
    hasGithubToken: Boolean(githubToken),
  };

  if (req.method === 'GET') {
    const isFresh = req.query && req.query.fresh === '1';
    const content = await fetchRemoteSiteContent({ repo, branch, githubToken });

    if (isFresh) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
    }

    return res.status(200).json({
      ok: true,
      content,
      configured,
      repo,
      branch,
    });
  }

  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const action = body.action || 'publish';

    const missing = [
      ...(!masterPassword ? ['ADMIN_PASSWORD'] : []),
      ...(!githubToken ? ['GITHUB_TOKEN'] : []),
    ];

    // 1. Username + Password Sign-In
    if (action === 'login') {
      if (missing.length > 0) {
        return res.status(200).json({
          ok: false,
          code: 'ENV_NOT_CONFIGURED',
          missing,
          configured,
          error: `Missing Vercel environment variable(s): ${missing.join(', ')}`,
        });
      }

      const result = await authenticateCredentials({
        username: body.username,
        password: body.password,
        repo,
        branch,
        githubToken,
        masterUsername,
        masterPassword,
      });

      if (!result.ok) {
        await new Promise((r) => setTimeout(r, 350));
        return res.status(401).json({
          ok: false,
          code: 'UNAUTHORIZED',
          error: result.error || 'Incorrect username or password.',
        });
      }

      const secret = getSessionSecret({ githubToken, adminPassword: masterPassword });
      const sessionToken = createSessionToken(
        {
          username: result.user.username,
          role: result.user.role,
          pwdTag: result.pwdTag,
        },
        secret
      );

      return res.status(200).json({
        ok: true,
        sessionToken,
        user: result.user,
        users: result.users,
        configured,
      });
    }

    // 2. Verify Existing Session Token
    if (action === 'verify-session') {
      if (missing.length > 0) {
        return res.status(200).json({
          ok: false,
          code: 'ENV_NOT_CONFIGURED',
          missing,
          configured,
        });
      }

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

      return res.status(200).json({
        ok: true,
        user: auth.user,
        users: auth.users,
        configured,
      });
    }

    // All remaining write actions require env vars + active verified session
    if (missing.length > 0) {
      return res.status(200).json({
        ok: false,
        code: 'ENV_NOT_CONFIGURED',
        missing,
        configured,
        error: `Missing Vercel environment variable(s): ${missing.join(', ')}`,
      });
    }

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

    // 3. Create or Reset an Editor User Account (Owner only)
    if (action === 'upsert-user') {
      if (auth.user.role !== 'owner') {
        return res.status(403).json({
          ok: false,
          error: 'Only the Master Admin account can add or update user passwords.',
        });
      }

      try {
        const targetUsername = normalizeUsername(body.username);
        if (targetUsername === masterUsername) {
          return res.status(400).json({
            ok: false,
            error: `"${masterUsername}" is the Master Admin username controlled by ADMIN_PASSWORD in Vercel.`,
          });
        }

        const pepper = getPepperSecret(masterPassword);
        const freshRecord = createHashedUserRecord(targetUsername, body.password, pepper);
        const existingList = Array.isArray(auth.storedUsers) ? auth.storedUsers : [];
        const existingIdx = existingList.findIndex(
          (u) => normalizeUsername(u.username) === targetUsername
        );

        const nextStored = [...existingList];
        if (existingIdx >= 0) {
          nextStored[existingIdx] = {
            ...freshRecord,
            createdAt: existingList[existingIdx].createdAt || freshRecord.createdAt,
          };
        } else {
          nextStored.push(freshRecord);
        }

        await saveUsersToGithub({
          repo,
          branch,
          githubToken,
          users: nextStored,
          existingSha: auth.storedUsersSha,
          message: `security: ${existingIdx >= 0 ? 'update password for' : 'add'} studio user @${targetUsername}`,
        });

        return res.status(200).json({
          ok: true,
          users: toPublicUserSummaries(nextStored, masterUsername),
        });
      } catch (err) {
        return res.status(400).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Could not save user account.',
        });
      }
    }

    // 4. Delete an Editor User Account (Owner only)
    if (action === 'delete-user') {
      if (auth.user.role !== 'owner') {
        return res.status(403).json({
          ok: false,
          error: 'Only the Master Admin account can remove users.',
        });
      }

      try {
        const targetUsername = normalizeUsername(body.username);
        if (targetUsername === masterUsername) {
          return res.status(400).json({
            ok: false,
            error: 'Cannot remove the Master Admin account.',
          });
        }

        const existingList = Array.isArray(auth.storedUsers) ? auth.storedUsers : [];
        const nextStored = existingList.filter(
          (u) => normalizeUsername(u.username) !== targetUsername
        );

        await saveUsersToGithub({
          repo,
          branch,
          githubToken,
          users: nextStored,
          existingSha: auth.storedUsersSha,
          message: `security: revoke studio user @${targetUsername}`,
        });

        return res.status(200).json({
          ok: true,
          users: toPublicUserSummaries(nextStored, masterUsername),
        });
      } catch (err) {
        return res.status(400).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Could not remove user account.',
        });
      }
    }

    // 5. Publish Website Content
    const nextContent = body.content;
    if (
      !nextContent ||
      typeof nextContent !== 'object' ||
      !Array.isArray(nextContent.sections) ||
      !nextContent.theme ||
      !nextContent.header ||
      !nextContent.footer
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid site content payload.',
      });
    }

    const stampedContent = {
      ...nextContent,
      version: Number(nextContent.version || 1),
      updatedAt: new Date().toISOString(),
    };

    try {
      const commitUrl = await commitContentToGithub({
        repo,
        branch,
        githubToken,
        content: stampedContent,
        actorUsername: auth.user.username,
      });
      return res.status(200).json({
        ok: true,
        content: stampedContent,
        commitUrl,
      });
    } catch (err) {
      console.error('Error saving site content:', err);
      return res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to publish site content.',
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
