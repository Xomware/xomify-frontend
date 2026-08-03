import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminUser, AdminUserOptIns, AdminUserVisit } from '../models/admin-portal.model';

type AxLoadState = 'loading' | 'loaded' | 'not-live' | 'error';
type AxSortKey = 'email' | 'displayName' | 'lastSeen';
type AxSubState = 'idle' | 'loading' | 'loaded' | 'error';

const OPT_IN_LABELS: Record<keyof AdminUserOptIns, string> = {
  wrapped: 'Wrapped',
  releaseRadar: 'Release Radar',
  likesPublic: 'Likes public',
  favoritesReminder: 'Favorites reminder',
};

/**
 * Admin Portal — "Users" tab. `GET /admin/users-list`: the full user
 * directory, sortable (defaults to most-recently-seen first). Each row
 * expands into a read-only drawer with opt-in badges and page-visit history
 * (`GET /admin/user-visits?email=`, auto-loaded on expand), plus a "View as"
 * row action that jumps the parent shell to the dedicated View As tab,
 * pre-loaded for that user (`viewAs` output).
 *
 * Only one row is expanded at a time — simplest accordion behavior for a
 * directory this shape, and keeps the drawer's own load state a single set
 * of fields instead of a map keyed by email.
 */
@Component({
  selector: 'app-admin-users-panel',
  templateUrl: './admin-users-panel.component.html',
  styleUrls: ['./admin-users-panel.component.scss'],
})
export class AdminUsersPanelComponent implements OnInit {
  /** "View as" row action — the parent shell owns jumping to the View As tab. */
  @Output() viewAs = new EventEmitter<string>();
  /** "Step through as this user" row action — the parent shell owns starting
   * full impersonation and navigating into the app. */
  @Output() stepThroughAs = new EventEmitter<string>();

  state: AxLoadState = 'loading';
  users: AdminUser[] = [];

  sortKey: AxSortKey = 'lastSeen';
  sortDesc = true;

  expandedEmail: string | null = null;

  visitsState: AxSubState = 'idle';
  visits: AdminUserVisit[] = [];

  constructor(private admin: AdminPortalService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.admin.usersList().subscribe({
      next: (users) => {
        this.users = users ?? [];
        this.state = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.users = [];
        this.state = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  retry(): void {
    this.load();
  }

  setSort(key: AxSortKey): void {
    if (this.sortKey === key) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortKey = key;
      this.sortDesc = true;
    }
  }

  sortAriaSort(key: AxSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey !== key) return 'none';
    return this.sortDesc ? 'descending' : 'ascending';
  }

  get sortedUsers(): AdminUser[] {
    const key = this.sortKey;
    const dir = this.sortDesc ? -1 : 1;
    return [...this.users].sort((a, b) => {
      const av = (a[key] ?? '').toString().toLowerCase();
      const bv = (b[key] ?? '').toString().toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  isExpanded(user: AdminUser): boolean {
    return this.expandedEmail === user.email;
  }

  toggleRow(user: AdminUser): void {
    if (this.expandedEmail === user.email) {
      this.expandedEmail = null;
      return;
    }
    this.expandedEmail = user.email;
    this.visitsState = 'idle';
    this.visits = [];
    this.loadVisits(user.email);
  }

  /** Jump to the parent shell's View As tab, pre-loaded for this user. */
  onViewAs(user: AdminUser): void {
    this.viewAs.emit(user.email);
  }

  /** Start full "step through as" impersonation for this user (see
   * `ImpersonationService`), navigating out of the Admin Portal into the app. */
  onStepThroughAs(user: AdminUser): void {
    this.stepThroughAs.emit(user.email);
  }

  private loadVisits(email: string): void {
    this.visitsState = 'loading';
    this.admin.userVisits(email).subscribe({
      next: (visits) => {
        this.visits = visits ?? [];
        this.visitsState = 'loaded';
      },
      error: () => {
        this.visits = [];
        this.visitsState = 'error';
      },
    });
  }

  optInEntries(optIns: AdminUserOptIns): Array<{ key: string; label: string; on: boolean }> {
    return (Object.keys(OPT_IN_LABELS) as Array<keyof AdminUserOptIns>).map((key) => ({
      key,
      label: OPT_IN_LABELS[key],
      on: !!optIns?.[key],
    }));
  }

  /** Compact "N/4" opt-in summary shown in the table row, so the count is
   * visible without expanding the drawer (density ask — the drawer still
   * shows each opt-in individually). */
  optInSummary(optIns: AdminUserOptIns): string {
    const total = Object.keys(OPT_IN_LABELS).length;
    const on = (Object.keys(OPT_IN_LABELS) as Array<keyof AdminUserOptIns>).filter((key) => !!optIns?.[key]).length;
    return `${on}/${total}`;
  }

  trackByEmail(_index: number, user: AdminUser): string {
    return user.email;
  }

  trackByVisit(index: number, visit: AdminUserVisit): string {
    return `${visit.ts}-${visit.path}-${index}`;
  }
}
