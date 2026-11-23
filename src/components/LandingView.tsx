import { useState, useMemo } from 'react';
import {
  ArrowRight,
  Copy,
  Check,
  Search,
  ExternalLink,
  Shield,
  Lock,
  Terminal,
  Activity,
} from 'lucide-react';
import {
  BOT_INVITE_URL,
  SUPPORT_SERVER_URL,
  SLAVE_COMMANDS,
  DEVELOPER_NAME,
  DEVELOPER_ID,
  DEVELOPER_URL,
} from '../data/commands';
import { BotCommand, DiscordUser } from '../types';

interface LandingViewProps {
  user: DiscordUser | null;
  onOpenDashboard: () => void;
  onLoginClick: () => void;
}

const CATEGORIES: Array<'All' | BotCommand['category']> = [
  'All',
  'Moderation',
  'Anti-Nuke',
  'Automod',
  'Utility',
];

export function LandingView({ user, onOpenDashboard, onLoginClick }: LandingViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | BotCommand['category']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [bento1Failed, setBento1Failed] = useState(false);
  const [bento2Failed, setBento2Failed] = useState(false);

  const filteredCommands = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SLAVE_COMMANDS.filter((cmd) => {
      const catMatch = selectedCategory === 'All' || cmd.category === selectedCategory;
      const textMatch =
        !q ||
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.syntax.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [selectedCategory, searchQuery]);

  const handleCopyCommand = async (syntax: string, name: string) => {
    try {
      await navigator.clipboard.writeText(syntax);
      setCopiedCmd(name);
      setTimeout(() => setCopiedCmd(null), 1600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <main id="top" className="bg-[#07080D] text-[#F8FAFC]">
      {/* Hero Section: Asymmetric 2-Column Split */}
      <section className="mx-auto max-w-[1200px] px-6 pt-14 pb-16 lg:pt-20 lg:pb-20">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          {/* Left Column */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <p className="text-sm font-medium tracking-wide text-[#94A3B8]">
                Discord Security · Anti-Nuke · Moderation Control
              </p>
              <h1
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)' }}
                className="mt-4 font-display font-bold leading-[1.08] tracking-tight text-white [text-wrap:balance]"
              >
                Server security and moderation built for Discord communities.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-[#94A3B8]">
                SLAVE defends Discord servers against unauthorized raids, mass bans, and role escalation while giving moderators a real-time workspace for policy control and audit logs.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href={BOT_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#4752C4] whitespace-nowrap shrink-0"
                >
                  <span>Add SLAVE to Server</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={user ? onOpenDashboard : onLoginClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-[#0F111A] px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:border-white/[0.24] hover:bg-[#161926] whitespace-nowrap shrink-0"
                >
                  <span>{user ? 'Open Dashboard' : 'Moderator Login'}</span>
                </button>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.08] pt-6 text-sm text-[#94A3B8]">
              <span>Bot ID: <span className="font-mono text-[#E2E8F0] tabular-nums">1552295211164508271</span></span>
              <span aria-hidden="true">·</span>
              <a
                href={DEVELOPER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#94A3B8] transition-colors hover:text-white"
              >
                <span>Developer: <span className="font-medium text-[#E2E8F0]">{DEVELOPER_NAME}</span></span>
                <span className="font-mono text-xs text-[#64748B] tabular-nums">({DEVELOPER_ID})</span>
              </a>
              <span aria-hidden="true">·</span>
              <a
                href={SUPPORT_SERVER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#E2E8F0] transition-colors hover:text-white"
              >
                <span>Support Server</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#94A3B8]" />
              </a>
            </div>
          </div>

          {/* Right Column: Visual Showcase */}
          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F111A]">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_slave_sentinel_1794645704112.jpg"
                  alt="SLAVE geometric obsidian security core"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-[#0F111A] via-[#121629] to-[#07080D] p-8 text-center">
                  <Shield className="h-12 w-12 text-[#5865F2]" />
                  <p className="mt-4 font-display text-lg font-semibold text-white">SLAVE Security Core</p>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080D]/85 via-[#07080D]/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Automated Enforcement</p>
                  <p className="mt-1 font-display text-base font-semibold text-white">
                    Anti-Nuke · Automod · Live Audit Stream
                  </p>
                </div>
                <span className="font-mono text-xs text-[#E2E8F0] tabular-nums">
                  Discord OAuth2
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Proof Strip */}
        <div className="mt-10 grid grid-cols-1 divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] bg-[#0F111A] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div className="p-6">
            <p className="text-xs font-medium text-[#94A3B8]">Interception Latency</p>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">&lt; 80 ms</p>
            <p className="mt-1 text-xs text-[#64748B]">Destructive event threshold</p>
          </div>
          <div className="p-6">
            <p className="text-xs font-medium text-[#94A3B8]">Security Guards</p>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">4 Modules</p>
            <p className="mt-1 text-xs text-[#64748B]">Bans, channels, roles, webhooks</p>
          </div>
          <div className="p-6">
            <p className="text-xs font-medium text-[#94A3B8]">Audit Attribution</p>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">100% Logged</p>
            <p className="mt-1 text-xs text-[#64748B]">Actor, target, reason &amp; timestamp</p>
          </div>
          <div className="p-6">
            <p className="text-xs font-medium text-[#94A3B8]">Access Control</p>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">Guild-Scoped</p>
            <p className="mt-1 text-xs text-[#64748B]">Verified via Discord permissions</p>
          </div>
        </div>
      </section>

      {/* Capabilities Bento Grid */}
      <section id="security" className="border-t border-white/[0.08] py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#5865F2]">Security Architecture</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
              Built to contain compromised staff accounts and raids before channels are lost.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 01. Col-Span-2 */}
            <article className="grid grid-cols-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F111A] md:grid-cols-2 lg:col-span-2">
              <div className="flex flex-col justify-between p-8">
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">
                    01. Anti-Nuke &amp; Raid Shield
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
                    Detects abnormal bursts of member bans, channel deletions, role edits, and webhook creations. Automatically strips permissions or quarantines unwhitelisted actors when thresholds trigger.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                  <span>Anti-Ban</span>
                  <span aria-hidden="true">·</span>
                  <span>Anti-Channel Delete</span>
                  <span aria-hidden="true">·</span>
                  <span>Anti-Webhook</span>
                </div>
              </div>
              <div className="relative min-h-[220px] border-t border-white/[0.08] md:border-t-0 md:border-l">
                {!bento1Failed ? (
                  <img
                    src="/src/assets/images/bento_antinuke_shield_1794645704320.jpg"
                    alt="Anodized security prism representing anti-nuke protection"
                    referrerPolicy="no-referrer"
                    onError={() => setBento1Failed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#121521]">
                    <Lock className="h-10 w-10 text-[#5865F2]" />
                  </div>
                )}
              </div>
            </article>

            {/* 02. Col-Span-1 */}
            <article className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0F111A] p-8">
              <div>
                <h3 className="font-display text-xl font-semibold text-white">
                  02. Role &amp; Permission Guard
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
                  Prevents unauthorized elevation of Administrator or Manage Server permissions and locks critical roles behind server-owner whitelists.
                </p>
              </div>
              <div className="mt-8 border-t border-white/[0.08] pt-4 text-xs text-[#94A3B8]">
                Enforces Quarantine · Kick · Ban policies
              </div>
            </article>

            {/* 03. Col-Span-1 */}
            <article className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0F111A] p-8">
              <div>
                <h3 className="font-display text-xl font-semibold text-white">
                  03. Automated Moderation
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
                  Filter external Discord invites, mass user mentions, message spam bursts, and harmful content with configurable auto-timeout durations.
                </p>
              </div>
              <div className="mt-8 border-t border-white/[0.08] pt-4 text-xs text-[#94A3B8]">
                Adjustable caps &amp; timeout windows
              </div>
            </article>

            {/* 04. Col-Span-2 */}
            <article className="grid grid-cols-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F111A] md:grid-cols-2 lg:col-span-2">
              <div className="relative order-2 min-h-[220px] border-t border-white/[0.08] md:order-1 md:border-t-0 md:border-r">
                {!bento2Failed ? (
                  <img
                    src="/src/assets/images/bento_audit_stream_1794645705204.jpg"
                    alt="Fiber-optic server channels representing real-time audit logging"
                    referrerPolicy="no-referrer"
                    onError={() => setBento2Failed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#121521]">
                    <Activity className="h-10 w-10 text-[#5865F2]" />
                  </div>
                )}
              </div>
              <div className="order-1 flex flex-col justify-between p-8 md:order-2">
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">
                    04. Real-Time Audit Ledger
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
                    Every moderation command, lockdown trigger, and security setting update streams directly to connected staff dashboards in real time with CSV export.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                  <span>Server-Sent Events</span>
                  <span aria-hidden="true">·</span>
                  <span>Case Search</span>
                  <span aria-hidden="true">·</span>
                  <span>CSV Export</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Interactive Commands Directory */}
      <section id="commands" className="border-t border-white/[0.08] py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium text-[#5865F2]">Command Reference</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
                Slash commands &amp; moderator syntax
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0F111A] p-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-[#5865F2] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter commands..."
                  aria-label="Filter commands"
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0F111A] py-2 pr-3 pl-9 text-sm text-white placeholder-[#64748B] focus:border-[#5865F2] focus:outline-none sm:w-56"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F111A]">
            <div className="hidden grid-cols-12 border-b border-white/[0.08] bg-[#0B0D14] px-6 py-3 text-xs font-medium text-[#94A3B8] md:grid">
              <div className="col-span-3">Command</div>
              <div className="col-span-5">Description</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2 text-right">Required Permission</div>
            </div>

            {filteredCommands.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#94A3B8]">
                No commands match &ldquo;{searchQuery}&rdquo;. Clear your search to view all commands.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filteredCommands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="grid grid-cols-1 items-center gap-3 px-6 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-12"
                  >
                    <div className="flex items-center justify-between gap-2 md:col-span-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Terminal className="h-4 w-4 shrink-0 text-[#5865F2]" />
                        <code className="truncate font-mono text-xs font-medium text-white">
                          {cmd.syntax}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(cmd.syntax, cmd.name)}
                        aria-label={`Copy ${cmd.name} syntax`}
                        className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-white shrink-0"
                      >
                        {copiedCmd === cmd.name ? (
                          <Check className="h-3.5 w-3.5 text-[#10B981]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <p className="text-sm text-[#94A3B8] md:col-span-5">
                      {cmd.description}
                    </p>

                    <div className="text-xs text-[#64748B] md:col-span-2">
                      {cmd.category}
                    </div>

                    <div className="text-xs font-medium text-[#E2E8F0] md:col-span-2 md:text-right">
                      {cmd.permission}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Deployment & Support CTA */}
      <section className="border-t border-white/[0.08] py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col items-start justify-between gap-8 rounded-xl border border-white/[0.08] bg-[#0F111A] p-8 md:flex-row md:items-center md:p-10">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-white [text-wrap:balance]">
                Deploy SLAVE to your Discord server and manage moderation live.
              </h2>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Authorize the bot in your server or sign in with Discord to configure anti-nuke thresholds, automod filters, and inspect live audit logs.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-[#64748B]">
                <code className="truncate font-mono text-[#E2E8F0]">{BOT_INVITE_URL}</code>
                <button
                  type="button"
                  onClick={() => handleCopyCommand(BOT_INVITE_URL, '__invite__')}
                  aria-label="Copy SLAVE bot invite link"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-white shrink-0"
                >
                  {copiedCmd === '__invite__' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#10B981]" />
                      <span className="text-[#10B981]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href={BOT_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4] whitespace-nowrap shrink-0"
              >
                <span>Invite SLAVE</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={SUPPORT_SERVER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06] whitespace-nowrap shrink-0"
              >
                <span>Support Server</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.08] py-10">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-6 text-xs text-[#64748B] sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-sm font-bold text-white">SLAVE</span>
            <span aria-hidden="true">·</span>
            <span>Discord Security &amp; Moderation Dashboard</span>
            <span aria-hidden="true">·</span>
            <a
              href={DEVELOPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Developed by <span className="text-[#E2E8F0]">{DEVELOPER_NAME}</span>{' '}
              <span className="font-mono tabular-nums">({DEVELOPER_ID})</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a
              href={BOT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Invite Bot
            </a>
            <a
              href={SUPPORT_SERVER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Support Server
            </a>
            <a
              href={DEVELOPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Contact {DEVELOPER_NAME}
            </a>
            <button
              type="button"
              onClick={user ? onOpenDashboard : onLoginClick}
              className="transition-colors hover:text-white"
            >
              Moderation Console
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
