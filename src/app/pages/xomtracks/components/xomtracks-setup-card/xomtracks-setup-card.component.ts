import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  XomtracksIngestTokensService,
} from '../../services/xomtracks-ingest-tokens.service';
import { XomifyAuthService } from '../../../../services/xomify-auth.service';
import { ImpersonationService } from '../../../../services/impersonation.service';
import { ADMIN_EMAIL } from '../../config/xomtracks-admin';
// `SharedModule` (not the directive directly) — `TooltipDirective` isn't
// itself standalone, so it has to come in via its declaring NgModule.
import { SharedModule } from '../../../../shared/shared.module';

type XtSetupState = 'idle' | 'minting' | 'minted' | 'error';

const STORAGE_KEY_TOKEN_HASH = 'xt.ingest.tokenHash';
const STORAGE_KEY_LABEL = 'xt.ingest.label';

/**
 * The opt-in "run your own" card. Everyone signed in sees Dom's shared feed
 * by default (the `baseline` playlists/shares — no setup required); this
 * card is the toggle-in path for a caller who wants their OWN iMessage music
 * links layered on top. Mints a per-user extractor ingest token
 * (`POST /ingest-tokens/create`), shows the returned PLAINTEXT token exactly
 * once (it's never recoverable after this response —
 * xomtracks-backend/lambdas/ingesttokens_create/handler.py), plus the
 * Keychain store command and the live `install.sh` guided installer command
 * (`xomtracks-backend/extractor/install.sh` — curl | bash; walks the user
 * through Full Disk Access and schedules a recurring scan on its own, and
 * can also take the token interactively if they'd rather skip the manual
 * Keychain command).
 *
 * The token hash (non-secret) is cached in localStorage so a revoke button
 * can appear on return visits — there is no `GET` list endpoint yet, so this
 * is the only way the UI can know "you already have one" after a refresh.
 *
 * Renders as a small, collapsed-by-default strip (`expanded`/`toggleExpanded`)
 * rather than an always-open card — it's a secondary affordance, not the
 * main point of the page. Hidden entirely for the admin account (`isAdmin`),
 * whose shares are always-on for everyone and never need self-serve setup —
 * unless `forcePreview` is set, which is how the Admin Portal's "Preview:
 * Shares signup" section (`admin-viewas-panel`) shows Dom this exact card as
 * a first-time visitor would see it. Standalone so it can be dropped into
 * that unrelated feature module's `imports` without pulling in all of
 * `XomtracksModule`.
 */
@Component({
  selector: 'app-xomtracks-setup-card',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './xomtracks-setup-card.component.html',
  styleUrls: ['./xomtracks-setup-card.component.scss'],
})
export class XomtracksSetupCardComponent implements OnInit {
  /** When true, renders the card's setup flow regardless of `isAdmin` — used
   * by the Admin Portal's read-only "preview a new user" affordance. */
  @Input() forcePreview = false;

  state: XtSetupState = 'idle';
  label = '';
  plaintextToken: string | null = null;
  existingTokenHash: string | null = null;
  existingLabel: string | null = null;
  errorMessage = '';
  copied = false;

  /** Collapsed by default — expands to reveal the mint form. In preview
   * mode it starts expanded so the whole flow is visible immediately. */
  expanded = false;

  constructor(
    private ingestTokens: XomtracksIngestTokensService,
    private auth: XomifyAuthService,
    private impersonation: ImpersonationService,
  ) {}

  ngOnInit(): void {
    this.restoreExisting();
    if (this.forcePreview) this.expanded = true;
  }

  /** True for the admin account — their shares are always-on for everyone,
   * so this affordance never applies and stays hidden (unless previewing).
   *
   * While impersonating, the effective user is the (non-admin) TARGET, who
   * CAN opt in — so the card must show. The JWT email is still the admin's
   * here, so we can't read it directly; defer to impersonation state first. */
  get isAdmin(): boolean {
    if (this.forcePreview) return false;
    if (this.impersonation.isImpersonating) return false;
    const email = this.auth.getEmail();
    return !!email && email.toLowerCase() === ADMIN_EMAIL;
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
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

  /** The guided installer — clones/updates the extractor, walks through Full
   * Disk Access, and schedules a recurring scan via launchd. Lives at
   * `xomtracks-backend/extractor/install.sh`; fetched straight off `master`
   * so it always matches the live extractor code. */
  readonly installCommand =
    'curl -fsSL https://raw.githubusercontent.com/Xomware/xomtracks-backend/master/extractor/install.sh | bash';

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

  async copyInstallCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.installCommand);
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
