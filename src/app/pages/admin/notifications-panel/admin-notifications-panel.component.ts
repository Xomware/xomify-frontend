import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import { AX_NOTIFICATIONS_LIMITS, AdminNotification } from '../models/admin-portal.model';

type AxLoadState = 'loading' | 'loaded' | 'not-live' | 'error';

/**
 * Admin Portal — "Notifications" tab. `GET /admin/notifications?limit=`:
 * the outbound email/push send log, newest-first (the backend's job to
 * order — this just renders what it gets).
 */
@Component({
  selector: 'app-admin-notifications-panel',
  templateUrl: './admin-notifications-panel.component.html',
  styleUrls: ['./admin-notifications-panel.component.scss'],
})
export class AdminNotificationsPanelComponent implements OnInit {
  readonly limitOptions = AX_NOTIFICATIONS_LIMITS;

  limit = 50;
  state: AxLoadState = 'loading';
  notifications: AdminNotification[] = [];

  constructor(private admin: AdminPortalService) {}

  ngOnInit(): void {
    this.load();
  }

  setLimit(limit: number): void {
    if (this.limit === limit) return;
    this.limit = limit;
    this.load();
  }

  retry(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.admin.notifications(this.limit).subscribe({
      next: (res) => {
        this.notifications = res ?? [];
        this.state = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.notifications = [];
        this.state = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  isFailed(status: string | undefined | null): boolean {
    const s = (status || '').toLowerCase();
    return s === 'failed' || s === 'error' || s === 'bounced';
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

  trackByRow(index: number, n: AdminNotification): string {
    return `${n.ts}-${n.toEmail}-${index}`;
  }
}
