import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { AuthStatusResponse } from '../types';

interface OAuthSetupModalProps {
  open: boolean;
  onClose: () => void;
  authStatus: AuthStatusResponse | null;
}

export function OAuthSetupModal({ open, onClose, authStatus }: OAuthSetupModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const callbackUrl = authStatus?.callbackUrl || `${window.location.origin}/auth/callback`;
  const clientId = authStatus?.clientId || '1552295211164508271';

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#0F111A] p-6 text-[#F8FAFC] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="oauth-setup-title" className="font-display text-lg font-semibold text-white">
              Complete Discord OAuth Setup
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Add your Discord application Client Secret in AI Studio Secrets to enable live Discord login.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium text-[#94A3B8]">1. Discord Application Client ID</p>
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 font-mono text-xs text-[#E2E8F0]">
              <span className="truncate">{clientId}</span>
              <button
                type="button"
                onClick={() => copyValue('clientId', clientId)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white shrink-0"
              >
                {copiedKey === 'clientId' ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'clientId' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#94A3B8]">
              2. Register Redirect URI in Discord Developer Portal
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#07080D] px-3 py-2 font-mono text-xs text-[#E2E8F0]">
              <span className="truncate">{callbackUrl}</span>
              <button
                type="button"
                onClick={() => copyValue('callbackUrl', callbackUrl)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white shrink-0"
              >
                {copiedKey === 'callbackUrl' ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'callbackUrl' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#07080D] p-3.5 text-xs leading-relaxed text-[#94A3B8]">
            Set <span className="font-mono text-[#E2E8F0]">DISCORD_CLIENT_SECRET</span> in the AI Studio Secrets panel, then restart or refresh and click <span className="text-white">Login with Discord</span>.
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <a
            href={`https://discord.com/developers/applications/${clientId}/oauth2`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3.5 py-2 text-sm font-medium text-[#E2E8F0] transition-colors hover:bg-white/[0.06]"
          >
            <span>Discord Portal</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752C4]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
