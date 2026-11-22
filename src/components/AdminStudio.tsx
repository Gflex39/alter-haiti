import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  LogOut,
  Monitor,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import {
  AdminUserProfile,
  clearLocalDraft,
  clearStoredSessionToken,
  deleteAdminUser,
  getStoredSessionToken,
  loadLocalDraft,
  loginWithPassword,
  ManagedUserSummary,
  publishSiteContent,
  saveLocalDraft,
  saveStoredSessionToken,
  ServerConfigStatus,
  uploadImageToSite,
  upsertAdminUser,
  verifyAdminSession,
} from '../services/cmsApi';
import { getDriveFolderWebUrl } from '../services/googleDrive';
import {
  createSectionFromTemplate,
  CustomGalleryImage,
  FontPreset,
  PillarItem,
  resolveAssetUrl,
  SECTION_LABELS,
  SectionHeight,
  SiteContent,
  SiteSection,
  THEME_PRESETS,
} from '../types/cms';
import { SelectedTarget, SiteRenderer } from './SiteRenderer';

interface AdminStudioProps {
  initialContent: SiteContent;
  serverConfigured: ServerConfigStatus;
  localDev?: boolean;
  initialUsers?: ManagedUserSummary[];
  onPublished: (updated: SiteContent) => void;
  onExit: () => void;
}

type LeftTab = 'add' | 'sections' | 'design' | 'site' | 'access';
type ViewportMode = 'desktop' | 'tablet' | 'mobile';

const BUILTIN_VIDEOS = [
  { label: 'Jacmel Aerial & Streets (Video 1)', src: 'media/jacmel3.mp4' },
  { label: 'Jacmel Community Banner (Video 2)', src: 'media/jacmel2.mp4' },
];

const BUILTIN_PHOTOS = Array.from({ length: 16 }, (_, i) => ({
  label: `Jacmel Photo ${i + 1}`,
  src: `media/img${i + 1}.jpg`,
}));

const SECTION_CATALOG: Array<{
  type: SiteSection['type'];
  title: string;
  desc: string;
}> = [
  {
    type: 'hero',
    title: 'Hero Video / Cover',
    desc: 'Large full-bleed cover video or photo with headline and optional button.',
  },
  {
    type: 'mission',
    title: 'Text & Mission Block',
    desc: 'Centered or left-aligned heading, story paragraph, and optional contact card.',
  },
  {
    type: 'split',
    title: 'Image + Story Split',
    desc: 'Side-by-side photo or video paired with a project story and action button.',
  },
  {
    type: 'pillars',
    title: '3-Column Highlights',
    desc: 'Three feature cards to showcase programs, stats, or community goals.',
  },
  {
    type: 'banner',
    title: 'Full-Width Media Banner',
    desc: 'Cinematic statement overlaid on a looping video or wide photograph.',
  },
  {
    type: 'cta',
    title: 'Donate / Call to Action',
    desc: 'Standout card inviting visitors to donate, partner, or email your team.',
  },
  {
    type: 'gallery',
    title: 'Photo Gallery',
    desc: 'Responsive photo grid synced with Google Drive and uploaded photos.',
  },
];

