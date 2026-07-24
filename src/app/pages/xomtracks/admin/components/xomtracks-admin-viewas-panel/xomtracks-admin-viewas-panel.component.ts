import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { XomtracksAdminService } from '../../../services/xomtracks-admin.service';
import { XT_DIRECTIONS, XT_TIME_WINDOWS, XtDirection, XtShare, XtTimeWindow } from '../../../models/xomtracks-share.model';
import {
  xtDisplayTitle,
  xtOpenLabel,
  xtPlatformLabel,
  xtPrimaryUrl,
  xtRelativeDate,
  xtSharerLabel,
} from '../../../utils/xomtracks-track-display';

type XtaViewAsState = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Admin Portal — "View as" tab (`GET /admin/user-feed`). READ-ONLY
 * impersonation: renders the target user's feed exactly as they'd see it
 * (Dom's always-on baseline + their own shares, enriched with THEIR ratings
 * and heard state), but no rating/heard controls are wired up — this is a
 * strictly observational view, so the admin can never accidentally write to
 * a user's data. A persistent banner makes the read-only nature explicit.
 *
 * Can be entered two ways: a preset email from the Users panel's
 * "View as" action (`presetEmail`, auto-loads on mount), or typed directly
 * into the email field here.
 */
@Component({
  selector: 'app-xomtracks-admin-viewas-panel',
  templateUrl: './xomtracks-admin-viewas-panel.component.html',
  styleUrls: ['./xomtracks-admin-viewas-panel.component.scss'],
})
export class XomtracksAdminViewasPanelComponent implements OnInit, OnChanges {
  /** Email pre-filled from the Users panel's "View as" row action. */
  @Input() presetEmail: string | null = null;

  readonly directions = XT_DIRECTIONS;
  readonly windows = XT_TIME_WINDOWS;

  emailInput = '';
  direction: XtDirection = 'in';
  window: XtTimeWindow = 'month';

  state: XtaViewAsState = 'idle';
  viewingEmail: string | null = null;
  shares: XtShare[] = [];
  errorMessage = '';

  constructor(private admin: XomtracksAdminService) {}

  ngOnInit(): void {
    if (this.presetEmail) {
      this.emailInput = this.presetEmail;
      this.load();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only re-trigger on an actual (post-init) change to presetEmail — the
    // very first assignment is already handled by ngOnInit.
    if (changes['presetEmail'] && !changes['presetEmail'].firstChange && this.presetEmail) {
      this.emailInput = this.presetEmail;
      this.load();
    }
  }

  submit(): void {
    if (!this.emailInput.trim()) return;
    this.load();
  }

  setDirection(direction: XtDirection): void {
    this.direction = direction;
    if (this.viewingEmail) this.load();
  }

  setWindow(window: XtTimeWindow): void {
    this.window = window;
    if (this.viewingEmail) this.load();
  }

  retry(): void {
    this.load();
  }

  exit(): void {
    this.state = 'idle';
    this.viewingEmail = null;
    this.shares = [];
    this.emailInput = '';
    this.errorMessage = '';
  }

  private load(): void {
    const email = this.emailInput.trim().toLowerCase();
    if (!email) return;

    this.state = 'loading';
    this.errorMessage = '';

    this.admin.userFeed(email, this.direction, this.window).subscribe({
      next: (res) => {
        this.viewingEmail = res.email;
        this.shares = res.shares ?? [];
        this.state = 'loaded';
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.state = 'not-found';
        } else {
          this.state = 'error';
        }
        this.viewingEmail = null;
        this.shares = [];
      },
    });
  }

  // ── Display helpers (read-only — no write actions from this view) ────
  title(share: XtShare): string {
    return xtDisplayTitle(share);
  }

  artist(share: XtShare): string {
    return share.trackArtist?.trim() || '—';
  }

  platformLabel(share: XtShare): string {
    return xtPlatformLabel(share.platform);
  }

  sharer(share: XtShare): string {
    return xtSharerLabel(share);
  }

  relativeDate(share: XtShare): string {
    return xtRelativeDate(share.messageDate);
  }

  openUrl(share: XtShare): string {
    return xtPrimaryUrl(share);
  }

  openLabel(share: XtShare): string {
    return xtOpenLabel(share);
  }

  hasOpenTarget(share: XtShare): boolean {
    return !!this.openUrl(share)?.trim();
  }

  ratingLabel(share: XtShare): string {
    const r = share.rating;
    if (!r || r.count === 0) return 'Unrated';
    const mine = r.myRating ? ` · their rating ${r.myRating}★` : '';
    return `${r.avg.toFixed(1)}★ avg (${r.count})${mine}`;
  }

  heardLabel(share: XtShare): string {
    return share.heard ? 'Heard' : 'Unheard';
  }

  genresLabel(share: XtShare): string {
    return (share.genres ?? []).filter(Boolean).join(', ');
  }

  trackByShareId(_index: number, share: XtShare): string {
    return share.shareId;
  }
}
