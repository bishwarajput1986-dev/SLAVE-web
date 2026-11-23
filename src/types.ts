export interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  discriminator: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  roleLabel: 'Owner' | 'Administrator' | 'Moderator';
}

export interface AuthStatusResponse {
  configured: boolean;
  clientId: string;
  callbackUrl: string;
  inviteUrl: string;
  supportUrl: string;
  botTokenConfigured: boolean;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user?: DiscordUser;
  guilds?: DiscordGuild[];
}

export interface AntiNukeSettings {
  enabled: boolean;
  antiBan: boolean;
  antiChannelDelete: boolean;
  antiRoleEscalation: boolean;
  antiWebhookSpam: boolean;
  maxActionsPerMinute: number;
  punishment: 'quarantine' | 'kick' | 'ban';
}

export interface AutomodSettings {
  enabled: boolean;
  antiInvite: boolean;
  antiMassMention: boolean;
  antiSpam: boolean;
  toxicityFilter: boolean;
  mentionLimit: number;
  spamThresholdMessages: number;
  autoTimeoutMinutes: number;
}

export interface GuildModerationState {
  guildId: string;
  lockdown: boolean;
  lockdownReason: string;
  securityPosture: 'Nominal' | 'Elevated' | 'Lockdown';
  antiNuke: AntiNukeSettings;
  automod: AutomodSettings;
  logChannelName: string;
  prefix: string;
  updatedAt: string;
  updatedBy: string;
  logs: ModerationLogEntry[];
}

export type ModerationActionType =
  | 'ban'
  | 'kick'
  | 'timeout'
  | 'quarantine'
  | 'unban'
  | 'lockdown'
  | 'unlock'
  | 'purge'
  | 'policy_update';

export interface ModerationLogEntry {
  id: string;
  guildId: string;
  action: ModerationActionType;
  target: string;
  targetId?: string;
  moderator: string;
  moderatorId: string;
  reason: string;
  duration?: string;
  status: 'Enforced' | 'Logged' | 'Failed';
  timestamp: string;
  discordSynced?: boolean;
}

export interface BotCommand {
  name: string;
  category: 'Moderation' | 'Anti-Nuke' | 'Automod' | 'Utility';
  syntax: string;
  description: string;
  permission: string;
}
