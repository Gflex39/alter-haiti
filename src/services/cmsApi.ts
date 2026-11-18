import { GOOGLE_AUTH_CONFIG } from '../config';
import { DEFAULT_SITE_CONTENT, resolveAssetUrl, SiteContent } from '../types/cms';

export interface ServerConfigStatus {
  hasGoogleClientId: boolean;
  hasGithubToken: boolean;
}

export interface AdminUserProfile {
  email: string;
  name: string;
  picture?: string;
}

export interface FetchContentResult {
  content: SiteContent;
  googleClientId: string;
  configured: ServerConfigStatus;
  localDev?: boolean;
  localAllowedEmails?: string[];
}

export interface AuthSessionResult {
  ok: boolean;
  code?: 'ENV_NOT_CONFIGURED' | 'FORBIDDEN_EMAIL' | 'UNAUTHORIZED' | string;
  missing?: string[];
  email?: string;
  error?: string;
  sessionToken?: string;
  user?: AdminUserProfile;
  allowedEmails?: string[];
  envPinnedEmails?: string[];
}

export interface PublishResult {
  ok: boolean;
  code?: 'ENV_NOT_CONFIGURED' | 'FORBIDDEN_EMAIL' | 'UNAUTHORIZED' | string;
  missing?: string[];
  error?: string;
  content?: SiteContent;
  commitUrl?: string;
}

export interface UploadResult {
  ok: boolean;
  code?: 'ENV_NOT_CONFIGURED' | 'FORBIDDEN_EMAIL' | 'UNAUTHORIZED' | string;
  missing?: string[];
  error?: string;
  url?: string;
  relativePath?: string;
}

export interface AllowlistUpdateResult {
  ok: boolean;
  error?: string;
  allowedEmails?: string[];
  envPinnedEmails?: string[];
}

const DRAFT_STORAGE_KEY = 'alter_haiti_cms_draft_v1';
export const SESSION_TOKEN_KEY = 'alter_haiti_studio_session_v1';

export function saveStoredSessionToken(token: string): void {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Ignore iframe storage restrictions
  }
}

export function getStoredSessionToken(): string {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function clearStoredSessionToken(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

export function saveLocalDraft(content: SiteContent): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(content));
  } catch {
    // Ignore storage quota / iframe restrictions
  }
}

export function loadLocalDraft(): SiteContent | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sections) && parsed.theme) {
      return parsed as SiteContent;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export async function fetchSiteContent(fresh = false): Promise<FetchContentResult> {
  try {
    const res = await fetch(fresh ? '/api/content?fresh=1' : '/api/content');
    if (res.ok) {
      const data = await res.json();
      if (data && data.content && Array.isArray(data.content.sections)) {
        const resolvedClientId = data.googleClientId || GOOGLE_AUTH_CONFIG.clientId || '';
        return {
          content: mergeWithDefaults(data.content),
          googleClientId: resolvedClientId,
          configured: {
            hasGoogleClientId: Boolean(
              data.configured?.hasGoogleClientId || resolvedClientId
            ),
            hasGithubToken: Boolean(data.configured?.hasGithubToken),
          },
          localDev: Boolean(data.localDev),
          localAllowedEmails: Array.isArray(data.localAllowedEmails)
            ? data.localAllowedEmails
            : undefined,
        };
      }
    }
  } catch {
    // Fallback to static JSON below
  }

  try {
    const staticUrl = resolveAssetUrl('site-content.json');
    const res = await fetch(`${staticUrl}?t=${Math.floor(Date.now() / 30000)}`);
    if (res.ok) {
      const staticData = await res.json();
      if (staticData && Array.isArray(staticData.sections)) {
        return {
          content: mergeWithDefaults(staticData),
          googleClientId: GOOGLE_AUTH_CONFIG.clientId || '',
          configured: {
            hasGoogleClientId: Boolean(GOOGLE_AUTH_CONFIG.clientId),
            hasGithubToken: false,
          },
        };
      }
    }
  } catch {
    // Ignore
  }

  return {
    content: DEFAULT_SITE_CONTENT,
    googleClientId: GOOGLE_AUTH_CONFIG.clientId || '',
    configured: {
      hasGoogleClientId: Boolean(GOOGLE_AUTH_CONFIG.clientId),
      hasGithubToken: false,
    },
  };
}

function mergeWithDefaults(incoming: Partial<SiteContent>): SiteContent {
  return {
    version: incoming.version ?? DEFAULT_SITE_CONTENT.version,
    updatedAt: incoming.updatedAt ?? DEFAULT_SITE_CONTENT.updatedAt,
    theme: { ...DEFAULT_SITE_CONTENT.theme, ...(incoming.theme || {}) },
    header: { ...DEFAULT_SITE_CONTENT.header, ...(incoming.header || {}) },
    sections: Array.isArray(incoming.sections) ? incoming.sections : DEFAULT_SITE_CONTENT.sections,
    footer: { ...DEFAULT_SITE_CONTENT.footer, ...(incoming.footer || {}) },
  };
}

export async function loginWithGoogleCredential(idToken: string): Promise<AuthSessionResult> {
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'google-login', idToken }),
    });
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error during Google sign-in.',
    };
  }
}

export async function loginLocalSandbox(email: string): Promise<AuthSessionResult> {
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sandbox-login', email }),
    });
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Local sandbox sign-in failed.',
    };
  }
}

export async function verifyAdminSession(sessionToken: string): Promise<AuthSessionResult> {
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-session', sessionToken }),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Could not verify session.',
    };
  }
}

export async function updateAllowedAdminEmails(
  allowedEmails: string[],
  sessionToken: string
): Promise<AllowlistUpdateResult> {
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-allowlist',
        allowedEmails,
        sessionToken,
      }),
    });
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error updating allowed accounts.',
    };
  }
}

export async function publishSiteContent(
  content: SiteContent,
  sessionToken: string
): Promise<PublishResult> {
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish', content, sessionToken }),
    });
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error while publishing.',
    };
  }
}

export async function compressImageFile(file: File, maxDimension = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (file.type === 'image/gif') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDimension && height <= maxDimension && file.size < 650 * 1024) {
          resolve(dataUrl);
          return;
        }
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImageToSite(
  file: File,
  sessionToken: string
): Promise<UploadResult> {
  const compressedDataUrl = await compressImageFile(file);
  const baseName = file.name.replace(/\.[^.]+$/, '') + '.jpg';

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: baseName,
        contentBase64: compressedDataUrl,
        sessionToken,
      }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Could not upload image. Check your connection.' };
  }
}
