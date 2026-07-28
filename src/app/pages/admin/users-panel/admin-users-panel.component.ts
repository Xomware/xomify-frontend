import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminUser, AdminUserOptIns, AdminUserVisit, AdminViewAs } from '../models/admin-portal.model';

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
 * expands into a read-only drawer with opt-in badges, page-visit history
 * (`GET /admin/user-visits?email=`, auto-loaded on expand), and a lazy
 * "View as" impersonation snapshot (`GET /admin/view-as?email=`, loaded
 * only once the admin asks for it).
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
  state: AxLoadState = 'loading';
  users: AdminUser[] = [];

  sortKey: AxSortKey = 'lastSeen';
  sortDesc = true;

  expandedEmail: string | null = null;

  visitsState: AxSubState = 'idle';
  visits: AdminUserVisit[] = [];

  viewAsState: AxSubState = 'idle';
  viewAsData: AdminViewAs | null = null;

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
    this.viewAsState = 'idle';
    this.viewAsData = null;
    this.loadVisits(user.email);
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

  loadViewAs(email: string): void {
    if (this.viewAsState === 'loading') return;
    this.viewAsState = 'loading';
    this.admin.viewAs(email).subscribe({
      next: (res) => {
        this.viewAsData = res;
        this.viewAsState = 'loaded';
      },
      error: () => {
        this.viewAsData = null;
        this.viewAsState = 'error';
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

  /** Same badge rendering, but defensive against `view-as`'s looser optIns type. */
  viewAsOptInEntries(optIns: AdminViewAs['optIns']): Array<{ key: string; label: string; on: boolean }> {
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
