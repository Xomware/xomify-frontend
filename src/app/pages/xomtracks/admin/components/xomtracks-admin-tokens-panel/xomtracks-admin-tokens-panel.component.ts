import { Component, OnInit } from '@angular/core';
import { XomtracksAdminService } from '../../../services/xomtracks-admin.service';
import { XtAdminToken } from '../../../models/xomtracks-admin.model';

type XtaLoadState = 'loading' | 'loaded' | 'error';

interface XtaOwnerGroup {
  owner: string;
  tokens: XtAdminToken[];
  /** Spotify-connected in xomtracks → the rolling cron builds their own
   * playlists. False → they ingest shares but get no own playlists. */
  connected: boolean;
}

/** A device is "stale" if its extractor hasn't scanned in this long — a hint
 * that the owner's Mac has been off/asleep. */
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Admin Portal — "Tokens" tab. `GET /admin/tokens`: every extractor ingest
 * token's METADATA (never plaintext — the table only ever holds irreversible
 * hashes), grouped by owner. Each row can be revoked via the admin override
 * `POST /admin/revoke-token`, which cuts that extractor off immediately
 * regardless of who owns it. Revoking is confirmed first (destructive,
 * cannot be undone) and updates the row in place on success.
 */
@Component({
  selector: 'app-xomtracks-admin-tokens-panel',
  templateUrl: './xomtracks-admin-tokens-panel.component.html',
  styleUrls: ['./xomtracks-admin-tokens-panel.component.scss'],
})
export class XomtracksAdminTokensPanelComponent implements OnInit {
  state: XtaLoadState = 'loading';
  groups: XtaOwnerGroup[] = [];
  count = 0;

  /** tokenHash currently mid-revoke, so its button can show a busy state and
   * disable double-clicks. */
  revokingHash: string | null = null;
  errorMessage = '';

  constructor(private admin: XomtracksAdminService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.errorMessage = '';
    this.admin.listTokens().subscribe({
      next: (res) => {
        const connected = new Set(res.spotifyConnectedOwners ?? []);
        this.groups = Object.entries(res.byOwner ?? {})
          .map(([owner, tokens]) => ({ owner, tokens, connected: connected.has(owner) }))
          .sort((a, b) => a.owner.localeCompare(b.owner));
        this.count = res.count ?? 0;
        this.state = 'loaded';
      },
      error: () => {
        this.groups = [];
        this.count = 0;
        this.state = 'error';
      },
    });
  }

  retry(): void {
    this.load();
  }

  revoke(token: XtAdminToken): void {
    if (token.revoked || this.revokingHash) return;
    const confirmed = window.confirm(
      `Revoke ${token.label || 'this token'} for ${token.ownerEmail}? This cannot be undone — their extractor will stop working immediately.`,
    );
    if (!confirmed) return;

    this.revokingHash = token.tokenHash;
    this.errorMessage = '';
    this.admin.revokeToken(token.tokenHash).subscribe({
      next: () => {
        token.revoked = true;
        this.revokingHash = null;
      },
      error: () => {
        this.errorMessage = "Couldn't revoke that token — try again in a moment.";
        this.revokingHash = null;
      },
    });
  }

  humanDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '—';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Relative "last scan" for a device, or "never" when it hasn't pushed yet. */
  lastScan(token: XtAdminToken): string {
    const iso = token.lastUsedAt;
    if (!iso) return 'never';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return 'never';
    const secs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (secs < 90) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /** True when an active device hasn't scanned within STALE_AFTER_MS — its
   * Mac has likely been off/asleep. Revoked devices are never flagged. */
  isStale(token: XtAdminToken): boolean {
    if (token.revoked) return false;
    if (!token.lastUsedAt) return true;
    const ms = Date.parse(token.lastUsedAt);
    if (Number.isNaN(ms)) return true;
    return Date.now() - ms > STALE_AFTER_MS;
  }

  trackByOwner(_index: number, group: XtaOwnerGroup): string {
    return group.owner;
  }

  trackByHash(_index: number, token: XtAdminToken): string {
    return token.tokenHash;
  }
}
