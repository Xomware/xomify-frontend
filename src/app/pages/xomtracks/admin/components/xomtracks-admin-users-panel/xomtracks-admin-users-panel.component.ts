import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { XomtracksAdminService } from '../../../services/xomtracks-admin.service';
import { XtAdminUser } from '../../../models/xomtracks-admin.model';

type XtaLoadState = 'loading' | 'loaded' | 'error';
type XtaSortKey = 'email' | 'lastSeen' | 'firstSeen';

/**
 * Admin Portal — "Users" tab. `GET /admin/users`: everyone who has ever
 * signed into Xomtracks (materialized from the auto-upsert directory hook),
 * with own-ingest / Spotify-connected badges. Sortable by last-seen
 * (defaults to most-recent-first) so the admin can spot active vs. dormant
 * accounts at a glance. Each row's "View as" jumps to the View As tab
 * pre-loaded for that user.
 */
@Component({
  selector: 'app-xomtracks-admin-users-panel',
  templateUrl: './xomtracks-admin-users-panel.component.html',
  styleUrls: ['./xomtracks-admin-users-panel.component.scss'],
})
export class XomtracksAdminUsersPanelComponent implements OnInit {
  @Output() viewAs = new EventEmitter<string>();

  state: XtaLoadState = 'loading';
  users: XtAdminUser[] = [];

  sortKey: XtaSortKey = 'lastSeen';
  sortDesc = true;

  constructor(private admin: XomtracksAdminService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.admin.listUsers().subscribe({
      next: (res) => {
        this.users = res.users ?? [];
        this.state = 'loaded';
      },
      error: () => {
        this.users = [];
        this.state = 'error';
      },
    });
  }

  retry(): void {
    this.load();
  }

  /** Toggles sort direction when the same column header is clicked twice;
   * switching to a new column starts descending (most-recent / Z-first). */
  setSort(key: XtaSortKey): void {
    if (this.sortKey === key) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortKey = key;
      this.sortDesc = true;
    }
  }

  sortAriaSort(key: XtaSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey !== key) return 'none';
    return this.sortDesc ? 'descending' : 'ascending';
  }

  get sortedUsers(): XtAdminUser[] {
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

  humanDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '—';
    const diffMs = Date.now() - ms;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  trackByEmail(_index: number, user: XtAdminUser): string {
    return user.email;
  }
}
