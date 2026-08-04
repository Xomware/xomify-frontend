import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, timer } from 'rxjs';
import { switchMap, take, takeUntil, takeWhile } from 'rxjs/operators';
import {
  XomtracksIngestTokensService,
  XtIngestDevice,
} from '../../services/xomtracks-ingest-tokens.service';
import { XomtracksMeService } from '../../services/xomtracks-me.service';
import { XtMeResponse } from '../../models/xomtracks-admin.model';
import { XomifyAuthService } from '../../../../services/xomify-auth.service';
import { ImpersonationService } from '../../../../services/impersonation.service';
import { ADMIN_EMAIL } from '../../config/xomtracks-admin';
// `SharedModule` (not the directive directly) — `TooltipDirective` isn't
// itself standalone, so it has to come in via its declaring NgModule.
import { SharedModule } from '../../../../shared/shared.module';

/** Mint sub-flow state, orthogonal to the connection phase. */
type XtMintState = 'idle' | 'minting' | 'minted' | 'error';

/** The overall connection phase the panel renders. */
export type XtConnectPhase = 'loading' | 'setup' | 'minted' | 'connected';

/** Poll cadence + cap for the first-scan wait (Phase C, no scan yet). */
const POLL_MS = 15_000;
const POLL_MAX = 40; // ~10 minutes

/**
 * The self-serve Shares onboarding panel — a small connection flow, not just a
 * token dispenser. Everyone signed in already sees Dom's baseline feed (no
 * setup); this is the toggle-in path for a caller who wants their OWN iMessage
 * music links layered on top, plus the live status of that connection once set
 * up. Three phases, driven by `GET /me/get` (`ownIngest`, `shareCount`,
 * `lastScanAt`) and `GET /ingest-tokens/list`:
 *
 *   - **setup** (`ownIngest === false`): requirements + how-your-data-is-handled
 *     up front (the trust story that used to live only inside the terminal
 *     installer), then Generate token.
 *   - **minted**: the one-time plaintext token + the guided installer as the
 *     single primary step (the standalone Keychain command is demoted to a
 *     collapsible alternative — the installer takes the token interactively).
 *   - **connected** (`ownIngest === true`): live status (connected · last scan ·
 *     N of your links) + a device list (`GET /ingest-tokens/list`) with per-row
 *     revoke that works from ANY browser, and "add another device".
 *
 * Hidden entirely for the real admin account (Dom) viewing their own feed —
 * their shares are always-on for everyone. Shown when impersonating (renders
 * the TARGET's real phase, with revoke disabled — read-only, matching the rest
 * of impersonation), and when `forcePreview` is set (the Admin Portal's static
 * "preview a new user" affordance). Standalone so it can drop into the admin
 * feature module without pulling in all of `XomtracksModule`.
 */
@Component({
  selector: 'app-xomtracks-setup-card',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './xomtracks-setup-card.component.html',
  styleUrls: ['./xomtracks-setup-card.component.scss'],
})
export class XomtracksSetupCardComponent implements OnInit, OnDestroy {
  /** When true, renders the setup flow statically (no `/me/get`), regardless of
   * `isAdmin` — the Admin Portal's read-only "preview a new user" affordance. */
  @Input() forcePreview = false;

  // Mint sub-flow.
  state: XtMintState = 'idle';
  label = '';
  plaintextToken: string | null = null;
  errorMessage = '';
  copied = false;
  keychainOpen = false;
  /** In the connected phase, reveals the mint form to add another device. */
  addingDevice = false;

  // Connection state (from the backend).
  me: XtMeResponse | null = null;
  meError = false;
  devices: XtIngestDevice[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private ingestTokens: XomtracksIngestTokensService,
    private meService: XomtracksMeService,
    private auth: XomifyAuthService,
    private impersonation: ImpersonationService,
  ) {}

