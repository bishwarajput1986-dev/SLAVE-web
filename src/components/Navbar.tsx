import { useState, useRef, useEffect } from 'react';
import { LogOut, LayoutDashboard, ChevronDown, Menu, X } from 'lucide-react';
import { DiscordUser } from '../types';
import { SUPPORT_SERVER_URL } from '../data/commands';

interface NavbarProps {
  activeView: 'landing' | 'dashboard';
  onNavigate: (view: 'landing' | 'dashboard', sectionId?: string) => void;
  user: DiscordUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  authLoading: boolean;
}

export function Navbar({
  activeView,
  onNavigate,
  user,
  onLoginClick,
  onLogoutClick,
  authLoading,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleNavClick = (view: 'landing' | 'dashboard', sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(view, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07080D]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('landing', 'top')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] rounded-md"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M12 2L20 6V12.5C20 17.2 16.6 20.9 12 22C7.4 20.9 4 17.2 4 12.5V6L12 2Z"
              stroke="#5865F2"
              strokeWidth="1.75"
              fill="#0F111A"
            />
            <path
              d="M9 12L11 14L15.5 9.5"
              stroke="#F8FAFC"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            SLAVE
          </span>
        </button>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#94A3B8]"
        >
          <button
            type="button"
            onClick={() => handleNavClick('landing', 'top')}
            className={`whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-white ${
              activeView === 'landing' ? 'text-white' : ''
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('landing', 'security')}
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-white"
          >
            Security
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('landing', 'commands')}
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-white"
          >
            Commands
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-white ${
              activeView === 'dashboard' ? 'text-white underline decoration-[#5865F2] underline-offset-8' : ''
            }`}
          >
            Dashboard
          </button>
          <a
            href={SUPPORT_SERVER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-white"
          >
            Support
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-lg border border-white/[0.1] bg-[#0F111A] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:border-white/[0.2] whitespace-nowrap shrink-0"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5865F2] text-xs font-semibold text-white">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[120px] truncate">
                  {user.globalName || user.username}
                </span>
                <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/[0.1] bg-[#0F111A] p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate('dashboard');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#E2E8F0] transition-colors hover:bg-white/[0.06]"
                  >
                    <LayoutDashboard className="h-4 w-4 text-[#5865F2]" />
                    <span>Moderation Console</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogoutClick();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#F87171] transition-colors hover:bg-white/[0.06]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              disabled={authLoading}
              className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#4752C4] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {authLoading ? 'Connecting...' : 'Login with Discord'}
            </button>
          )}

          <button
            type="button"
            aria-label="Toggle Menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-[#94A3B8] hover:text-white md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-[#07080D] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm font-medium text-[#94A3B8]">
            <button
              type="button"
              onClick={() => handleNavClick('landing', 'top')}
              className="py-2 text-left hover:text-white"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('landing', 'security')}
              className="py-2 text-left hover:text-white"
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('landing', 'commands')}
              className="py-2 text-left hover:text-white"
            >
              Commands
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className="py-2 text-left hover:text-white"
            >
              Dashboard
            </button>
            <a
              href={SUPPORT_SERVER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 hover:text-white"
            >
              Support
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
