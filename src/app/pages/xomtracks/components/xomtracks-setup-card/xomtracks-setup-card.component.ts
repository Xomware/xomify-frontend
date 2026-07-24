import { Component, OnInit } from '@angular/core';
import {
  XomtracksIngestTokensService,
} from '../../services/xomtracks-ingest-tokens.service';

type XtSetupState = 'idle' | 'minting' | 'minted' | 'error';

const STORAGE_KEY_TOKEN_HASH = 'xt.ingest.tokenHash';
const STORAGE_KEY_LABEL = 'xt.ingest.label';

/**
 * "Set up your own" onboarding card — mints a per-user extractor ingest
 * token (`POST /ingest-tokens/create`), shows the returned PLAINTEXT token
 * exactly once (it's never recoverable after this response —
 * xomtracks-backend/lambdas/ingesttokens_create/handler.py), plus the
 * Keychain store command and a short explainer.
 *
 * The `install.sh` guided installer (curl | bash + Full Disk Access
 * walkthrough) is a later workstream (WS4) — this card surfaces the token
 * + the manual two-step setup documented in
 * `xomtracks-backend/extractor/README.md` today.
 *
 * The token hash (non-secret) is cached in localStorage so a revoke button
 * can appear on return visits — there is no `GET` list endpoint yet, so this
 * is the only way the UI can know "you already have one" after a refresh.
 */
@Component({
  selector: 'app-xomtracks-setup-card',
  templateUrl: './xomtracks-setup-card.component.html',
  styleUrls: ['./xomtracks-setup-card.component.scss'],
})
export class XomtracksSetupCardComponent implements OnInit {
  state: XtSetupState = 'idle';
  label = '';
  plaintextToken: string | null = null;
  existingTokenHash: string | null = null;
  existingLabel: string | null = null;
  errorMessage = '';
  copied = false;

  constructor(private ingestTokens: XomtracksIngestTokensService) {}

  ngOnInit(): void {
    this.restoreExisting();
  }

  get keychainCommand(): string {
    const token = this.plaintextToken ?? '<TOKEN>';
    return (
      'security add-generic-password ' +
      '-s "xomtracks-ingest" ' +
      '-a "$USER" ' +
      '-T /usr/bin/security ' +
      '-U ' +
      `-w "${token}"`
    );
  }

  mint(): void {
    if (this.state === 'minting') return;
    this.state = 'minting';
    this.errorMessage = '';

    this.ingestTokens.create(this.label || undefined).subscribe({
      next: (minted) => {
        this.plaintextToken = minted.token;
        this.state = 'minted';
        this.copied = false;
        this.persistExisting(minted.tokenHash, minted.label);
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = "Couldn't mint a token — try again in a moment.";
      },
    });
  }

  revoke(): void {
    if (!this.existingTokenHash) return;
    const hash = this.existingTokenHash;
    this.ingestTokens.revoke(hash).subscribe({
      next: () => this.clearExisting(),
      error: () => {
        this.errorMessage = "Couldn't revoke that token — try again in a moment.";
      },
    });
  }

  async copyToken(): Promise<void> {
    if (!this.plaintextToken) return;
    try {
      await navigator.clipboard.writeText(this.plaintextToken);
      this.copied = true;
    } catch {
      // Clipboard API can be unavailable (permissions, non-secure context) —
      // the token stays selectable in the <code> block either way.
      this.copied = false;
    }
  }

  async copyKeychainCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.keychainCommand);
    } catch {
      // Non-fatal — the command stays selectable.
    }
  }

  dismissMinted(): void {
    // The plaintext is gone forever once we drop it from memory — that's
    // the point (never recoverable after this one response).
    this.plaintextToken = null;
    this.state = 'idle';
    this.label = '';
  }

  private restoreExisting(): void {
    try {
      this.existingTokenHash = localStorage.getItem(STORAGE_KEY_TOKEN_HASH);
      this.existingLabel = localStorage.getItem(STORAGE_KEY_LABEL);
    } catch {
      // localStorage can throw in private-mode browsers — degrade to "no
      // known token", which just re-shows the mint button.
    }
  }

  private persistExisting(tokenHash: string, label: string | null): void {
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN_HASH, tokenHash);
      if (label) localStorage.setItem(STORAGE_KEY_LABEL, label);
      else localStorage.removeItem(STORAGE_KEY_LABEL);
    } catch {
      // Non-fatal — just means the revoke button won't persist across reloads.
    }
    this.existingTokenHash = tokenHash;
    this.existingLabel = label;
  }

  private clearExisting(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN_HASH);
      localStorage.removeItem(STORAGE_KEY_LABEL);
    } catch {
      // Non-fatal.
    }
    this.existingTokenHash = null;
    this.existingLabel = null;
  }
}
