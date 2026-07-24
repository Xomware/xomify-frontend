import { Component, OnInit } from '@angular/core';
import { XomtracksAdminService } from '../../../services/xomtracks-admin.service';
import { XT_ADMIN_CALLS_WINDOWS, XtAdminCallsSummary } from '../../../models/xomtracks-admin.model';

type XtaLoadState = 'loading' | 'loaded' | 'error';

/**
 * Admin Portal — "Calls & errors" tab. `GET /admin/calls`: aggregates the
 * TTL'd request log over a trailing window into summary counts, a by-path
 * breakdown, a by-status breakdown, and the most recent errors.
 */
@Component({
  selector: 'app-xomtracks-admin-calls-panel',
  templateUrl: './xomtracks-admin-calls-panel.component.html',
  styleUrls: ['./xomtracks-admin-calls-panel.component.scss'],
})
export class XomtracksAdminCallsPanelComponent implements OnInit {
  readonly windowOptions = XT_ADMIN_CALLS_WINDOWS;

  windowDays = 7;
  state: XtaLoadState = 'loading';
  summary: XtAdminCallsSummary | null = null;

  constructor(private admin: XomtracksAdminService) {}

  ngOnInit(): void {
    this.load();
  }

  setWindow(days: number): void {
    if (this.windowDays === days) return;
    this.windowDays = days;
    this.load();
  }

  retry(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.admin.calls(this.windowDays).subscribe({
      next: (res) => {
        this.summary = res;
        this.state = 'loaded';
      },
      error: () => {
        this.summary = null;
        this.state = 'error';
      },
    });
  }

  get errorRatePct(): string {
    if (!this.summary || this.summary.totalCalls === 0) return '0%';
    return `${((this.summary.errorCount / this.summary.totalCalls) * 100).toFixed(1)}%`;
  }

  get statusEntries(): Array<{ status: string; count: number }> {
    if (!this.summary) return [];
    return Object.entries(this.summary.byStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => a.status.localeCompare(b.status));
  }

  isErrorStatus(status: string): boolean {
    return Number(status) >= 400;
  }

  humanTs(iso: string | null | undefined): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return String(iso);
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  trackByPath(_index: number, row: { path: string }): string {
    return row.path;
  }

  trackByErrorId(_index: number, row: { id: string }): string {
    return row.id;
  }
}
