import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Search,
  Download,
  ExternalLink,
  Copy,
  Check,
  Sliders,
  FileText,
  Gavel,
  AlertTriangle,
} from 'lucide-react';
import {
  AuthStatusResponse,
  DiscordGuild,
  DiscordUser,
  GuildModerationState,
  ModerationActionType,
} from '../types';
import {
  BOT_INVITE_URL,
  SUPPORT_SERVER_URL,
  DEVELOPER_NAME,
  DEVELOPER_URL,
} from '../data/commands';

interface DashboardViewProps {
  user: DiscordUser | null;
  guilds: DiscordGuild[];
  authStatus: AuthStatusResponse | null;
  onLoginClick: () => void;
  authLoading: boolean;
}

type DashboardTab = 'desk' | 'security' | 'logs';

export function DashboardView({
  user,
  guilds,
  authStatus,
  onLoginClick,
  authLoading,
}: DashboardViewProps) {
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('desk');
  const [guildState, setGuildState] = useState<GuildModerationState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);

  // Moderation action form state
  const [actionType, setActionType] = useState<ModerationActionType>('timeout');
  const [targetUser, setTargetUser] = useState('');
  const [targetId, setTargetId] = useState('');
  const [duration, setDuration] = useState('15m');
  const [reason, setReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Log filtering state
  const [logFilter, setLogFilter] = useState<'all' | ModerationActionType>('all');
  const [logSearch, setLogSearch] = useState('');

  // Auto-select first manageable guild
  useEffect(() => {
    if (guilds.length > 0 && (!selectedGuildId || !guilds.some((g) => g.id === selectedGuildId))) {
      setSelectedGuildId(guilds[0].id);
    }
  }, [guilds, selectedGuildId]);

  const activeGuild = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId) || null,
    [guilds, selectedGuildId]
  );

  // Subscribe to real-time SSE moderation status & logs for selected guild
  useEffect(() => {
    if (!user || !selectedGuildId) {
      setGuildState(null);
      setStreamStatus('disconnected');
      return;
    }

    let cancelled = false;
    setLoadingState(true);
    setStreamStatus('connecting');

    fetch(`/api/guilds/${encodeURIComponent(selectedGuildId)}/state`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load guild state'))))
      .then((data: GuildModerationState) => {
        if (!cancelled) {
          setGuildState(data);
          setLoadingState(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingState(false);
        }
      });

    const source = new EventSource(`/api/guilds/${encodeURIComponent(selectedGuildId)}/stream`);
    source.onopen = () => {
      if (!cancelled) setStreamStatus('connected');
    };
    source.onmessage = (event) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(event.data) as {
          type: string;
          state: GuildModerationState;
        };
        if (parsed.type === 'GUILD_STATE_UPDATE' && parsed.state) {
          setGuildState(parsed.state);
          setLoadingState(false);
        }
      } catch {
        // Ignore malformed event
      }
    };
    source.onerror = () => {
      if (!cancelled) setStreamStatus('connecting');
    };

    return () => {
      cancelled = true;
      source.close();
      setStreamStatus('disconnected');
    };
  }, [user, selectedGuildId]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const handleToggleLockdown = async () => {
    if (!activeGuild || !guildState) return;
    const nextAction = guildState.lockdown ? 'unlock' : 'lockdown';
    try {
      const res = await fetch(`/api/guilds/${encodeURIComponent(activeGuild.id)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: nextAction,
          target: nextAction === 'lockdown' ? 'All Public Channels' : 'Server Lockdown Lifted',
          reason:
            nextAction === 'lockdown'
              ? 'Emergency server lockdown activated from SLAVE console.'
              : 'Server lockdown lifted by moderator.',
        }),
      });
      if (!res.ok) throw new Error('Lockdown toggle failed');
      const data = await res.json();
      setGuildState(data.state);
      showToast(
        'success',
        nextAction === 'lockdown'
          ? 'Emergency server lockdown activated.'
          : 'Server lockdown lifted.'
      );
    } catch {
      showToast('error', 'Unable to update server lockdown state.');
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGuild) return;
    if (!targetUser.trim()) {
      showToast('error', 'Enter a target Discord username or channel.');
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/guilds/${encodeURIComponent(activeGuild.id)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          target: targetUser.trim(),
          targetId: targetId.trim() || undefined,
          duration: actionType === 'timeout' ? duration : undefined,
          reason: reason.trim() || 'Issued via SLAVE Moderation Desk',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }
      const data = await res.json();
      setGuildState(data.state);
      setTargetUser('');
      setTargetId('');
      setReason('');
      showToast('success', `${actionType.toUpperCase()} recorded for ${data.entry.target}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUpdateSettings = async (patch: Record<string, unknown>, label: string) => {
    if (!activeGuild) return;
    try {
      const res = await fetch(`/api/guilds/${encodeURIComponent(activeGuild.id)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Settings update failed');
      const updated = (await res.json()) as GuildModerationState;
      setGuildState(updated);
      showToast('success', `${label} saved.`);
    } catch {
      showToast('error', `Failed to save ${label.toLowerCase()}.`);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!guildState) return [];
    const q = logSearch.trim().toLowerCase();
    return guildState.logs.filter((log) => {
      const typeOk = logFilter === 'all' || log.action === logFilter;
      const queryOk =
        !q ||
        log.target.toLowerCase().includes(q) ||
        log.moderator.toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q);
      return typeOk && queryOk;
    });
  }, [guildState, logFilter, logSearch]);

  const handleExportCsv = () => {
    if (!filteredLogs.length || !activeGuild) return;
    const headers = ['Timestamp', 'Action', 'Target', 'Moderator', 'Reason', 'Duration', 'Status'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.action,
      `"${l.target.replace(/"/g, '""')}"`,
      `"${l.moderator.replace(/"/g, '""')}"`,
      `"${l.reason.replace(/"/g, '""')}"`,
      l.duration || '',
      l.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `slave-audit-${activeGuild.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyCallbackUrl = async () => {
    const uri = authStatus?.callbackUrl || `${window.location.origin}/auth/callback`;
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 1800);
    } catch {
      // Ignore
    }
  };

  // Unauthenticated View: Discord Login Gate
  if (!user) {
    const callbackUrl = authStatus?.callbackUrl || `${window.location.origin}/auth/callback`;

    return (
      <main className="mx-auto max-w-[1200px] px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl rounded-xl border border-white/[0.08] bg-[#0F111A] p-8 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#5865F2]/30 bg-[#5865F2]/10">
              <Shield className="h-5 w-5 text-[#5865F2]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                Moderator Authentication
              </h1>
              <p className="text-sm text-[#94A3B8]">
                Sign in with Discord to manage your servers and live logs.
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-[#94A3B8]">
            SLAVE uses Discord OAuth2 (<span className="font-mono text-xs text-[#E2E8F0]">identify guilds</span>) to verify which servers you own or moderate. Once authenticated, you gain direct access to real-time moderation status updates, anti-nuke policies, and case logs.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLoginClick}
              disabled={authLoading}
              className="rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:opacity-60"
            >
              {authLoading ? 'Connecting...' : 'Login with Discord'}
            </button>
            <a
              href={BOT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm font-medium text-[#E2E8F0] transition-colors hover:bg-white/[0.06]"
            >
              <span>Invite SLAVE to Server</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-7 border-t border-white/[0.08] pt-5">
            <p className="text-xs font-medium text-[#94A3B8]">
              Discord OAuth2 Redirect URI
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-[#07080D] px-3 py-2 font-mono text-xs text-[#E2E8F0]">
              <span className="truncate">{callbackUrl}</span>
              <button
                type="button"
                onClick={copyCallbackUrl}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white shrink-0"
              >
                {copiedUri ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedUri ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {authStatus && !authStatus.configured && (
            <div className="mt-5 rounded-lg border border-[#F59E0B]/30 bg-[#07080D] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F59E0B]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Discord OAuth Secret Required</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#94A3B8]">
                Set <span className="font-mono text-[#E2E8F0]">DISCORD_CLIENT_SECRET</span> in AI Studio Secrets and add the redirect URI above in the Discord Developer Portal under <span className="text-[#E2E8F0]">OAuth2 &rarr; Redirects</span>.
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Authenticated Workspace
  const activeGuardCount = guildState
    ? [
        guildState.antiNuke.antiBan,
        guildState.antiNuke.antiChannelDelete,
        guildState.antiNuke.antiRoleEscalation,
        guildState.antiNuke.antiWebhookSpam,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
      {/* Sidebar: 260px Server Selector & Workspace Nav */}
      <aside className="w-full shrink-0 border-b border-white/[0.08] bg-[#07080D] p-5 lg:min-h-[calc(100vh-73px)] lg:w-[270px] lg:border-r lg:border-b-0">
        <div>
          <p className="text-xs font-medium text-[#64748B]">Managed Servers</p>
          {guilds.length === 0 ? (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#0F111A] p-4 text-xs leading-relaxed text-[#94A3B8]">
              No Discord servers found where you hold Owner, Administrator, or Moderator permissions.
              <a
                href={BOT_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 font-medium text-[#5865F2] hover:underline"
              >
                <span>Add SLAVE to a server</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="mt-2.5 space-y-1.5">
              {guilds.map((g) => {
                const selected = g.id === selectedGuildId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGuildId(g.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-[#5865F2]/50 bg-[#0F111A] text-white'
                        : 'border-transparent text-[#94A3B8] hover:bg-white/[0.03] hover:text-white'
                    }`}
                  >
                    {g.iconUrl ? (
                      <img
                        src={g.iconUrl}
                        alt={g.name}
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161926] font-display text-xs font-semibold text-white shrink-0">
                        {g.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{g.name}</p>
                      <p className="truncate text-xs text-[#64748B]">{g.roleLabel}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-white/[0.08] pt-6">
          <p className="text-xs font-medium text-[#64748B]">Console Views</p>
          <div className="mt-2.5 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('desk')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'desk'
                  ? 'bg-[#5865F2] text-white'
                  : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Gavel className="h-4 w-4 shrink-0" />
              <span>Moderation Desk</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'security'
                  ? 'bg-[#5865F2] text-white'
                  : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Sliders className="h-4 w-4 shrink-0" />
              <span>Anti-Nuke &amp; Automod</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'bg-[#5865F2] text-white'
                  : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Audit Logs</span>
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.08] pt-6 space-y-2 text-xs text-[#94A3B8]">
          <a
            href={BOT_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-white/[0.08] px-3 py-2 hover:border-white/[0.18] hover:text-white"
          >
            <span>Add SLAVE to Server</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={SUPPORT_SERVER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-white/[0.08] px-3 py-2 hover:border-white/[0.18] hover:text-white"
          >
            <span>Support Server</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={DEVELOPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-white/[0.08] px-3 py-2 hover:border-white/[0.18] hover:text-white"
          >
            <span>Developer ({DEVELOPER_NAME})</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="min-w-0 flex-1 p-6 lg:p-8">
        {!activeGuild ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0F111A] p-10 text-center">
            <h2 className="font-display text-xl font-semibold text-white">No Server Selected</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Invite SLAVE to a Discord server where you hold moderation permissions to unlock controls.
            </p>
            <a
              href={BOT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4752C4]"
            >
              <span>Add SLAVE to Server</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <>
            {/* Top Contextual Breadcrumb & Lockdown Controls */}
            <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                  <span>{activeGuild.name}</span>
                  <span aria-hidden="true">/</span>
                  <span className="text-[#E2E8F0]">
                    {activeTab === 'desk'
                      ? 'Moderation Desk'
                      : activeTab === 'security'
                        ? 'Anti-Nuke & Automod'
                        : 'Audit Logs'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    {streamStatus === 'connected'
                      ? 'Stream Connected'
                      : streamStatus === 'connecting'
                        ? 'Connecting Stream...'
                        : 'Disconnected'}
                  </span>
                </div>
                <h1 className="mt-1.5 truncate font-display text-2xl font-bold tracking-tight text-white">
                  {activeGuild.name}
                </h1>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {guildState && (
                  <button
                    type="button"
                    onClick={handleToggleLockdown}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      guildState.lockdown
                        ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
                        : 'border border-white/[0.12] bg-[#0F111A] text-white hover:border-[#EF4444]/60 hover:text-[#FCA5A5]'
                    }`}
                  >
                    {guildState.lockdown ? (
                      <>
                        <Unlock className="h-4 w-4" />
                        <span>Lift Lockdown</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Emergency Lockdown</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {feedback && (
              <div
                role="status"
                className={`mt-5 rounded-lg border px-4 py-3 text-sm ${
                  feedback.type === 'success'
                    ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#A7F3D0]'
                    : 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#FCA5A5]'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {loadingState && !guildState ? (
              <div className="mt-6 space-y-4">
                <div className="h-24 animate-pulse rounded-xl border border-white/[0.08] bg-[#0F111A]" />
                <div className="h-64 animate-pulse rounded-xl border border-white/[0.08] bg-[#0F111A]" />
              </div>
            ) : guildState ? (
              <>
                {/* Tab 1: Moderation Desk */}
                {activeTab === 'desk' && (
                  <div className="mt-6 space-y-6">
                    {/* 4-Column Metric Strip */}
                    <div className="grid grid-cols-1 divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] bg-[#0F111A] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
                      <div className="p-5">
                        <p className="text-xs text-[#94A3B8]">Security Posture</p>
                        <p
                          className={`mt-1.5 font-display text-xl font-bold ${
                            guildState.securityPosture === 'Lockdown'
                              ? 'text-[#EF4444]'
                              : guildState.securityPosture === 'Elevated'
                                ? 'text-[#F59E0B]'
                                : 'text-[#10B981]'
                          }`}
                        >
                          {guildState.securityPosture}
                        </p>
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-[#94A3B8]">Active Anti-Nuke Guards</p>
                        <p className="mt-1.5 font-display text-xl font-bold text-white tabular-nums">
                          {activeGuardCount} / 4
                        </p>
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-[#94A3B8]">Logged Cases</p>
                        <p className="mt-1.5 font-display text-xl font-bold text-white tabular-nums">
                          {guildState.logs.length}
                        </p>
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-[#94A3B8]">Audit Log Channel</p>
                        <p className="mt-1.5 truncate font-mono text-base font-semibold text-white">
                          {guildState.logChannelName}
                        </p>
                      </div>
                    </div>

                    {/* Split: Action Form + Live Recent Cases */}
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                      <form
                        onSubmit={handleExecuteAction}
                        className="rounded-xl border border-white/[0.08] bg-[#0F111A] p-6 xl:col-span-5"
                      >
                        <h2 className="font-display text-lg font-semibold text-white">
                          Execute Moderation Action
                        </h2>
                        <p className="mt-1 text-xs text-[#94A3B8]">
                          Actions record immediately to the audit stream
                          {authStatus?.botTokenConfigured ? ' and dispatch via Discord REST API.' : '.'}
                        </p>

                        <div className="mt-5 space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-[#94A3B8]">
                              Action Type
                            </label>
                            <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-lg border border-white/[0.08] bg-[#07080D] p-1">
                              {(['timeout', 'kick', 'ban', 'quarantine', 'unban', 'purge'] as const).map(
                                (type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setActionType(type)}
                                    className={`rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                                      actionType === type
                                        ? 'bg-[#5865F2] text-white'
                                        : 'text-[#94A3B8] hover:text-white'
                                    }`}
                                  >
                                    {type}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor="target-user" className="block text-xs font-medium text-[#94A3B8]">
                                {actionType === 'purge' ? 'Target Channel' : 'Target Username'}
                              </label>
                              <input
                                id="target-user"
                                type="text"
                                required
                                value={targetUser}
                                onChange={(e) => setTargetUser(e.target.value)}
                                placeholder={actionType === 'purge' ? '#general' : '@username'}
                                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#5865F2] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label htmlFor="target-id" className="block text-xs font-medium text-[#94A3B8]">
                                Discord User ID (Optional)
                              </label>
                              <input
                                id="target-id"
                                type="text"
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                placeholder="18-digit Snowflake ID"
                                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 font-mono text-sm text-white placeholder-[#64748B] focus:border-[#5865F2] focus:outline-none"
                              />
                            </div>
                          </div>

                          {actionType === 'timeout' && (
                            <div>
                              <label htmlFor="timeout-duration" className="block text-xs font-medium text-[#94A3B8]">
                                Timeout Duration
                              </label>
                              <select
                                id="timeout-duration"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                              >
                                <option value="5m">5 minutes</option>
                                <option value="15m">15 minutes</option>
                                <option value="1h">1 hour</option>
                                <option value="24h">24 hours</option>
                                <option value="7d">7 days</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label htmlFor="action-reason" className="block text-xs font-medium text-[#94A3B8]">
                              Reason
                            </label>
                            <textarea
                              id="action-reason"
                              rows={3}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Rule violation or raid prevention details..."
                              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#5865F2] focus:outline-none"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submittingAction}
                            className="w-full rounded-lg bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:opacity-60"
                          >
                            {submittingAction ? 'Submitting...' : `Confirm ${actionType}`}
                          </button>
                        </div>
                      </form>

                      {/* Recent Audit Stream */}
                      <div className="rounded-xl border border-white/[0.08] bg-[#0F111A] xl:col-span-7">
                        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
                          <h2 className="font-display text-lg font-semibold text-white">
                            Recent Moderation Activity
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('logs')}
                            className="text-xs font-medium text-[#5865F2] hover:underline"
                          >
                            View all logs
                          </button>
                        </div>

                        <div className="divide-y divide-white/[0.06]">
                          {guildState.logs.slice(0, 7).map((log) => (
                            <div
                              key={log.id}
                              className="flex flex-col justify-between gap-2 px-6 py-3.5 sm:flex-row sm:items-center"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span
                                    className={`font-semibold uppercase ${
                                      log.action === 'ban' || log.action === 'lockdown'
                                        ? 'text-[#EF4444]'
                                        : log.action === 'timeout' || log.action === 'quarantine'
                                          ? 'text-[#F59E0B]'
                                          : 'text-[#10B981]'
                                    }`}
                                  >
                                    {log.action.replace('_', ' ')}
                                  </span>
                                  <span aria-hidden="true" className="text-[#64748B]">·</span>
                                  <span className="font-medium text-white">{log.target}</span>
                                  {log.duration && (
                                    <>
                                      <span aria-hidden="true" className="text-[#64748B]">·</span>
                                      <span className="font-mono text-[#94A3B8]">{log.duration}</span>
                                    </>
                                  )}
                                </div>
                                <p className="mt-1 truncate text-xs text-[#94A3B8]">
                                  {log.reason}
                                </p>
                              </div>

                              <div className="shrink-0 text-left sm:text-right">
                                <p className="text-xs text-[#E2E8F0]">{log.moderator}</p>
                                <p className="font-mono text-[11px] text-[#64748B] tabular-nums">
                                  {new Date(log.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Anti-Nuke & Automod */}
                {activeTab === 'security' && (
                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Anti-Nuke Policy Card */}
                    <section className="rounded-xl border border-white/[0.08] bg-[#0F111A] p-6">
                      <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                        <div className="flex items-center gap-2.5">
                          <ShieldAlert className="h-5 w-5 text-[#5865F2]" />
                          <h2 className="font-display text-lg font-semibold text-white">
                            Anti-Nuke Guards
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSettings(
                              {
                                antiNuke: {
                                  ...guildState.antiNuke,
                                  enabled: !guildState.antiNuke.enabled,
                                },
                              },
                              'Anti-Nuke Master Switch'
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            guildState.antiNuke.enabled
                              ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                              : 'bg-white/[0.06] text-[#94A3B8] border border-white/[0.08]'
                          }`}
                        >
                          {guildState.antiNuke.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <div className="mt-5 space-y-4">
                        {(
                          [
                            {
                              key: 'antiBan',
                              label: 'Anti-Mass Ban',
                              desc: 'Quarantine actors exceeding rapid member ban thresholds.',
                            },
                            {
                              key: 'antiChannelDelete',
                              label: 'Anti-Channel Deletion',
                              desc: 'Stop bulk deletion of text or voice channels.',
                            },
                            {
                              key: 'antiRoleEscalation',
                              label: 'Anti-Role Escalation',
                              desc: 'Block unauthorized grants of Administrator permissions.',
                            },
                            {
                              key: 'antiWebhookSpam',
                              label: 'Anti-Webhook Flood',
                              desc: 'Remove unverified webhooks created during raids.',
                            },
                          ] as const
                        ).map((item) => {
                          const enabled = guildState.antiNuke[item.key];
                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4 last:border-b-0 last:pb-0"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">{item.label}</p>
                                <p className="mt-0.5 text-xs text-[#94A3B8]">{item.desc}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                onClick={() =>
                                  handleUpdateSettings(
                                    {
                                      antiNuke: {
                                        ...guildState.antiNuke,
                                        [item.key]: !enabled,
                                      },
                                    },
                                    item.label
                                  )
                                }
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                  enabled ? 'bg-[#5865F2]' : 'bg-[#1E2233]'
                                }`}
                              >
                                <span
                                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                                    enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}

                        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-[#94A3B8]">
                              Trigger Threshold (actions/min)
                            </label>
                            <select
                              value={guildState.antiNuke.maxActionsPerMinute}
                              onChange={(e) =>
                                handleUpdateSettings(
                                  {
                                    antiNuke: {
                                      ...guildState.antiNuke,
                                      maxActionsPerMinute: Number(e.target.value),
                                    },
                                  },
                                  'Anti-Nuke Threshold'
                                )
                              }
                              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                            >
                              <option value={2}>2 actions / min</option>
                              <option value={3}>3 actions / min</option>
                              <option value={5}>5 actions / min</option>
                              <option value={8}>8 actions / min</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#94A3B8]">
                              Enforcement Action
                            </label>
                            <select
                              value={guildState.antiNuke.punishment}
                              onChange={(e) =>
                                handleUpdateSettings(
                                  {
                                    antiNuke: {
                                      ...guildState.antiNuke,
                                      punishment: e.target.value as 'quarantine' | 'kick' | 'ban',
                                    },
                                  },
                                  'Anti-Nuke Punishment'
                                )
                              }
                              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                            >
                              <option value="quarantine">Quarantine (Strip Roles)</option>
                              <option value="kick">Kick Account</option>
                              <option value="ban">Ban Account</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Automod & Bot Settings Card */}
                    <section className="rounded-xl border border-white/[0.08] bg-[#0F111A] p-6">
                      <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                        <div className="flex items-center gap-2.5">
                          <Shield className="h-5 w-5 text-[#5865F2]" />
                          <h2 className="font-display text-lg font-semibold text-white">
                            Automod Filters
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSettings(
                              {
                                automod: {
                                  ...guildState.automod,
                                  enabled: !guildState.automod.enabled,
                                },
                              },
                              'Automod Master Switch'
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            guildState.automod.enabled
                              ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                              : 'bg-white/[0.06] text-[#94A3B8] border border-white/[0.08]'
                          }`}
                        >
                          {guildState.automod.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <div className="mt-5 space-y-4">
                        {(
                          [
                            {
                              key: 'antiInvite',
                              label: 'Block External Discord Invites',
                              desc: 'Delete unauthorized discord.gg invite links automatically.',
                            },
                            {
                              key: 'antiMassMention',
                              label: 'Mass Mention Protection',
                              desc: 'Timeout users who exceed the per-message mention limit.',
                            },
                            {
                              key: 'antiSpam',
                              label: 'Burst Spam Filter',
                              desc: 'Suppress repeated duplicate messages in short intervals.',
                            },
                            {
                              key: 'toxicityFilter',
                              label: 'Keyword & Toxicity Filter',
                              desc: 'Block slurs and flagged phrases across public channels.',
                            },
                          ] as const
                        ).map((item) => {
                          const enabled = guildState.automod[item.key];
                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4 last:border-b-0 last:pb-0"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">{item.label}</p>
                                <p className="mt-0.5 text-xs text-[#94A3B8]">{item.desc}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                onClick={() =>
                                  handleUpdateSettings(
                                    {
                                      automod: {
                                        ...guildState.automod,
                                        [item.key]: !enabled,
                                      },
                                    },
                                    item.label
                                  )
                                }
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                  enabled ? 'bg-[#5865F2]' : 'bg-[#1E2233]'
                                }`}
                              >
                                <span
                                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                                    enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}

                        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-[#94A3B8]">
                              Mention Limit per Message
                            </label>
                            <select
                              value={guildState.automod.mentionLimit}
                              onChange={(e) =>
                                handleUpdateSettings(
                                  {
                                    automod: {
                                      ...guildState.automod,
                                      mentionLimit: Number(e.target.value),
                                    },
                                  },
                                  'Mention Limit'
                                )
                              }
                              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                            >
                              <option value={3}>3 mentions</option>
                              <option value={5}>5 mentions</option>
                              <option value={8}>8 mentions</option>
                              <option value={12}>12 mentions</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#94A3B8]">
                              Auto-Timeout Duration
                            </label>
                            <select
                              value={guildState.automod.autoTimeoutMinutes}
                              onChange={(e) =>
                                handleUpdateSettings(
                                  {
                                    automod: {
                                      ...guildState.automod,
                                      autoTimeoutMinutes: Number(e.target.value),
                                    },
                                  },
                                  'Auto-Timeout Duration'
                                )
                              }
                              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                            >
                              <option value={5}>5 minutes</option>
                              <option value={15}>15 minutes</option>
                              <option value={30}>30 minutes</option>
                              <option value={60}>60 minutes</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* Tab 3: Full Audit Logs */}
                {activeTab === 'logs' && (
                  <div className="mt-6 space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0F111A] p-1">
                        {(
                          ['all', 'ban', 'kick', 'timeout', 'quarantine', 'lockdown', 'policy_update'] as const
                        ).map((filterKey) => (
                          <button
                            key={filterKey}
                            type="button"
                            onClick={() => setLogFilter(filterKey)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                              logFilter === filterKey
                                ? 'bg-[#5865F2] text-white'
                                : 'text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            {filterKey.replace('_', ' ')}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:flex-initial">
                          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          <input
                            type="search"
                            value={logSearch}
                            onChange={(e) => setLogSearch(e.target.value)}
                            placeholder="Search target, moderator..."
                            className="w-full rounded-lg border border-white/[0.08] bg-[#0F111A] py-2 pr-3 pl-9 text-sm text-white placeholder-[#64748B] focus:border-[#5865F2] focus:outline-none sm:w-56"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          disabled={filteredLogs.length === 0}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#0F111A] px-3.5 py-2 text-xs font-medium text-[#E2E8F0] transition-colors hover:bg-white/[0.06] disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download CSV</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0F111A]">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.08] bg-[#0B0D14] text-xs font-medium text-[#94A3B8]">
                            <th className="px-5 py-3">Timestamp</th>
                            <th className="px-5 py-3">Action</th>
                            <th className="px-5 py-3">Target</th>
                            <th className="px-5 py-3">Moderator</th>
                            <th className="px-5 py-3">Reason</th>
                            <th className="px-5 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {filteredLogs.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#94A3B8]">
                                No audit logs match the selected filters.
                              </td>
                            </tr>
                          ) : (
                            filteredLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-white/[0.02]">
                                <td className="px-5 py-3 font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString([], {
                                    month: 'short',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </td>
                                <td className="px-5 py-3 text-xs font-semibold uppercase whitespace-nowrap">
                                  <span
                                    className={
                                      log.action === 'ban' || log.action === 'lockdown'
                                        ? 'text-[#EF4444]'
                                        : log.action === 'timeout' || log.action === 'quarantine'
                                          ? 'text-[#F59E0B]'
                                          : 'text-[#10B981]'
                                    }
                                  >
                                    {log.action.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-5 py-3 font-medium text-white">
                                  {log.target}
                                  {log.duration && (
                                    <span className="ml-2 font-mono text-xs text-[#94A3B8]">
                                      ({log.duration})
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-xs text-[#E2E8F0]">{log.moderator}</td>
                                <td className="max-w-xs truncate px-5 py-3 text-xs text-[#94A3B8]">
                                  {log.reason}
                                </td>
                                <td className="px-5 py-3 text-right text-xs font-medium text-[#E2E8F0] whitespace-nowrap">
                                  {log.status}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
