import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { DashboardView } from './components/DashboardView';
import { OAuthSetupModal } from './components/OAuthSetupModal';
import { AuthMeResponse, AuthStatusResponse, DiscordGuild, DiscordUser } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<'landing' | 'dashboard'>('landing');
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  const fetchAuthState = useCallback(async () => {
    try {
      const [statusRes, meRes] = await Promise.all([
        fetch('/api/auth/discord/status'),
        fetch('/api/auth/me'),
      ]);

      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as AuthStatusResponse;
        setAuthStatus(statusData);
      }

      if (meRes.ok) {
        const meData = (await meRes.json()) as AuthMeResponse;
        if (meData.authenticated && meData.user) {
          setUser(meData.user);
          setGuilds(meData.guilds || []);
        } else {
          setUser(null);
          setGuilds([]);
        }
      }
    } catch {
      // Network retry handled on user interaction
    }
  }, []);

  useEffect(() => {
    fetchAuthState();
  }, [fetchAuthState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setAuthBanner(null);
        fetchAuthState().then(() => {
          setActiveView('dashboard');
        });
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setAuthBanner(event.data.error || 'Discord login was cancelled.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchAuthState]);

  const handleNavigate = (view: 'landing' | 'dashboard', sectionId?: string) => {
    setActiveView(view);
    if (view === 'landing' && sectionId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLoginClick = async () => {
    setAuthLoading(true);
    setAuthBanner(null);
    try {
      const res = await fetch('/api/auth/discord/url');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'DISCORD_CLIENT_SECRET_MISSING') {
          setSetupModalOpen(true);
          return;
        }
        throw new Error(err.message || 'Unable to start Discord login.');
      }

      const { url } = (await res.json()) as { url: string };
      const popup = window.open(
        url,
        'discord_oauth_popup',
        'width=520,height=720,menubar=no,toolbar=no,status=no'
      );

      if (!popup) {
        setAuthBanner('Popup blocked by browser. Allow popups for this site and click Login again.');
      }
    } catch (err) {
      setAuthBanner(err instanceof Error ? err.message : 'Unable to connect to Discord.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setGuilds([]);
      setActiveView('landing');
    }
  };

  return (
    <div className="min-h-screen bg-[#07080D] text-[#F8FAFC]">
      <Navbar
        activeView={activeView}
        onNavigate={handleNavigate}
        user={user}
        onLoginClick={handleLoginClick}
        onLogoutClick={handleLogoutClick}
        authLoading={authLoading}
      />

      {authBanner && (
        <div className="border-b border-[#F59E0B]/30 bg-[#F59E0B]/10 px-6 py-2.5 text-center text-xs text-[#FDE68A]">
          {authBanner}
        </div>
      )}

      {activeView === 'landing' ? (
        <LandingView
          user={user}
          onOpenDashboard={() => handleNavigate('dashboard')}
          onLoginClick={handleLoginClick}
        />
      ) : (
        <DashboardView
          user={user}
          guilds={guilds}
          authStatus={authStatus}
          onLoginClick={handleLoginClick}
          authLoading={authLoading}
        />
      )}

      <OAuthSetupModal
        open={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        authStatus={authStatus}
      />
    </div>
  );
}
