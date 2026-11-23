import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1552295211164508271';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`slave-session-${DISCORD_CLIENT_ID}`).digest('hex');

const BOT_INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}`;
const SUPPORT_SERVER_URL = 'https://discord.gg/WxRCrsPaKr';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'slave-store.json');

interface StoredUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  discriminator: string;
}

interface StoredGuild {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  roleLabel: 'Owner' | 'Administrator' | 'Moderator';
}

interface SessionRecord {
  id: string;
  user: StoredUser;
  guilds: StoredGuild[];
  createdAt: number;
  expiresAt: number;
}

interface GuildModerationRecord {
  guildId: string;
  lockdown: boolean;
  lockdownReason: string;
  securityPosture: 'Nominal' | 'Elevated' | 'Lockdown';
  antiNuke: {
    enabled: boolean;
    antiBan: boolean;
    antiChannelDelete: boolean;
    antiRoleEscalation: boolean;
    antiWebhookSpam: boolean;
    maxActionsPerMinute: number;
    punishment: 'quarantine' | 'kick' | 'ban';
  };
  automod: {
    enabled: boolean;
    antiInvite: boolean;
    antiMassMention: boolean;
    antiSpam: boolean;
    toxicityFilter: boolean;
    mentionLimit: number;
    spamThresholdMessages: number;
    autoTimeoutMinutes: number;
  };
  logChannelName: string;
  prefix: string;
  updatedAt: string;
  updatedBy: string;
  logs: Array<{
    id: string;
    guildId: string;
    action: string;
    target: string;
    targetId?: string;
    moderator: string;
    moderatorId: string;
    reason: string;
    duration?: string;
    status: 'Enforced' | 'Logged' | 'Failed';
    timestamp: string;
    discordSynced?: boolean;
  }>;
}

interface StoreSchema {
  sessions: Record<string, SessionRecord>;
  guilds: Record<string, GuildModerationRecord>;
}

function loadStore(): StoreSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as StoreSchema;
      return {
        sessions: parsed.sessions || {},
        guilds: parsed.guilds || {},
      };
    }
  } catch (err) {
    console.error('Failed to load persistent store:', err);
  }
  return { sessions: {}, guilds: {} };
}

function saveStore(store: StoreSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save persistent store:', err);
  }
}

const store: StoreSchema = loadStore();
const sseClients = new Map<string, Set<Response>>();

function broadcastGuildUpdate(guildId: string, state: GuildModerationRecord): void {
  const clients = sseClients.get(guildId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify({ type: 'GUILD_STATE_UPDATE', state })}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function getAppUrl(): string {
  const raw = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  return `http://localhost:${PORT}`;
}

function getCallbackUrl(): string {
  const override = (process.env.DISCORD_REDIRECT_URI || '').trim();
  if (override && /^https?:\/\//i.test(override)) {
    return override;
  }
  return `${getAppUrl()}/auth/callback`;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function signToken(value: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
  return `${value}.${sig}`;
}

function verifyToken(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf('.');
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

function getSessionFromRequest(req: Request): SessionRecord | null {
  const cookies = parseCookies(req);
  const sessionId = verifyToken(cookies['slave_session']);
  if (!sessionId) return null;
  const session = store.sessions[sessionId];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete store.sessions[sessionId];
    saveStore(store);
    return null;
  }
  return session;
}

function getOrCreateGuildState(guildId: string, actorName = 'System'): GuildModerationRecord {
  if (store.guilds[guildId]) {
    return store.guilds[guildId];
  }
  const now = new Date().toISOString();
  const initial: GuildModerationRecord = {
    guildId,
    lockdown: false,
    lockdownReason: '',
    securityPosture: 'Nominal',
    antiNuke: {
      enabled: true,
      antiBan: true,
      antiChannelDelete: true,
      antiRoleEscalation: true,
      antiWebhookSpam: true,
      maxActionsPerMinute: 3,
      punishment: 'quarantine',
    },
    automod: {
      enabled: true,
      antiInvite: true,
      antiMassMention: true,
      antiSpam: true,
      toxicityFilter: true,
      mentionLimit: 5,
      spamThresholdMessages: 7,
      autoTimeoutMinutes: 15,
    },
    logChannelName: '#slave-audit-logs',
    prefix: ',',
    updatedAt: now,
    updatedBy: actorName,
    logs: [
      {
        id: crypto.randomUUID(),
        guildId,
        action: 'policy_update',
        target: 'Anti-Nuke & Automod Baseline',
        moderator: actorName,
        moderatorId: 'system',
        reason: 'Initialized default SLAVE security policy for guild workspace.',
        status: 'Logged',
        timestamp: now,
        discordSynced: false,
      },
    ],
  };
  store.guilds[guildId] = initial;
  saveStore(store);
  return initial;
}

interface AuthenticatedRequest extends Request {
  session?: SessionRecord;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Discord authentication required.' });
    return;
  }
  req.session = session;
  next();
}