  ngOnInit(): void {
    if (this.forcePreview || this.isAdmin) return;
    this.loadConnection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Visibility ──────────────────────────────────────────────────────────

  /** True for the real admin account (Dom) on their OWN feed — their shares are
   * always-on for everyone, so the panel stays hidden. `forcePreview` and
   * impersonation both flip this false: the preview shows the flow, and while
   * impersonating the effective user is the (non-admin) target, whose real
   * connection state we want to show. */
  get isAdmin(): boolean {
    if (this.forcePreview) return false;
    if (this.impersonation.isImpersonating) return false;
    const email = this.auth.getEmail();
    return !!email && email.toLowerCase() === ADMIN_EMAIL;
  }

  /** Writes (revoke) are disabled while impersonating — read-only, same policy
   * as the rest of impersonation mode. */
  get readOnly(): boolean {
    return this.impersonation.isImpersonating;
  }

  // ── Phase ──────────────────────────────────────────────────────────────

  get phase(): XtConnectPhase {
    if (this.state === 'minted') return 'minted';
    if (this.forcePreview) return 'setup';
    if (!this.me) return this.meError ? 'setup' : 'loading';
    return this.me.ownIngest ? 'connected' : 'setup';
  }

  get shareCount(): number {
    return this.me?.shareCount ?? 0;
  }

  get lastScanAt(): string | null {
    return this.me?.lastScanAt ?? null;
  }

  // ── Data ────────────────────────────────────────────────────────────────

  private loadConnection(): void {
    this.meService.refresh();
    this.meService.get().pipe(takeUntil(this.destroy$)).subscribe({
      next: (me) => {
        this.me = me;
        this.meError = false;
        if (me.ownIngest) {
          this.loadDevices();
          this.maybePollForFirstScan();
        }
      },
      error: () => {
        this.meError = true;
        this.me = null;
      },
    });
  }

  private loadDevices(): void {
    this.ingestTokens.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (devices) => (this.devices = devices),
      error: () => {
        // Non-fatal — the header status still renders; the list just stays empty.
        this.devices = [];
      },
    });
  }

  /** While connected but no scan has landed yet, poll `/me/get` (+ devices)
   * until `lastScanAt` is set or the window elapses — the feedback loop that
   * flips "waiting for first scan…" to "connected · N shares". Self-heals
   * across reloads: any load in this state re-arms the poll. */
  private maybePollForFirstScan(): void {
    if (!this.me || this.me.lastScanAt) return;
    timer(POLL_MS, POLL_MS)
      .pipe(
        take(POLL_MAX),
        switchMap(() => {
          this.meService.refresh();
          return this.meService.get();
        }),
        takeWhile((me) => !me.lastScanAt, true),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (me) => {
          this.me = me;
          this.loadDevices();
        },
        error: () => {
          // Stop quietly — on-load refresh will pick it up next time.
        },
      });
  }

  // ── Mint / revoke ────────────────────────────────────────────────────────

  startAddDevice(): void {
    this.addingDevice = true;
    this.state = 'idle';
    this.label = '';
    this.errorMessage = '';
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
        this.keychainOpen = false;
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = "Couldn't generate a token — try again in a moment.";
      },
    });
  }

  revoke(device: XtIngestDevice): void {
    if (this.readOnly) return;
    this.ingestTokens.revoke(device.tokenHash).subscribe({
      next: () => {
        this.devices = this.devices.filter((d) => d.tokenHash !== device.tokenHash);
        // ownIngest / lastScanAt may have changed (last device gone) — resync.
        this.loadConnection();
      },
      error: () => {
        this.errorMessage = "Couldn't revoke that device — try again in a moment.";
      },
    });
  }

  /** Leaves the one-time token behind and returns to the live connection view,
   * re-fetching so the just-added device + first-scan poll pick up. */
  finishMinted(): void {
    this.plaintextToken = null;
    this.state = 'idle';
    this.label = '';
    this.addingDevice = false;
    if (!this.forcePreview) this.loadConnection();
  }

  cancelAddDevice(): void {
    this.addingDevice = false;
    this.state = 'idle';
    this.errorMessage = '';
  }

  // ── Copy affordances ──────────────────────────────────────────────────────

  toggleKeychain(): void {
    this.keychainOpen = !this.keychainOpen;
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

  // ── Display helpers ────────────────────────────────────────────────────────

  deviceLabel(device: XtIngestDevice): string {
    return device.label?.trim() || 'Unnamed device';
  }

  /** "just now" / "3 min ago" / "2 hr ago" / "5 days ago" from an ISO string,
   * or null when there's no timestamp (never scanned). */
  relativeTime(iso: string | null): string | null {
    if (!iso) return null;
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return null;
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  trackByHash(_index: number, device: XtIngestDevice): string {
    return device.tokenHash;
  }
}