export const AdminStudio: React.FC<AdminStudioProps> = ({
  initialContent,
  serverConfigured,
  localDev = false,
  initialUsers = [{ username: 'admin', role: 'owner' }],
  onPublished,
  onExit,
}) => {
  // Username + Password Session state
  const [sessionToken, setSessionToken] = useState<string>(() => {
    const stored = getStoredSessionToken();
    if (stored) return stored;
    return localDev ? 'local-dev-owner' : '';
  });
  const [currentUser, setCurrentUser] = useState<AdminUserProfile | null>(() =>
    localDev ? { username: 'admin', role: 'owner' } : null
  );
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => Boolean(localDev));
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(() =>
    !localDev && Boolean(getStoredSessionToken())
  );

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Managed Editor Users state
  const [managedUsers, setManagedUsers] = useState<ManagedUserSummary[]>(initialUsers);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // Content & Undo/Redo history
  const [publishedBaseline, setPublishedBaseline] = useState<SiteContent>(initialContent);
  const [draft, setDraft] = useState<SiteContent>(() => loadLocalDraft() || initialContent);
  const [past, setPast] = useState<SiteContent[]>([]);
  const [future, setFuture] = useState<SiteContent[]>([]);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState<boolean>(() =>
    Boolean(loadLocalDraft())
  );

  // Studio UI state
  const [leftTab, setLeftTab] = useState<LeftTab>('sections');
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>(() =>
    initialContent.sections[0]
      ? { kind: 'section', id: initialContent.sections[0].id }
      : { kind: 'header' }
  );
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [mobileSheet, setMobileSheet] = useState<'none' | 'left' | 'right'>('none');

  // Publishing & Modals state
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>([]);
  const [mediaLibraryModal, setMediaLibraryModal] = useState<{
    onPick: (src: string, mediaType: 'image' | 'video') => void;
    allowVideo: boolean;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const showToast = useCallback(
    (tone: 'success' | 'error' | 'info', message: string) => {
      setToast({ tone, message });
      window.setTimeout(() => {
        setToast((curr) => (curr?.message === message ? null : curr));
      }, 4200);
    },
    []
  );

  const scrollToCanvasTarget = useCallback((targetKey: string) => {
    window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-cms-target="${targetKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  // Verify stored production session on mount
  useEffect(() => {
    if (localDev) return;
    const stored = getStoredSessionToken();
    if (!stored) {
      setIsCheckingSession(false);
      return;
    }
    let active = true;
    verifyAdminSession(stored).then((res) => {
      if (!active) return;
      setIsCheckingSession(false);
      if (res.ok && res.user) {
        setSessionToken(stored);
        setCurrentUser(res.user);
        if (res.users) setManagedUsers(res.users);
        setIsUnlocked(true);
      } else {
        clearStoredSessionToken();
        setSessionToken('');
        setCurrentUser(null);
        setIsUnlocked(false);
      }
    });
    return () => {
      active = false;
    };
  }, [localDev]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('Please enter your username and password.');
      return;
    }
    setLoginError('');
    setIsLoggingIn(true);
    const res = await loginWithPassword(loginUsername.trim(), loginPassword);
    setIsLoggingIn(false);

    if (res.ok && res.sessionToken && res.user) {
      saveStoredSessionToken(res.sessionToken);
      setSessionToken(res.sessionToken);
      setCurrentUser(res.user);
      if (res.users) setManagedUsers(res.users);
      setLoginPassword('');
      setIsUnlocked(true);
      return;
    }

    if (res.code === 'ENV_NOT_CONFIGURED') {
      setLoginError(
        `Server setup incomplete: add ${(res.missing || ['ADMIN_PASSWORD', 'GITHUB_TOKEN']).join(' & ')} in Vercel Environment Variables.`
      );
      return;
    }

    setLoginError(res.error || 'Incorrect username or password.');
  };

  const handleSignOut = () => {
    clearStoredSessionToken();
    setSessionToken('');
    setCurrentUser(null);
    setLoginPassword('');
    setLoginError('');
    setLastCreatedCredentials(null);
    setIsUnlocked(false);
  };

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(publishedBaseline),
    [draft, publishedBaseline]
  );

  const applyChange = useCallback((updater: (prev: SiteContent) => SiteContent) => {
    setDraft((prev) => {
      const next = updater(prev);
      if (JSON.stringify(next) === JSON.stringify(prev)) {
        return prev;
      }
      setPast((h) => [...h.slice(-29), prev]);
      setFuture([]);
      saveLocalDraft(next);
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setDraft((curr) => {
        setFuture((f) => [curr, ...f.slice(0, 29)]);
        saveLocalDraft(previous);
        return previous;
      });
      return prevPast.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setDraft((curr) => {
        setPast((p) => [...p.slice(-29), curr]);
        saveLocalDraft(next);
        return next;
      });
      return prevFuture.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUnlocked, handleUndo, handleRedo]);

  // Section manipulation helpers
  const handleMoveSection = (id: string, direction: 'up' | 'down') => {
    applyChange((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.sections.length) return prev;
      const copy = [...prev.sections];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      return { ...prev, sections: copy };
    });
  };

  const handleReorderSection = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    applyChange((prev) => {
      const copy = [...prev.sections];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return { ...prev, sections: copy };
    });
  };

  const handleDuplicateSection = (id: string) => {
    let newId = '';
    applyChange((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const original = prev.sections[idx];
      newId = `${original.type}-${Date.now().toString(36)}`;
      const cloned: SiteSection = JSON.parse(JSON.stringify(original));
      cloned.id = newId;
      const copy = [...prev.sections];
      copy.splice(idx + 1, 0, cloned);
      return { ...prev, sections: copy };
    });
    if (newId) {
      setSelectedTarget({ kind: 'section', id: newId });
      showToast('info', 'Section duplicated.');
    }
  };

  const handleToggleVisibility = (id: string) => {
    applyChange((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, hidden: !s.hidden } : s
      ),
    }));
  };

  const handleDeleteSection = (id: string) => {
    applyChange((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
    }));
    if (selectedTarget?.kind === 'section' && selectedTarget.id === id) {
      setSelectedTarget(null);
    }
    showToast('info', 'Section removed. Click Undo anytime to bring it back.');
  };

  const handleInsertSection = (type: SiteSection['type']) => {
    const created = createSectionFromTemplate(type);
    applyChange((prev) => {
      const copy = [...prev.sections];
      if (insertAfterIndex === null) {
        copy.push(created);
      } else {
        copy.splice(insertAfterIndex + 1, 0, created);
      }
      return { ...prev, sections: copy };
    });
    setInsertAfterIndex(null);
    setSelectedTarget({ kind: 'section', id: created.id });
    setLeftTab('sections');
    setMobileSheet('none');
    showToast('success', `Added "${SECTION_LABELS[type]}".`);
  };

  // User Account Management actions (Master Admin)
  const handleGeneratePassword = () => {
    const words = ['jacmel', 'haiti', 'hope', 'island', 'sunlight', 'harbor', 'community'];
    const word = words[Math.floor(Math.random() * words.length)];
    const digits = Math.floor(1000 + Math.random() * 9000);
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const tail =
      chars[Math.floor(Math.random() * chars.length)] +
      chars[Math.floor(Math.random() * chars.length)];
    setNewPasswordInput(`${word}-${digits}-${tail}`);
  };

  const handleSaveUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsernameInput.trim().toLowerCase();
    const rawPass = newPasswordInput;

    if (!cleanUser) {
      showToast('error', 'Please enter a username.');
      return;
    }
    if (!/^[a-z0-9._-]{2,40}$/.test(cleanUser)) {
      showToast(
        'error',
        'Username must be 2–40 characters (letters, numbers, dots, hyphens, or underscores).'
      );
      return;
    }
    if (!rawPass || rawPass.length < 6) {
      showToast('error', 'Password must be at least 6 characters long.');
      return;
    }

    setIsSavingUser(true);
    const res = await upsertAdminUser(cleanUser, rawPass, sessionToken);
    setIsSavingUser(false);

    if (res.ok && res.users) {
      setManagedUsers(res.users);
      setLastCreatedCredentials({ username: cleanUser, password: rawPass });
      setNewUsernameInput('');
      setNewPasswordInput('');
      showToast('success', `Saved login for @${cleanUser}! Copy the login details below to share.`);
      return;
    }

    showToast('error', res.error || 'Could not save user account.');
  };

  const handleRemoveUserAccount = async (usernameToRemove: string) => {
    if (!window.confirm(`Remove @${usernameToRemove}'s access to the Website Studio?`)) {
      return;
    }
    setIsSavingUser(true);
    const res = await deleteAdminUser(usernameToRemove, sessionToken);
    setIsSavingUser(false);

    if (res.ok && res.users) {
      setManagedUsers(res.users);
      if (lastCreatedCredentials?.username === usernameToRemove) {
        setLastCreatedCredentials(null);
      }
      showToast('info', `Removed @${usernameToRemove}.`);
      return;
    }

    showToast('error', res.error || 'Could not remove user account.');
  };

  const handleCopyShareCredentials = async () => {
    if (!lastCreatedCredentials) return;
    let studioUrl = 'https://www.alterhaitinyfoundationinc.org/admin';
    try {
      if (
        typeof window !== 'undefined' &&
        window.location.origin &&
        !window.location.origin.includes('localhost')
      ) {
        studioUrl = `${window.location.origin}/admin`;
      }
    } catch {
      // Use production URL fallback
    }
    const shareText = [
      'Alter Haiti Website Studio Login',
      `Link: ${studioUrl}`,
      `Username: ${lastCreatedCredentials.username}`,
      `Password: ${lastCreatedCredentials.password}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(shareText);
      showToast('success', 'Copied login instructions to clipboard!');
    } catch {
      showToast('info', `Username: ${lastCreatedCredentials.username} | Password: ${lastCreatedCredentials.password}`);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    const res = await publishSiteContent(draft, sessionToken);
    setIsPublishing(false);

    if (res.ok && res.content) {
      clearLocalDraft();
      setHasRecoveredDraft(false);
      setPublishedBaseline(res.content);
      setDraft(res.content);
      onPublished(res.content);
      showToast('success', 'Published! Your changes are now live on the website.');
      return;
    }

    if (res.code === 'ENV_NOT_CONFIGURED') {
      setMissingEnvVars(res.missing || ['ADMIN_PASSWORD', 'GITHUB_TOKEN']);
      setShowSetupModal(true);
      return;
    }

    if (res.code === 'UNAUTHORIZED' || res.code === 'FORBIDDEN_USER') {
      handleSignOut();
      setLoginError(res.error || 'Your session expired. Please sign in again.');
      return;
    }

    showToast('error', res.error || 'Could not publish changes.');
  };

  const handleUploadFile = async (
    file: File,
    onUploaded: (url: string) => void
  ) => {
    setIsUploading(true);
    const result = await uploadImageToSite(file, sessionToken);
    setIsUploading(false);

    if (result.ok && result.url) {
      onUploaded(result.url);
      showToast('success', 'Photo uploaded and placed on page!');
      return;
    }

    if (result.code === 'ENV_NOT_CONFIGURED') {
      setMissingEnvVars(result.missing || ['ADMIN_PASSWORD', 'GITHUB_TOKEN']);
      setShowSetupModal(true);
      return;
    }

    if (result.code === 'UNAUTHORIZED' || result.code === 'FORBIDDEN_USER') {
      handleSignOut();
      setLoginError(result.error || 'Your session expired. Please sign in again.');
      return;
    }

    showToast('error', result.error || 'Could not upload photo.');
  };

  const handleResetToLive = () => {
    if (
      !window.confirm(
        'Discard unsaved edits and revert back to the currently published website?'
      )
    ) {
      return;
    }
    clearLocalDraft();
    setHasRecoveredDraft(false);
    setPast((p) => [...p, draft]);
    setDraft(publishedBaseline);
    showToast('info', 'Reset to live website version.');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-content.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------- USERNAME + PASSWORD LOGIN GATE ----------------
  if (isCheckingSession) {
    return (
      <div className="studio-loading-screen">
        <div className="studio-spinner" />
        <p>Checking editor session...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    const needsProductionConfig =
      !localDev && (!serverConfigured.hasAdminPassword || !serverConfigured.hasGithubToken);

    return (
      <div className="studio-login-backdrop">
        <div className="studio-login-card">
          <div className="studio-login-brand">
            <span className="studio-badge-dot" />
            <span>ALTER HAITI • WEBSITE STUDIO</span>
          </div>
          <h1>Editor Sign-In</h1>
          <p className="studio-login-sub">
            Enter the username and password provided by the Alter Haiti Foundation administrator.
          </p>

          {needsProductionConfig && (
            <div className="studio-setup-callout" style={{ marginBottom: '1rem' }}>
              <p>
                <strong>🔒 One-Time Vercel Setup Needed:</strong> Add{' '}
                <code>ADMIN_PASSWORD</code> and <code>GITHUB_TOKEN</code> in{' '}
                <strong>Vercel Dashboard → Settings → Environment Variables</strong> (optional:{' '}
                <code>ADMIN_USERNAME</code>, defaults to <code>admin</code>), then redeploy once.
              </p>
            </div>
          )}

          {localDev && (
            <div className="studio-setup-callout" style={{ marginBottom: '1rem' }}>
              <p>
                <strong>Preview Mode Login:</strong> Default Master Admin is username{' '}
                <code>admin</code> / password <code>alterhaiti</code> (or any editor login you
                created in the Users tab).
              </p>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="studio-login-form">
            <div style={{ textAlign: 'left', marginBottom: '0.65rem' }}>
              <label className="studio-field-label">Username</label>
              <input
                className="studio-input"
                type="text"
                autoComplete="username"
                autoFocus
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div style={{ textAlign: 'left', marginBottom: '0.85rem' }}>
              <label className="studio-field-label">Password</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  className="studio-input"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="studio-btn studio-btn-outline"
                  title={showLoginPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowLoginPassword((v) => !v)}
                >
                  {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="studio-login-error-box" style={{ marginBottom: '0.85rem' }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="studio-btn studio-btn-primary studio-btn-full"
            >
              {isLoggingIn ? 'Signing In...' : 'Sign In to Website Studio'}
            </button>
          </form>

          <button type="button" className="studio-back-link" onClick={onExit}>
            <ArrowLeft size={14} /> Return to Public Website
          </button>
        </div>
      </div>
    );
  }

  const selectedSection =
    selectedTarget?.kind === 'section'
      ? draft.sections.find((s) => s.id === selectedTarget.id) || null
      : null;

  // ---------------- FULL WIX-STYLE STUDIO ----------------
  return (
    <div className="studio-root">
      {/* TOP BAR */}
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onExit}
            title="Exit editor and view live site"
          >
            <ArrowLeft size={15} />
            <span>Live Site</span>
          </button>
          <div className="studio-divider-v" />
          <div className="studio-title-group">
            <strong>Alter Haiti Studio</strong>
            <span className={`studio-status-chip ${isDirty ? 'is-dirty' : 'is-clean'}`}>
              {isDirty ? 'Unsaved changes' : 'All changes live'}
            </span>
          </div>
        </div>

        <div className="studio-topbar-center">
          <div className="studio-segmented" role="group" aria-label="Undo and Redo">
            <button
              type="button"
              onClick={handleUndo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
          </div>

          <div className="studio-segmented" role="group" aria-label="Screen size preview">
            <button
              type="button"
              className={viewport === 'desktop' ? 'is-active' : ''}
              onClick={() => setViewport('desktop')}
              title="Desktop view"
            >
              <Monitor size={15} />
            </button>
            <button
              type="button"
              className={viewport === 'tablet' ? 'is-active' : ''}
              onClick={() => setViewport('tablet')}
              title="Tablet view"
            >
              <Tablet size={15} />
            </button>
            <button
              type="button"
              className={viewport === 'mobile' ? 'is-active' : ''}
              onClick={() => setViewport('mobile')}
              title="Phone view"
            >
              <Smartphone size={15} />
            </button>
          </div>

          <button
            type="button"
            className={`studio-btn studio-btn-subtle ${isPreviewing ? 'is-active-toggle' : ''}`}
            onClick={() => setIsPreviewing((p) => !p)}
          >
            <Eye size={15} />
            <span>{isPreviewing ? 'Back to Editing' : 'Preview'}</span>
          </button>
        </div>

        <div className="studio-topbar-right">
          {currentUser && (
            <button
              type="button"
              className="studio-user-chip"
              onClick={() => {
                setLeftTab('access');
                setMobileSheet('left');
              }}
              title="Signed in — click to manage user logins"
            >
              <ShieldCheck size={13} />
              <span>@{currentUser.username}</span>
            </button>
          )}
          {isDirty && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={handleResetToLive}
              title="Discard unsaved changes"
            >
              <RotateCcw size={14} />
              <span>Discard</span>
            </button>
          )}
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={() => setShowSetupModal(true)}
            title="Login & Vercel Setup Guide"
          >
            <HelpCircle size={15} />
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            <Check size={15} />
            <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </header>

      {hasRecoveredDraft && isDirty && (
        <div className="studio-draft-banner">
          <span>
            Restored your unpublished draft saved in this browser. Click{' '}
            <strong>Publish</strong> when ready, or <strong>Discard</strong> to return to the live
            version.
          </span>
          <button type="button" onClick={() => setHasRecoveredDraft(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      {!isPreviewing && (
        <div className="studio-compact-bar">
          <button
            type="button"
            className={mobileSheet === 'left' && leftTab === 'add' ? 'is-active' : ''}
            onClick={() => {
              setInsertAfterIndex(null);
              setLeftTab('add');
              setMobileSheet(mobileSheet === 'left' && leftTab === 'add' ? 'none' : 'left');
            }}
          >
            <Plus size={14} /> Add Section
          </button>
          <button
            type="button"
            className={mobileSheet === 'left' && leftTab === 'sections' ? 'is-active' : ''}
            onClick={() => {
              setLeftTab('sections');
              setMobileSheet(mobileSheet === 'left' && leftTab === 'sections' ? 'none' : 'left');
            }}
          >
            <Layers size={14} /> Reorder
          </button>
          <button
            type="button"
            className={mobileSheet === 'left' && leftTab === 'design' ? 'is-active' : ''}
            onClick={() => {
              setLeftTab('design');
              setMobileSheet(mobileSheet === 'left' && leftTab === 'design' ? 'none' : 'left');
            }}
          >
            <Palette size={14} /> Colors
          </button>
          <button
            type="button"
            className={mobileSheet === 'left' && leftTab === 'access' ? 'is-active' : ''}
            onClick={() => {
              setLeftTab('access');
              setMobileSheet(mobileSheet === 'left' && leftTab === 'access' ? 'none' : 'left');
            }}
          >
            <ShieldCheck size={14} /> Users
          </button>
          <button
            type="button"
            className={mobileSheet === 'right' ? 'is-active' : ''}
            onClick={() => setMobileSheet(mobileSheet === 'right' ? 'none' : 'right')}
          >
            <Settings size={14} /> Edit Block
          </button>
        </div>
      )}

      {/* MAIN STUDIO BODY */}
      <div className={`studio-workspace ${isPreviewing ? 'is-preview-mode' : ''}`}>
        {/* LEFT SIDEBAR */}
        {!isPreviewing && (
          <aside className={`studio-left-panel ${mobileSheet === 'left' ? 'is-sheet-open' : ''}`}>
            <nav className="studio-rail">
              <button
                type="button"
                className={leftTab === 'add' ? 'is-active' : ''}
                onClick={() => {
                  setInsertAfterIndex(null);
                  setLeftTab('add');
                }}
              >
                <Plus size={18} />
                <span>Add</span>
              </button>
              <button
                type="button"
                className={leftTab === 'sections' ? 'is-active' : ''}
                onClick={() => setLeftTab('sections')}
              >
                <Layers size={18} />
                <span>Sections</span>
              </button>
              <button
                type="button"
                className={leftTab === 'design' ? 'is-active' : ''}
                onClick={() => setLeftTab('design')}
              >
                <Palette size={18} />
                <span>Design</span>
              </button>
              <button
                type="button"
                className={leftTab === 'site' ? 'is-active' : ''}
                onClick={() => setLeftTab('site')}
              >
                <Settings size={18} />
                <span>Site Info</span>
              </button>
              <button
                type="button"
                className={leftTab === 'access' ? 'is-active' : ''}
                onClick={() => setLeftTab('access')}
              >
                <ShieldCheck size={18} />
                <span>Users</span>
              </button>
            </nav>

            <div className="studio-drawer">
              <div className="studio-sheet-close-row">
                <span>Menu</span>
                <button type="button" onClick={() => setMobileSheet('none')}>
                  <X size={15} /> Done
                </button>
              </div>

              {leftTab === 'add' && (
                <div className="studio-drawer-content">
                  <div className="studio-drawer-header">
                    <h3>Add a Section</h3>
                    <p>
                      {insertAfterIndex === null
                        ? 'Click a block to add it to your page.'
                        : 'Choose a block to insert at the selected spot.'}
                    </p>
                  </div>
                  <div className="studio-catalog-list">
                    {SECTION_CATALOG.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        className="studio-catalog-card"
                        onClick={() => handleInsertSection(item.type)}
                      >
                        <div className="studio-catalog-title">
                          <LayoutTemplate size={15} />
                          <strong>{item.title}</strong>
                        </div>
                        <p>{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {leftTab === 'sections' && (
                <div className="studio-drawer-content">
                  <div className="studio-drawer-header">
                    <h3>Page Structure</h3>
                    <p>Drag to reorder sections or click any item to edit its settings.</p>
                  </div>

                  <div
                    className={`studio-layer-item is-pinned ${
                      selectedTarget?.kind === 'header' ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedTarget({ kind: 'header' });
                      scrollToCanvasTarget('header');
                    }}
                  >
                    <span className="studio-layer-name">Top Header</span>
                    <span className="studio-layer-tag">Pinned</span>
                  </div>

                  <div className="studio-layer-list">
                    {draft.sections.map((sec, idx) => {
                      const isSel =
                        selectedTarget?.kind === 'section' && selectedTarget.id === sec.id;
                      const previewTitle =
                        'heading' in sec && sec.heading
                          ? sec.heading
                          : SECTION_LABELS[sec.type];
                      return (
                        <div
                          key={sec.id}
                          draggable
                          onDragStart={() => setDragIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIndex !== null) {
                              handleReorderSection(dragIndex, idx);
                              setDragIndex(null);
                            }
                          }}
                          onDragEnd={() => setDragIndex(null)}
                          className={`studio-layer-item ${isSel ? 'is-selected' : ''} ${
                            sec.hidden ? 'is-muted' : ''
                          }`}
                          onClick={() => {
                            setSelectedTarget({ kind: 'section', id: sec.id });
                            scrollToCanvasTarget(sec.id);
                          }}
                        >
                          <GripVertical size={14} className="studio-grip" />
                          <div className="studio-layer-text">
                            <strong>{previewTitle}</strong>
                            <small>{SECTION_LABELS[sec.type]}</small>
                          </div>
                          <div
                            className="studio-layer-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              title={sec.hidden ? 'Show section' : 'Hide section'}
                              onClick={() => handleToggleVisibility(sec.id)}
                            >
                              {sec.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              type="button"
                              title="Duplicate"
                              onClick={() => handleDuplicateSection(sec.id)}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              title="Delete"
                              onClick={() => handleDeleteSection(sec.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="studio-btn studio-btn-outline studio-btn-full"
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => {
                      setInsertAfterIndex(null);
                      setLeftTab('add');
                    }}
                  >
                    <Plus size={15} /> Add New Section
                  </button>

                  <div
                    className={`studio-layer-item is-pinned ${
                      selectedTarget?.kind === 'footer' ? 'is-selected' : ''
                    }`}
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => {
                      setSelectedTarget({ kind: 'footer' });
                      scrollToCanvasTarget('footer');
                    }}
                  >
                    <span className="studio-layer-name">Bottom Footer</span>
                    <span className="studio-layer-tag">Pinned</span>
                  </div>
                </div>
              )}

              {leftTab === 'design' && (
                <div className="studio-drawer-content">
                  <div className="studio-drawer-header">
                    <h3>Colors & Fonts</h3>
                    <p>Switch color palettes in one click or customize individual colors.</p>
                  </div>

                  <label className="studio-field-label">Color Presets</label>
                  <div className="studio-preset-grid">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="studio-preset-card"
                        onClick={() =>
                          applyChange((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, ...preset.theme },
                          }))
                        }
                      >
                        <div className="studio-swatches">
                          <span style={{ background: preset.theme.bgColor }} />
                          <span style={{ background: preset.theme.cardBg }} />
                          <span style={{ background: preset.theme.textPrimary }} />
                          <span style={{ background: preset.theme.accentColor }} />
                        </div>
                        <strong>{preset.name}</strong>
                        <small>{preset.description}</small>
                      </button>
                    ))}
                  </div>

                  <div className="studio-color-pickers">
                    <ColorField
                      label="Page Background"
                      value={draft.theme.bgColor}
                      onChange={(bgColor) =>
                        applyChange((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, bgColor },
                        }))
                      }
                    />
                    <ColorField
                      label="Card Surface"
                      value={draft.theme.cardBg}
                      onChange={(cardBg) =>
                        applyChange((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, cardBg },
                        }))
                      }
                    />
                    <ColorField
                      label="Headline Text"
                      value={draft.theme.textPrimary}
                      onChange={(textPrimary) =>
                        applyChange((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, textPrimary },
                        }))
                      }
                    />
                    <ColorField
                      label="Body / Muted Text"
                      value={draft.theme.textSecondary}
                      onChange={(textSecondary) =>
                        applyChange((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, textSecondary },
                        }))
                      }
                    />
                    <ColorField
                      label="Buttons & Links Accent"
                      value={draft.theme.accentColor}
                      onChange={(accentColor) =>
                        applyChange((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, accentColor },
                        }))
                      }
                    />
                  </div>

                  <label className="studio-field-label" style={{ marginTop: '1.25rem' }}>
                    Font Style
                  </label>
                  <select
                    className="studio-select"
                    value={draft.theme.fontPreset}
                    onChange={(e) =>
                      applyChange((prev) => ({
                        ...prev,
                        theme: { ...prev.theme, fontPreset: e.target.value as FontPreset },
                      }))
                    }
                  >
                    <option value="editorial">Editorial Bold Sans (Default)</option>
                    <option value="serif">Classic Literary Serif + Sans</option>
                    <option value="modern">Clean Modern Geometric</option>
                  </select>
                </div>
              )}

              {leftTab === 'site' && (
                <div className="studio-drawer-content">
                  <div className="studio-drawer-header">
                    <h3>Organization & Google Drive</h3>
                    <p>Global contact info, header button, and Google Drive photo sync.</p>
                  </div>

                  <FieldGroup label="Foundation Label (Above Title)">
                    <input
                      className="studio-input"
                      value={draft.header.subtitle}
                      onChange={(e) =>
                        applyChange((prev) => ({
                          ...prev,
                          header: { ...prev.header, subtitle: e.target.value },
                        }))
                      }
                    />
                  </FieldGroup>

                  <FieldGroup label="Website Main Title">
                    <input
                      className="studio-input"
                      value={draft.header.title}
                      onChange={(e) =>
                        applyChange((prev) => ({
                          ...prev,
                          header: { ...prev.header, title: e.target.value },
                        }))
                      }
                    />
                  </FieldGroup>

                  <FieldGroup label="Official Contact Email">
                    <input
                      className="studio-input"
                      type="email"
                      value={draft.header.email}
                      onChange={(e) => {
                        const email = e.target.value;
                        applyChange((prev) => ({
                          ...prev,
                          header: { ...prev.header, email },
                          footer: { ...prev.footer, email },
                        }));
                      }}
                    />
                  </FieldGroup>

                  <FieldGroup label="Shared Google Drive Photos Folder URL">
                    <input
                      className="studio-input"
                      value={draft.footer.driveFolderUrl}
                      placeholder="https://drive.google.com/drive/folders/..."
                      onChange={(e) =>
                        applyChange((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, driveFolderUrl: e.target.value },
                        }))
                      }
                    />
                    {getDriveFolderWebUrl(draft.footer.driveFolderUrl) && (
                      <a
                        href={getDriveFolderWebUrl(draft.footer.driveFolderUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="studio-inline-link"
                      >
                        <FolderOpen size={13} /> Open Google Drive Folder{' '}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </FieldGroup>

                  <ToggleRow
                    label="Show Donate / Action Button in Header"
                    checked={draft.header.showCta}
                    onChange={(showCta) =>
                      applyChange((prev) => ({
                        ...prev,
                        header: { ...prev.header, showCta },
                      }))
                    }
                  />
                  {draft.header.showCta && (
                    <>
                      <FieldGroup label="Header Button Label">
                        <input
                          className="studio-input"
                          value={draft.header.ctaText}
                          onChange={(e) =>
                            applyChange((prev) => ({
                              ...prev,
                              header: { ...prev.header, ctaText: e.target.value },
                            }))
                          }
                        />
                      </FieldGroup>
                      <FieldGroup label="Header Button Link (PayPal, GoFundMe, or mailto:)">
                        <input
                          className="studio-input"
                          value={draft.header.ctaUrl}
                          onChange={(e) =>
                            applyChange((prev) => ({
                              ...prev,
                              header: { ...prev.header, ctaUrl: e.target.value },
                            }))
                          }
                        />
                      </FieldGroup>
                    </>
                  )}
                </div>
              )}

              {leftTab === 'access' && (
                <div className="studio-drawer-content">
                  <div className="studio-drawer-header">
                    <h3>Editor User Logins</h3>
                    <p>
                      Create usernames & passwords to give to people you trust to edit the website.
                      Passwords are encrypted before saving.
                    </p>
                  </div>

                  {currentUser?.role !== 'owner' ? (
                    <div className="studio-alert-info">
                      Signed in as <strong>@{currentUser?.username}</strong> (Editor). Adding or
                      removing user logins is restricted to the Master Admin account.
                    </div>
                  ) : (
                    <>
                      <form onSubmit={handleSaveUserAccount} className="studio-add-email-form">
                        <FieldGroup label="Username">
                          <input
                            className="studio-input"
                            type="text"
                            autoComplete="off"
                            value={newUsernameInput}
                            onChange={(e) => setNewUsernameInput(e.target.value)}
                            placeholder="e.g. marie or volunteer1"
                          />
                        </FieldGroup>
                        <FieldGroup label="Password (min 6 characters)">
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input
                              className="studio-input"
                              type="text"
                              autoComplete="off"
                              value={newPasswordInput}
                              onChange={(e) => setNewPasswordInput(e.target.value)}
                              placeholder="Enter or generate password"
                            />
                            <button
                              type="button"
                              className="studio-btn studio-btn-outline"
                              title="Generate a strong password"
                              onClick={handleGeneratePassword}
                            >
                              <Sparkles size={13} />
                            </button>
                          </div>
                        </FieldGroup>
                        <button
                          type="submit"
                          disabled={isSavingUser}
                          className="studio-btn studio-btn-primary studio-btn-full"
                        >
                          <UserPlus size={14} />{' '}
                          {isSavingUser
                            ? 'Saving Login...'
                            : managedUsers.some(
                                (u) =>
                                  u.role === 'editor' &&
                                  u.username === newUsernameInput.trim().toLowerCase()
                              )
                            ? 'Update User Password'
                            : 'Create User Login'}
                        </button>
                      </form>

                      {lastCreatedCredentials && (
                        <div
                          className="studio-setup-callout"
                          style={{ marginTop: '0.85rem', padding: '0.75rem' }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <strong style={{ fontSize: '0.78rem' }}>
                              Ready to Share with @{lastCreatedCredentials.username}
                            </strong>
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                opacity: 0.7,
                              }}
                              onClick={() => setLastCreatedCredentials(null)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <div style={{ fontSize: '0.76rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                            <div>
                              Username: <code>{lastCreatedCredentials.username}</code>
                            </div>
                            <div>
                              Password: <code>{lastCreatedCredentials.password}</code>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="studio-btn studio-btn-outline studio-btn-full"
                            onClick={handleCopyShareCredentials}
                          >
                            <Copy size={13} /> Copy Login Instructions
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  <label className="studio-field-label" style={{ marginTop: '1rem' }}>
                    Active Accounts ({managedUsers.length})
                  </label>
                  <div className="studio-email-list">
                    {managedUsers.map((item) => {
                      const isSelf = currentUser?.username === item.username;
                      const isOwnerAccount = item.role === 'owner';
                      return (
                        <div key={item.username} className="studio-email-item">
                          <div className="studio-email-meta">
                            <strong>@{item.username}</strong>
                            <div className="studio-email-badges">
                              {isSelf && <span className="studio-mini-tag">You</span>}
                              <span className="studio-mini-tag">
                                {isOwnerAccount ? 'Master Admin' : 'Editor'}
                              </span>
                            </div>
                          </div>
                          {currentUser?.role === 'owner' && !isOwnerAccount && (
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="studio-btn studio-btn-ghost"
                                style={{ padding: '0.22rem 0.45rem', fontSize: '0.7rem' }}
                                title={`Set new password for @${item.username}`}
                                onClick={() => {
                                  setNewUsernameInput(item.username);
                                  handleGeneratePassword();
                                }}
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                className="studio-email-remove"
                                title={`Remove @${item.username}`}
                                disabled={isSavingUser}
                                onClick={() => handleRemoveUserAccount(item.username)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* CENTER LIVE INTERACTIVE CANVAS */}
        <main
          className="studio-canvas-stage"
          onClick={() => !isPreviewing && setSelectedTarget(null)}
        >
          {!isPreviewing && (
            <div className="studio-canvas-hint">
              Tip: Click directly on any headline or paragraph on the page to type, or click a
              section to customize its media & buttons on the right.
            </div>
          )}
          <div className={`studio-viewport-frame viewport-${viewport}`}>
            <SiteRenderer
              content={draft}
              editMode={!isPreviewing}
              selectedTarget={selectedTarget}
              onSelectTarget={setSelectedTarget}
              onUpdateContent={applyChange}
              onMoveSection={handleMoveSection}
              onDuplicateSection={handleDuplicateSection}
              onToggleSectionVisibility={handleToggleVisibility}
              onDeleteSection={handleDeleteSection}
              onRequestInsertAfter={(idx) => {
                setInsertAfterIndex(idx);
                setLeftTab('add');
                setMobileSheet('left');
              }}
            />
          </div>
        </main>

        {/* RIGHT CONTEXTUAL INSPECTOR */}
        {!isPreviewing && (
          <aside
            className={`studio-right-inspector ${mobileSheet === 'right' ? 'is-sheet-open' : ''}`}
          >
            <div className="studio-sheet-close-row">
              <span>Block Settings</span>
              <button type="button" onClick={() => setMobileSheet('none')}>
                <X size={15} /> Done
              </button>
            </div>
            {!selectedTarget && (
              <div className="studio-inspector-empty">
                <Sparkles size={22} />
                <h4>Select Any Section</h4>
                <p>
                  Click any section, headline, header, or footer on your page to customize its
                  photos, videos, buttons, and layout here.
                </p>
              </div>
            )}

            {selectedTarget?.kind === 'header' && (
              <div className="studio-inspector-body">
                <div className="studio-inspector-header">
                  <h3>Top Header</h3>
                </div>
                <FieldGroup label="Subtitle">
                  <input
                    className="studio-input"
                    value={draft.header.subtitle}
                    onChange={(e) =>
                      applyChange((prev) => ({
                        ...prev,
                        header: { ...prev.header, subtitle: e.target.value },
                      }))
                    }
                  />
                </FieldGroup>
                <FieldGroup label="Main Title">
                  <input
                    className="studio-input"
                    value={draft.header.title}
                    onChange={(e) =>
                      applyChange((prev) => ({
                        ...prev,
                        header: { ...prev.header, title: e.target.value },
                      }))
                    }
                  />
                </FieldGroup>
                <ToggleRow
                  label="Display Contact Email"
                  checked={draft.header.showEmail}
                  onChange={(showEmail) =>
                    applyChange((prev) => ({
                      ...prev,
                      header: { ...prev.header, showEmail },
                    }))
                  }
                />
                {draft.header.showEmail && (
                  <FieldGroup label="Header Email">
                    <input
                      className="studio-input"
                      value={draft.header.email}
                      onChange={(e) =>
                        applyChange((prev) => ({
                          ...prev,
                          header: { ...prev.header, email: e.target.value },
                        }))
                      }
                    />
                  </FieldGroup>
                )}
                <ToggleRow
                  label="Show Action / Donate Button"
                  checked={draft.header.showCta}
                  onChange={(showCta) =>
                    applyChange((prev) => ({
                      ...prev,
                      header: { ...prev.header, showCta },
                    }))
                  }
                />
                {draft.header.showCta && (
                  <>
                    <FieldGroup label="Button Text">
                      <input
                        className="studio-input"
                        value={draft.header.ctaText}
                        onChange={(e) =>
                          applyChange((prev) => ({
                            ...prev,
                            header: { ...prev.header, ctaText: e.target.value },
                          }))
                        }
                      />
                    </FieldGroup>
                    <FieldGroup label="Button Link URL">
                      <input
                        className="studio-input"
                        placeholder="https://... or mailto:..."
                        value={draft.header.ctaUrl}
                        onChange={(e) =>
                          applyChange((prev) => ({
                            ...prev,
                            header: { ...prev.header, ctaUrl: e.target.value },
                          }))
                        }
                      />
                    </FieldGroup>
                  </>
                )}
              </div>
            )}

            {selectedTarget?.kind === 'footer' && (
              <div className="studio-inspector-body">
                <div className="studio-inspector-header">
                  <h3>Bottom Footer</h3>
                </div>
                <FieldGroup label="Copyright Line">
                  <input
                    className="studio-input"
                    value={draft.footer.copyright}
                    onChange={(e) =>
                      applyChange((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, copyright: e.target.value },
                      }))
                    }
                  />
                </FieldGroup>
                <FieldGroup label="Footer Email">
                  <input
                    className="studio-input"
                    value={draft.footer.email}
                    onChange={(e) =>
                      applyChange((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, email: e.target.value },
                      }))
                    }
                  />
                </FieldGroup>
                <ToggleRow
                  label="Show '+ Add Photos' Google Drive Link"
                  checked={draft.footer.showDriveUploadLink}
                  onChange={(showDriveUploadLink) =>
                    applyChange((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, showDriveUploadLink },
                    }))
                  }
                />
                <ToggleRow
                  label="Show Subtle 'Edit Site' Link in Footer"
                  checked={draft.footer.showEditLink}
                  onChange={(showEditLink) =>
                    applyChange((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, showEditLink },
                    }))
                  }
                />
              </div>
            )}

            {selectedSection && (
              <SectionInspector
                section={selectedSection}
                driveFolderUrl={draft.footer.driveFolderUrl}
                isUploading={isUploading}
                onPatch={(patcher) =>
                  applyChange((prev) => ({
                    ...prev,
                    sections: prev.sections.map((s) =>
                      s.id === selectedSection.id ? patcher(s) : s
                    ),
                  }))
                }
                onUploadFile={handleUploadFile}
                onOpenMediaLibrary={(allowVideo, onPick) =>
                  setMediaLibraryModal({ allowVideo, onPick })
                }
              />
            )}
          </aside>
        )}
      </div>

      {/* MEDIA PICKER MODAL */}
      {mediaLibraryModal && (
        <div
          className="studio-modal-backdrop"
          onClick={() => setMediaLibraryModal(null)}
        >
          <div className="studio-modal studio-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-head">
              <h3>Choose Media</h3>
              <button type="button" onClick={() => setMediaLibraryModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="studio-modal-body">
              {mediaLibraryModal.allowVideo && (
                <>
                  <h4 className="studio-subhead">Built-in Jacmel Videos</h4>
                  <div className="studio-media-grid">
                    {BUILTIN_VIDEOS.map((vid) => (
                      <button
                        key={vid.src}
                        type="button"
                        className="studio-media-tile"
                        onClick={() => {
                          mediaLibraryModal.onPick(vid.src, 'video');
                          setMediaLibraryModal(null);
                        }}
                      >
                        <video src={resolveAssetUrl(vid.src)} muted playsInline />
                        <span>
                          <Video size={12} /> {vid.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <h4 className="studio-subhead" style={{ marginTop: '1rem' }}>
                Community Photos
              </h4>
              <div className="studio-media-grid">
                {BUILTIN_PHOTOS.map((ph) => (
                  <button
                    key={ph.src}
                    type="button"
                    className="studio-media-tile"
                    onClick={() => {
                      mediaLibraryModal.onPick(ph.src, 'image');
                      setMediaLibraryModal(null);
                    }}
                  >
                    <img src={resolveAssetUrl(ph.src)} alt={ph.label} loading="lazy" />
                    <span>{ph.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONE-TIME VERCEL SETUP MODAL */}
      {showSetupModal && (
        <div className="studio-modal-backdrop" onClick={() => setShowSetupModal(false)}>
          <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-head">
              <h3>Login & $0/mo Vercel Setup</h3>
              <button type="button" onClick={() => setShowSetupModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="studio-modal-body">
              {missingEnvVars.length > 0 && (
                <div className="studio-alert-info">
                  Add these environment variable(s) once in Vercel to enable login & live
                  publishing: <strong>{missingEnvVars.join(', ')}</strong>
                </div>
              )}
              <ol className="studio-steps-list">
                <li>
                  <strong>Set Your Master Login in Vercel:</strong> Open{' '}
                  <strong>Vercel Dashboard → Project Settings → Environment Variables</strong> and
                  add <code>ADMIN_PASSWORD</code> (your master password) and optional{' '}
                  <code>ADMIN_USERNAME</code> (defaults to <code>admin</code>).
                </li>
                <li>
                  <strong>Connect GitHub Save Token ($0/mo):</strong> Create a GitHub Fine-Grained
                  Personal Access Token for <code>Gflex39/alter-haiti</code> with{' '}
                  <strong>Contents: Read & Write</strong>, add it in Vercel as{' '}
                  <code>GITHUB_TOKEN</code>, and click <strong>Redeploy</strong> once.
                </li>
                <li>
                  <strong>Create Logins for Your Team Anytime:</strong> Once signed in with your
                  Master Admin account at <code>/admin</code>, open the <strong>Users</strong> tab
                  on the left to create usernames & passwords to hand out to teammates — or revoke
                  them in 1 click!
                </li>
              </ol>

              <div className="studio-backup-bar">
                <span>Want to download a backup copy of your edits?</span>
                <button
                  type="button"
                  className="studio-btn studio-btn-outline"
                  onClick={handleExportJson}
                >
                  <Download size={14} /> Download site-content.json
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`studio-toast tone-${toast.tone}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

// ---------------- SUB-COMPONENTS FOR INSPECTOR ----------------

interface SectionInspectorProps {
  section: SiteSection;
  driveFolderUrl: string;
  isUploading: boolean;
  onPatch: (patcher: (sec: any) => SiteSection) => void;
  onUploadFile: (file: File, onUploaded: (url: string) => void) => void;
  onOpenMediaLibrary: (
    allowVideo: boolean,
    onPick: (src: string, mediaType: 'image' | 'video') => void
  ) => void;
}

const SectionInspector: React.FC<SectionInspectorProps> = ({
  section,
  driveFolderUrl,
  isUploading,
  onPatch,
  onUploadFile,
  onOpenMediaLibrary,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryUploadRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="studio-inspector-body">
      <div className="studio-inspector-header">
        <h3>{SECTION_LABELS[section.type]}</h3>
        <ToggleRow
          label="Visible on Live Site"
          checked={!section.hidden}
          onChange={(visible) => onPatch((s) => ({ ...s, hidden: !visible }))}
        />
      </div>

      {(section.type === 'hero' || section.type === 'banner') && (
        <>
          <FieldGroup label="Headline">
            <input
              className="studio-input"
              value={section.heading}
              onChange={(e) => onPatch((s) => ({ ...s, heading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Subtitle">
            <textarea
              className="studio-textarea"
              rows={2}
              value={section.subheading}
              onChange={(e) => onPatch((s) => ({ ...s, subheading: e.target.value }))}
            />
          </FieldGroup>

          <FieldGroup label="Background Media">
            <div className="studio-media-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadFile(file, (url) =>
                      onPatch((s) => ({ ...s, mediaType: 'image', mediaSrc: url }))
                    );
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="studio-btn studio-btn-outline studio-btn-full"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />{' '}
                {isUploading ? 'Uploading Photo...' : 'Upload Photo from Computer'}
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-subtle studio-btn-full"
                onClick={() =>
                  onOpenMediaLibrary(true, (src, mediaType) =>
                    onPatch((s) => ({ ...s, mediaSrc: src, mediaType }))
                  )
                }
              >
                <ImageIcon size={14} /> Choose Site Video or Photo
              </button>
            </div>
            <div className="studio-inline-row" style={{ marginTop: '0.5rem' }}>
              <select
                className="studio-select"
                style={{ width: '110px' }}
                value={section.mediaType}
                onChange={(e) =>
                  onPatch((s) => ({ ...s, mediaType: e.target.value as 'video' | 'image' }))
                }
              >
                <option value="video">Video</option>
                <option value="image">Image</option>
              </select>
              <input
                className="studio-input"
                placeholder="Media path or https:// URL"
                value={section.mediaSrc}
                onChange={(e) => onPatch((s) => ({ ...s, mediaSrc: e.target.value }))}
              />
            </div>
          </FieldGroup>

          <FieldGroup label={`Background Brightness (${Math.round(section.brightness * 100)}%)`}>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={section.brightness}
              onChange={(e) =>
                onPatch((s) => ({ ...s, brightness: parseFloat(e.target.value) }))
              }
              className="studio-range"
            />
          </FieldGroup>

          <FieldGroup label="Section Height">
            <select
              className="studio-select"
              value={section.height}
              onChange={(e) =>
                onPatch((s) => ({ ...s, height: e.target.value as SectionHeight }))
              }
            >
              <option value="compact">Compact</option>
              <option value="medium">Medium</option>
              <option value="tall">Tall Cinema</option>
            </select>
          </FieldGroup>

          {section.type === 'hero' && (
            <FieldGroup label="Text Alignment">
              <select
                className="studio-select"
                value={section.align}
                onChange={(e) =>
                  onPatch((s) => ({ ...s, align: e.target.value as 'left' | 'center' }))
                }
              >
                <option value="left">Bottom Left</option>
                <option value="center">Centered</option>
              </select>
            </FieldGroup>
          )}

          <ToggleRow
            label="Show Action Button"
            checked={section.showCta}
            onChange={(showCta) => onPatch((s) => ({ ...s, showCta }))}
          />
          {section.showCta && (
            <>
              <FieldGroup label="Button Text">
                <input
                  className="studio-input"
                  value={section.ctaText}
                  onChange={(e) => onPatch((s) => ({ ...s, ctaText: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup label="Button Link URL">
                <input
                  className="studio-input"
                  placeholder="https://... or mailto:..."
                  value={section.ctaUrl}
                  onChange={(e) => onPatch((s) => ({ ...s, ctaUrl: e.target.value }))}
                />
              </FieldGroup>
            </>
          )}
        </>
      )}

      {section.type === 'mission' && (
        <>
          <FieldGroup label="Heading">
            <input
              className="studio-input"
              value={section.heading}
              onChange={(e) => onPatch((s) => ({ ...s, heading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Paragraph Text">
            <textarea
              className="studio-textarea"
              rows={5}
              value={section.body}
              onChange={(e) => onPatch((s) => ({ ...s, body: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Alignment">
            <select
              className="studio-select"
              value={section.align}
              onChange={(e) =>
                onPatch((s) => ({ ...s, align: e.target.value as 'left' | 'center' }))
              }
            >
              <option value="center">Centered</option>
              <option value="left">Left Aligned</option>
            </select>
          </FieldGroup>
          <ToggleRow
            label="Show Action Button"
            checked={section.showCta}
            onChange={(showCta) => onPatch((s) => ({ ...s, showCta }))}
          />
          {section.showCta && (
            <>
              <FieldGroup label="Button Label">
                <input
                  className="studio-input"
                  value={section.ctaText}
                  onChange={(e) => onPatch((s) => ({ ...s, ctaText: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup label="Button Link URL">
                <input
                  className="studio-input"
                  value={section.ctaUrl}
                  onChange={(e) => onPatch((s) => ({ ...s, ctaUrl: e.target.value }))}
                />
              </FieldGroup>
            </>
          )}
          <ToggleRow
            label="Show Email Contact Card"
            checked={section.showContactBox}
            onChange={(showContactBox) => onPatch((s) => ({ ...s, showContactBox }))}
          />
          {section.showContactBox && (
            <>
              <FieldGroup label="Card Label">
                <input
                  className="studio-input"
                  value={section.contactLabel}
                  onChange={(e) => onPatch((s) => ({ ...s, contactLabel: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup label="Contact Email">
                <input
                  className="studio-input"
                  value={section.contactEmail}
                  onChange={(e) => onPatch((s) => ({ ...s, contactEmail: e.target.value }))}
                />
              </FieldGroup>
            </>
          )}
        </>
      )}

      {section.type === 'split' && (
        <>
          <FieldGroup label="Media Position">
            <select
              className="studio-select"
              value={section.imagePosition}
              onChange={(e) =>
                onPatch((s) => ({ ...s, imagePosition: e.target.value as 'left' | 'right' }))
              }
            >
              <option value="left">Photo on Left, Text on Right</option>
              <option value="right">Text on Left, Photo on Right</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Photo or Video">
            <div className="studio-media-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadFile(file, (url) =>
                      onPatch((s) => ({ ...s, mediaType: 'image', mediaSrc: url }))
                    );
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="studio-btn studio-btn-outline studio-btn-full"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />{' '}
                {isUploading ? 'Uploading...' : 'Upload Photo from Computer'}
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-subtle studio-btn-full"
                onClick={() =>
                  onOpenMediaLibrary(true, (src, mediaType) =>
                    onPatch((s) => ({ ...s, mediaSrc: src, mediaType }))
                  )
                }
              >
                <ImageIcon size={14} /> Choose Existing Media
              </button>
            </div>
          </FieldGroup>
          <FieldGroup label="Eyebrow Label">
            <input
              className="studio-input"
              value={section.eyebrow}
              onChange={(e) => onPatch((s) => ({ ...s, eyebrow: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Heading">
            <input
              className="studio-input"
              value={section.heading}
              onChange={(e) => onPatch((s) => ({ ...s, heading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Story Text">
            <textarea
              className="studio-textarea"
              rows={4}
              value={section.body}
              onChange={(e) => onPatch((s) => ({ ...s, body: e.target.value }))}
            />
          </FieldGroup>
          <ToggleRow
            label="Show Action Button"
            checked={section.showCta}
            onChange={(showCta) => onPatch((s) => ({ ...s, showCta }))}
          />
          {section.showCta && (
            <>
              <FieldGroup label="Button Text">
                <input
                  className="studio-input"
                  value={section.ctaText}
                  onChange={(e) => onPatch((s) => ({ ...s, ctaText: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup label="Button Link URL">
                <input
                  className="studio-input"
                  value={section.ctaUrl}
                  onChange={(e) => onPatch((s) => ({ ...s, ctaUrl: e.target.value }))}
                />
              </FieldGroup>
            </>
          )}
        </>
      )}

      {section.type === 'pillars' && (
        <>
          <FieldGroup label="Section Heading">
            <input
              className="studio-input"
              value={section.heading}
              onChange={(e) => onPatch((s) => ({ ...s, heading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Subheading">
            <input
              className="studio-input"
              value={section.subheading}
              onChange={(e) => onPatch((s) => ({ ...s, subheading: e.target.value }))}
            />
          </FieldGroup>
          <label className="studio-field-label">Cards ({section.items.length})</label>
          <div className="studio-subcard-list">
            {section.items.map((item: PillarItem, idx: number) => (
              <div key={item.id} className="studio-subcard">
                <div className="studio-subcard-head">
                  <strong>Card {idx + 1}</strong>
                  {section.items.length > 1 && (
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() =>
                        onPatch((s) => ({
                          ...s,
                          items: s.items.filter((it: PillarItem) => it.id !== item.id),
                        }))
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input
                  className="studio-input"
                  placeholder="Badge / Number (e.g. 01)"
                  value={item.badge}
                  onChange={(e) =>
                    onPatch((s) => ({
                      ...s,
                      items: s.items.map((it: PillarItem) =>
                        it.id === item.id ? { ...it, badge: e.target.value } : it
                      ),
                    }))
                  }
                />
                <input
                  className="studio-input"
                  placeholder="Title"
                  value={item.title}
                  onChange={(e) =>
                    onPatch((s) => ({
                      ...s,
                      items: s.items.map((it: PillarItem) =>
                        it.id === item.id ? { ...it, title: e.target.value } : it
                      ),
                    }))
                  }
                />
                <textarea
                  className="studio-textarea"
                  rows={2}
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    onPatch((s) => ({
                      ...s,
                      items: s.items.map((it: PillarItem) =>
                        it.id === item.id ? { ...it, description: e.target.value } : it
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="studio-btn studio-btn-outline studio-btn-full"
            style={{ marginTop: '0.5rem' }}
            onClick={() =>
              onPatch((s) => ({
                ...s,
                items: [
                  ...s.items,
                  {
                    id: `card-${Date.now().toString(36)}`,
                    badge: `0${s.items.length + 1}`,
                    title: 'New Highlight',
                    description: 'Describe this goal or achievement.',
                  },
                ],
              }))
            }
          >
            <Plus size={14} /> Add Card
          </button>
        </>
      )}

      {section.type === 'cta' && (
        <>
          <FieldGroup label="Heading">
            <input
              className="studio-input"
              value={section.heading}
              onChange={(e) => onPatch((s) => ({ ...s, heading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Supporting Message">
            <textarea
              className="studio-textarea"
              rows={3}
              value={section.body}
              onChange={(e) => onPatch((s) => ({ ...s, body: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Primary Button Text">
            <input
              className="studio-input"
              value={section.primaryText}
              onChange={(e) => onPatch((s) => ({ ...s, primaryText: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Primary Button Link (Donate URL or mailto:)">
            <input
              className="studio-input"
              value={section.primaryUrl}
              onChange={(e) => onPatch((s) => ({ ...s, primaryUrl: e.target.value }))}
            />
          </FieldGroup>
          <ToggleRow
            label="Show Second Button"
            checked={section.showSecondary}
            onChange={(showSecondary) => onPatch((s) => ({ ...s, showSecondary }))}
          />
          {section.showSecondary && (
            <>
              <FieldGroup label="Second Button Text">
                <input
                  className="studio-input"
                  value={section.secondaryText}
                  onChange={(e) => onPatch((s) => ({ ...s, secondaryText: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup label="Second Button Link">
                <input
                  className="studio-input"
                  value={section.secondaryUrl}
                  onChange={(e) => onPatch((s) => ({ ...s, secondaryUrl: e.target.value }))}
                />
              </FieldGroup>
            </>
          )}
        </>
      )}

      {section.type === 'gallery' && (
        <>
          <FieldGroup label="Gallery Heading">
            <input
              className="studio-input"
              value={section.heading}
              onChange={(e) => onPatch((s) => ({ ...s, heading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Gallery Subtitle">
            <input
              className="studio-input"
              value={section.subheading}
              onChange={(e) => onPatch((s) => ({ ...s, subheading: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Desktop Grid Columns">
            <select
              className="studio-select"
              value={section.columns}
              onChange={(e) =>
                onPatch((s) => ({ ...s, columns: Number(e.target.value) as 3 | 4 }))
              }
            >
              <option value={3}>3 Columns (Larger Photos)</option>
              <option value={4}>4 Columns (Compact Grid)</option>
            </select>
          </FieldGroup>

          <ToggleRow
            label="Auto-Sync Shared Google Drive Folder"
            checked={section.showDrivePhotos}
            onChange={(showDrivePhotos) => onPatch((s) => ({ ...s, showDrivePhotos }))}
          />
          {section.showDrivePhotos && getDriveFolderWebUrl(driveFolderUrl) && (
            <a
              href={getDriveFolderWebUrl(driveFolderUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="studio-inline-link"
              style={{ marginBottom: '0.85rem' }}
            >
              <FolderOpen size={13} /> Manage Google Drive Folder Photos{' '}
              <ExternalLink size={12} />
            </a>
          )}

          <div className="studio-media-actions" style={{ marginBottom: '0.85rem' }}>
            <input
              ref={galleryUploadRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUploadFile(file, (url) => {
                    const newItem: CustomGalleryImage = {
                      id: `upload-${Date.now().toString(36)}`,
                      src: url,
                      alt: file.name.replace(/\.[^.]+$/, ''),
                    };
                    onPatch((s) => ({
                      ...s,
                      customImages: [newItem, ...(s.customImages || [])],
                    }));
                  });
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-full"
              disabled={isUploading}
              onClick={() => galleryUploadRef.current?.click()}
            >
              <Upload size={14} />{' '}
              {isUploading ? 'Uploading Photo...' : '+ Upload Photo to Gallery'}
            </button>
          </div>

          <label className="studio-field-label">
            Built-in & Uploaded Photos ({section.customImages.filter((i) => !i.hidden).length}{' '}
            shown)
          </label>
          <div className="studio-gallery-manager">
            {section.customImages.map((img: CustomGalleryImage, idx: number) => (
              <div
                key={img.id}
                className={`studio-gallery-row ${img.hidden ? 'is-muted' : ''}`}
              >
                <img src={resolveAssetUrl(img.src)} alt={img.alt} />
                <input
                  className="studio-input"
                  value={img.alt}
                  placeholder="Photo description"
                  onChange={(e) =>
                    onPatch((s) => ({
                      ...s,
                      customImages: s.customImages.map((it: CustomGalleryImage) =>
                        it.id === img.id ? { ...it, alt: e.target.value } : it
                      ),
                    }))
                  }
                />
                <div className="studio-gallery-row-btns">
                  <button
                    type="button"
                    disabled={idx === 0}
                    title="Move earlier"
                    onClick={() =>
                      onPatch((s) => {
                        const arr = [...s.customImages];
                        const [m] = arr.splice(idx, 1);
                        arr.splice(idx - 1, 0, m);
                        return { ...s, customImages: arr };
                      })
                    }
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === section.customImages.length - 1}
                    title="Move later"
                    onClick={() =>
                      onPatch((s) => {
                        const arr = [...s.customImages];
                        const [m] = arr.splice(idx, 1);
                        arr.splice(idx + 1, 0, m);
                        return { ...s, customImages: arr };
                      })
                    }
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    title={img.hidden ? 'Show photo' : 'Hide photo'}
                    onClick={() =>
                      onPatch((s) => ({
                        ...s,
                        customImages: s.customImages.map((it: CustomGalleryImage) =>
                          it.id === img.id ? { ...it, hidden: !it.hidden } : it
                        ),
                      }))
                    }
                  >
                    {img.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    title="Remove photo"
                    onClick={() =>
                      onPatch((s) => ({
                        ...s,
                        customImages: s.customImages.filter(
                          (it: CustomGalleryImage) => it.id !== img.id
                        ),
                      }))
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const FieldGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="studio-field-group">
    <label className="studio-field-label">{label}</label>
    {children}
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="studio-toggle-row">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="studio-color-row">
    <span>{label}</span>
    <div className="studio-color-input-wrap">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <code>{value}</code>
    </div>
  </div>
);
