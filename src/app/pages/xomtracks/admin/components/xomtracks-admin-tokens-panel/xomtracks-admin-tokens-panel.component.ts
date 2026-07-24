import { Component, OnInit } from '@angular/core';
import { XomtracksAdminService } from '../../../services/xomtracks-admin.service';
import { XtAdminToken } from '../../../models/xomtracks-admin.model';

type XtaLoadState = 'loading' | 'loaded' | 'error';

interface XtaOwnerGroup {
  owner: string;
  tokens: XtAdminToken[];
}

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
        this.groups = Object.entries(res.byOwner ?? {})
          .map(([owner, tokens]) => ({ owner, tokens }))
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

  trackByOwner(_index: number, group: XtaOwnerGroup): string {
    return group.owner;
  }

  trackByHash(_index: number, token: XtAdminToken): string {
    return token.tokenHash;
  }
}