function ensureGuildAccess(req: AuthenticatedRequest, res: Response): StoredGuild | null {
  const guildId = String(req.params.guildId || '');
  const guild = req.session?.guilds.find((g) => g.id === guildId);
  if (!guild) {
    res.status(403).json({ error: 'You do not have moderation permissions for this server.' });
    return null;
  }
  return guild;
}

function deriveRoleLabel(guild: { owner?: boolean; permissions?: string }): 'Owner' | 'Administrator' | 'Moderator' | null {
  if (guild.owner) return 'Owner';
  const perms = BigInt(guild.permissions || '0');
  const ADMINISTRATOR = 0x8n;
  const MANAGE_GUILD = 0x20n;
  const MODERATE_MEMBERS = 0x10000000000n;
  const BAN_MEMBERS = 0x4n;
  const KICK_MEMBERS = 0x2n;
  if ((perms & ADMINISTRATOR) !== 0n) return 'Administrator';
  if (
    (perms & MANAGE_GUILD) !== 0n ||
    (perms & MODERATE_MEMBERS) !== 0n ||
    (perms & BAN_MEMBERS) !== 0n ||
    (perms & KICK_MEMBERS) !== 0n
  ) {
    return 'Moderator';
  }
  return null;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  // OAuth status & configuration details
  app.get('/api/auth/discord/status', (_req: Request, res: Response) => {
    res.json({
      configured: Boolean(DISCORD_CLIENT_SECRET),
      clientId: DISCORD_CLIENT_ID,
      callbackUrl: getCallbackUrl(),
      inviteUrl: BOT_INVITE_URL,
      supportUrl: SUPPORT_SERVER_URL,
      botTokenConfigured: Boolean(DISCORD_BOT_TOKEN),
    });
  });

  // Construct Discord OAuth authorization URL
  app.get('/api/auth/discord/url', (_req: Request, res: Response) => {
    if (!DISCORD_CLIENT_SECRET) {
      res.status(400).json({
        error: 'DISCORD_CLIENT_SECRET_MISSING',
        message: 'Discord OAuth Client Secret is not configured in environment secrets.',
        callbackUrl: getCallbackUrl(),
        clientId: DISCORD_CLIENT_ID,
      });
      return;
    }

    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('slave_oauth_state', signToken(state), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: getCallbackUrl(),
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent',
    });

    res.json({ url: `https://discord.com/api/oauth2/authorize?${params.toString()}` });
  });

  // OAuth callback handler (handles both /auth/callback and /auth/callback/)
  const callbackHandler = async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      res.status(400).send(`
        <!doctype html>
        <html>
          <body style="background:#07080D;color:#F8FAFC;font-family:sans-serif;padding:32px;">
            <h2>Discord Authorization Cancelled</h2>
            <p>${String(error_description || error)}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(String(error_description || error))} }, '*');
                setTimeout(() => window.close(), 1200);
              }
            </script>
          </body>
        </html>
      `);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).send('Missing authorization code from Discord.');
      return;
    }

    const cookies = parseCookies(req);
    const verifiedState = verifyToken(cookies['slave_oauth_state']);
    if (!verifiedState || verifiedState !== state) {
      res.status(400).send('Invalid OAuth state parameter. Please retry signing in.');
      return;
    }

    if (!DISCORD_CLIENT_SECRET) {
      res.status(500).send('DISCORD_CLIENT_SECRET is not configured on the server.');
      return;
    }

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: getCallbackUrl(),
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        console.error('Discord token exchange failed:', text);
        res.status(502).send('Failed to exchange Discord authorization code.');
        return;
      }

      const tokenData = (await tokenRes.json()) as { access_token: string };

      const [userRes, guildsRes] = await Promise.all([
        fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }),
        fetch('https://discord.com/api/users/@me/guilds', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }),
      ]);

      if (!userRes.ok || !guildsRes.ok) {
        res.status(502).send('Failed to fetch Discord user profile or guilds.');
        return;
      }

      const rawUser = (await userRes.json()) as {
        id: string;
        username: string;
        global_name: string | null;
        avatar: string | null;
        discriminator: string;
      };

      const rawGuilds = (await guildsRes.json()) as Array<{
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
      }>;

      const user: StoredUser = {
        id: rawUser.id,
        username: rawUser.username,
        globalName: rawUser.global_name,
        avatarUrl: rawUser.avatar
          ? `https://cdn.discordapp.com/avatars/${rawUser.id}/${rawUser.avatar}.png?size=128`
          : null,
        discriminator: rawUser.discriminator,
      };

      const manageableGuilds: StoredGuild[] = [];
      for (const g of rawGuilds) {
        const roleLabel = deriveRoleLabel(g);
        if (!roleLabel) continue;
        manageableGuilds.push({
          id: g.id,
          name: g.name,
          iconUrl: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
            : null,
          owner: g.owner,
          permissions: g.permissions,
          roleLabel,
        });
      }

      const sessionId = crypto.randomUUID();
      store.sessions[sessionId] = {
        id: sessionId,
        user,
        guilds: manageableGuilds,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      saveStore(store);

      res.clearCookie('slave_oauth_state', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });

      res.cookie('slave_session', signToken(sessionId), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.send(`
        <!doctype html>
        <html>
          <body style="background:#07080D;color:#F8FAFC;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;">
              <p style="font-size:15px;">Discord authentication complete. Returning to SLAVE Dashboard...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.status(500).send('Internal OAuth error.');
    }
  };

  app.get(['/auth/callback', '/auth/callback/', '/oauth2/callback', '/oauth2/callback/'], callbackHandler);

  // Current authenticated user + guilds
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      user: session.user,
      guilds: session.guilds,
    });
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const cookies = parseCookies(req);
    const sessionId = verifyToken(cookies['slave_session']);
    if (sessionId && store.sessions[sessionId]) {
      delete store.sessions[sessionId];
      saveStore(store);
    }
    res.clearCookie('slave_session', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.json({ ok: true });
  });

  // Get guild moderation state & logs
  app.get('/api/guilds/:guildId/state', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const guild = ensureGuildAccess(req, res);
    if (!guild || !req.session) return;
    const state = getOrCreateGuildState(guild.id, req.session.user.username);
    res.json(state);
  });

  // Update moderation / anti-nuke / automod settings
  app.patch('/api/guilds/:guildId/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const guild = ensureGuildAccess(req, res);
    if (!guild || !req.session) return;
    const state = getOrCreateGuildState(guild.id, req.session.user.username);
    const body = req.body as Partial<GuildModerationRecord>;
    const actor = req.session.user.globalName || req.session.user.username;
    const now = new Date().toISOString();

    if (body.antiNuke) {
      state.antiNuke = { ...state.antiNuke, ...body.antiNuke };
    }
    if (body.automod) {
      state.automod = { ...state.automod, ...body.automod };
    }
    if (typeof body.logChannelName === 'string' && body.logChannelName.trim()) {
      state.logChannelName = body.logChannelName.trim().slice(0, 64);
    }
    if (typeof body.prefix === 'string' && body.prefix.trim()) {
      state.prefix = body.prefix.trim().slice(0, 5);
    }

    state.securityPosture = state.lockdown
      ? 'Lockdown'
      : state.antiNuke.enabled && state.automod.enabled
        ? 'Nominal'
        : 'Elevated';
    state.updatedAt = now;
    state.updatedBy = actor;

    state.logs.unshift({
      id: crypto.randomUUID(),
      guildId: guild.id,
      action: 'policy_update',
      target: 'Moderation & Security Policy',
      moderator: actor,
      moderatorId: req.session.user.id,
      reason: `Updated security modules (Anti-Nuke: ${state.antiNuke.enabled ? 'On' : 'Off'}, Automod: ${state.automod.enabled ? 'On' : 'Off'}).`,
      status: 'Enforced',
      timestamp: now,
      discordSynced: Boolean(DISCORD_BOT_TOKEN),
    });
    state.logs = state.logs.slice(0, 150);

    saveStore(store);
    broadcastGuildUpdate(guild.id, state);
    res.json(state);
  });

  // Execute moderation action (ban, kick, timeout, quarantine, lockdown, unlock, purge)
  app.post('/api/guilds/:guildId/actions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const guild = ensureGuildAccess(req, res);
    if (!guild || !req.session) return;
    const state = getOrCreateGuildState(guild.id, req.session.user.username);

    const { action, target, targetId, reason, duration } = req.body as {
      action?: string;
      target?: string;
      targetId?: string;
      reason?: string;
      duration?: string;
    };

    const allowedActions = ['ban', 'kick', 'timeout', 'quarantine', 'unban', 'lockdown', 'unlock', 'purge'];
    if (!action || !allowedActions.includes(action)) {
      res.status(400).json({ error: 'Invalid moderation action.' });
      return;
    }

    const cleanTarget = (target || '').trim();
    if (!cleanTarget && action !== 'lockdown' && action !== 'unlock') {
      res.status(400).json({ error: 'Target user or channel is required.' });
      return;
    }

    const cleanReason = (reason || 'No reason provided').trim().slice(0, 240);
    const actor = req.session.user.globalName || req.session.user.username;
    const now = new Date().toISOString();

    if (action === 'lockdown') {
      state.lockdown = true;
      state.lockdownReason = cleanReason;
      state.securityPosture = 'Lockdown';
    } else if (action === 'unlock') {
      state.lockdown = false;
      state.lockdownReason = '';
      state.securityPosture =
        state.antiNuke.enabled && state.automod.enabled ? 'Nominal' : 'Elevated';
    }

    let discordSynced = false;
    let status: 'Enforced' | 'Logged' | 'Failed' = 'Enforced';

    // If a bot token and numeric Discord user ID are provided, forward live enforcement to Discord REST API
    if (DISCORD_BOT_TOKEN && targetId && /^\d{17,20}$/.test(targetId)) {
      try {
        if (action === 'ban') {
          const r = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/bans/${targetId}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Audit-Log-Reason': encodeURIComponent(`[SLAVE] ${actor}: ${cleanReason}`),
            },
            body: JSON.stringify({ delete_message_seconds: 0 }),
          });
          discordSynced = r.ok;
          if (!r.ok) status = 'Failed';
        } else if (action === 'kick') {
          const r = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/members/${targetId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              'X-Audit-Log-Reason': encodeURIComponent(`[SLAVE] ${actor}: ${cleanReason}`),
            },
          });
          discordSynced = r.ok;
          if (!r.ok) status = 'Failed';
        } else if (action === 'unban') {
          const r = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/bans/${targetId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              'X-Audit-Log-Reason': encodeURIComponent(`[SLAVE] ${actor}: ${cleanReason}`),
            },
          });
          discordSynced = r.ok;
          if (!r.ok) status = 'Failed';
        } else if (action === 'timeout') {
          const durationMsMap: Record<string, number> = {
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
          };
          const ms = durationMsMap[duration || '15m'] || 15 * 60 * 1000;
          const until = new Date(Date.now() + ms).toISOString();
          const r = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/members/${targetId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Audit-Log-Reason': encodeURIComponent(`[SLAVE] ${actor}: ${cleanReason}`),
            },
            body: JSON.stringify({ communication_disabled_until: until }),
          });
          discordSynced = r.ok;
          if (!r.ok) status = 'Failed';
        }
      } catch (err) {
        console.error('Discord REST action error:', err);
      }
    }

    const entry = {
      id: crypto.randomUUID(),
      guildId: guild.id,
      action,
      target: cleanTarget || (action === 'lockdown' ? 'All Public Channels' : 'Server Lockdown Lifted'),
      targetId: targetId?.trim() || undefined,
      moderator: actor,
      moderatorId: req.session.user.id,
      reason: cleanReason,
      duration: duration?.trim() || undefined,
      status,
      timestamp: now,
      discordSynced,
    };

    state.updatedAt = now;
    state.updatedBy = actor;
    state.logs.unshift(entry);
    state.logs = state.logs.slice(0, 150);

    saveStore(store);
    broadcastGuildUpdate(guild.id, state);
    res.json({ entry, state });
  });

  // Real-time Server-Sent Events stream for moderation status & logs
  app.get('/api/guilds/:guildId/stream', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const guild = ensureGuildAccess(req, res);
    if (!guild || !req.session) return;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const state = getOrCreateGuildState(guild.id, req.session.user.username);
    res.write(`data: ${JSON.stringify({ type: 'GUILD_STATE_UPDATE', state })}\n\n`);

    if (!sseClients.has(guild.id)) {
      sseClients.set(guild.id, new Set());
    }
    sseClients.get(guild.id)!.add(res);

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get(guild.id)?.delete(res);
    });
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SLAVE server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
