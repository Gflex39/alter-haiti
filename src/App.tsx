import React, { useCallback, useEffect, useState } from 'react';
import { AdminStudio } from './components/AdminStudio';
import { SiteRenderer } from './components/SiteRenderer';
import {
  fetchSiteContent,
  getStoredSessionToken,
  ManagedUserSummary,
  ServerConfigStatus,
} from './services/cmsApi';
import { DEFAULT_SITE_CONTENT, SiteContent } from './types/cms';

function detectAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.toLowerCase();
    return (
      pathname === '/admin' ||
      pathname.endsWith('/admin') ||
      hash === '#admin' ||
      hash === '#edit' ||
      params.get('edit') === '1'
    );
  } catch {
    return false;
  }
}

export const App: React.FC = () => {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [serverConfigured, setServerConfigured] = useState<ServerConfigStatus>({
    hasAdminPassword: false,
    hasGithubToken: false,
  });
  const [localDev, setLocalDev] = useState(false);
  const [initialUsers, setInitialUsers] = useState<ManagedUserSummary[]>([
    { username: 'admin', role: 'owner' },
  ]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => detectAdminRoute());

  useEffect(() => {
    let active = true;
    fetchSiteContent(detectAdminRoute()).then((res) => {
      if (!active) return;
      setContent(res.content);
      setServerConfigured(res.configured);
      setLocalDev(Boolean(res.localDev));
      if (res.localUsers) {
        setInitialUsers(res.localUsers);
      }
      setIsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncRoute = () => setIsAdminRoute(detectAdminRoute());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const openEditor = useCallback(() => {
    try {
      const host = window.location.hostname;
      if (host.endsWith('github.io')) {
        window.location.hash = 'admin';
      } else {
        window.history.pushState({}, '', '/admin');
      }
    } catch {
      // Ignore history restrictions in sandboxed preview iframes
    }
    setIsAdminRoute(true);
    try {
      window.scrollTo(0, 0);
    } catch {
      // Ignore
    }
  }, []);

  const closeEditor = useCallback(() => {
    try {
      if (window.location.hash) {
        window.history.pushState(
          {},
          '',
          window.location.pathname.replace(/\/admin\/?$/, '/') || '/'
        );
      } else {
        const nextPath = window.location.pathname.replace(/\/admin\/?$/, '') || '/';
        window.history.pushState({}, '', nextPath);
      }
    } catch {
      // Ignore history restrictions in sandboxed preview iframes
    }
    setIsAdminRoute(false);
    try {
      window.scrollTo(0, 0);
    } catch {
      // Ignore
    }
  }, []);

  if (isAdminRoute) {
    if (!isLoaded) {
      return (
        <div className="studio-loading-screen">
          <div className="studio-spinner" />
          <p>Loading Alter Haiti Website Studio...</p>
        </div>
      );
    }
    return (
      <AdminStudio
        initialContent={content}
        serverConfigured={serverConfigured}
        localDev={localDev}
        initialUsers={initialUsers}
        onPublished={(updated) => setContent(updated)}
        onExit={closeEditor}
      />
    );
  }

  const showQuickEditPill = localDev || Boolean(getStoredSessionToken());

  return (
    <>
      <SiteRenderer content={content} onOpenEditor={openEditor} />
      {showQuickEditPill && (
        <button
          type="button"
          className="floating-edit-pill"
          onClick={openEditor}
        >
          ✎ Edit This Website
        </button>
      )}
    </>
  );
};

export default App;
