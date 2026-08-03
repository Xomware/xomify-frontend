import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminUserOptIns, AdminUserVisit, AdminViewAs } from '../models/admin-portal.model';

type AxViewAsState = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error';

const OPT_IN_LABELS: Record<keyof AdminUserOptIns, string> = {
  wrapped: 'Wrapped',
  releaseRadar: 'Release Radar',
  likesPublic: 'Likes public',
  favoritesReminder: 'Favorites reminder',
};

/**
 * Admin Portal — "View As" tab. `GET /admin/view-as?email=`: a read-only
 * impersonation snapshot of a target user (profile, opt-ins, recent visits,
 * favorites, active broadcasts). The backend's `note` is always rendered
 * prominently — it explains that live Spotify-derived surfaces (top items,
 * etc.) are NOT impersonated, since the backend can only project what it can
 * read server-side for the target user.
 *
 * Reachable two ways: typed directly into the email field here, or a preset
 * email from the Users panel's "View as" row action (`presetEmail`,
 * auto-loads on mount/change) — the same handoff pattern as the Shares Admin
 * Portal's View As tab (`xomtracks-admin-viewas-panel`), restyled to the
 * macOS admin look.
 *
 * Also hosts "Preview: Shares signup" — renders the real
 * `xomtracks-setup-card` self-serve onboarding card in `forcePreview` mode,
 * since Dom's always-admin account never sees it on `/shares` (that card
 * hides itself for the admin, whose shares are always-on for everyone).
 */
@Component({
  selector: 'app-admin-viewas-panel',
  templateUrl: './admin-viewas-panel.component.html',
  styleUrls: ['./admin-viewas-panel.component.scss'],
})
export class AdminViewasPanelComponent implements OnInit, OnChanges {
  /** Email pre-filled from the Users panel's "View as" row action. */
  @Input() presetEmail: string | null = null;

  emailInput = '';
  state: AxViewAsState = 'idle';
  viewingEmail: string | null = null;
  data: AdminViewAs | null = null;

  showSignupPreview = false;

  constructor(private admin: AdminPortalService) {}

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

  retry(): void {
    this.load();
  }

  exit(): void {
    this.state = 'idle';
    this.viewingEmail = null;
    this.data = null;
    this.emailInput = '';
  }

  toggleSignupPreview(): void {
    this.showSignupPreview = !this.showSignupPreview;
  }

  optInEntries(optIns: AdminViewAs['optIns']): Array<{ key: string; label: string; on: boolean }> {
    if (!optIns) return [];
    return Object.entries(optIns).map(([key, value]) => ({
      key,
      label: OPT_IN_LABELS[key as keyof AdminUserOptIns] ?? key,
      on: !!value,
    }));
  }

  prettyJson(value: unknown): string {
    if (value === null || value === undefined) return '—';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  hasContent(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }

  trackByVisit(index: number, visit: AdminUserVisit): string {
    return `${visit.ts}-${visit.path}-${index}`;
  }

  private load(): void {
    const email = this.emailInput.trim().toLowerCase();
    if (!email) return;

    this.state = 'loading';

    this.admin.viewAs(email).subscribe({
      next: (res) => {
        this.viewingEmail = res.email;
        this.data = res;
        this.state = 'loaded';
      },
      error: (err: unknown) => {
        this.viewingEmail = null;
        this.data = null;
        this.state = err instanceof HttpErrorResponse && err.status === 404 ? 'not-found' : 'error';
      },
    });
  }
}
