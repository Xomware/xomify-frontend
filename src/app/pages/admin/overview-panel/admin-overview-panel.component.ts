import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import {
  AdminCron,
  AdminHealthSummary,
  AdminNotification,
  AdminTab,
  AdminUser,
} from '../models/admin-portal.model';

type AxTileState = 'loading' | 'loaded' | 'not-live' | 'error';

const OVERVIEW_NOTIFICATIONS_SAMPLE = 25;

/**
 * Admin Portal — "Overview" tab, and the default landing view. A compact
 * at-a-glance dashboard pulling one signal from each of the other four
 * tabs' endpoints (Health/Users/Crons/Notifications — Broadcasts is
 * authoring, not a read signal worth summarizing here). Each tile fetches
 * and degrades independently: one endpoint 404ing or erroring never blocks
 * the other three tiles from rendering.
 */
@Component({
  selector: 'app-admin-overview-panel',
  templateUrl: './admin-overview-panel.component.html',
  styleUrls: ['./admin-overview-panel.component.scss'],
})
export class AdminOverviewPanelComponent implements OnInit {
  /** Bubbled up so a tile's "View all" link can switch the parent shell's tab. */
  @Output() jumpToTab = new EventEmitter<AdminTab>();

  healthState: AxTileState = 'loading';
  health: AdminHealthSummary | null = null;

  usersState: AxTileState = 'loading';
  users: AdminUser[] = [];

  cronsState: AxTileState = 'loading';
  crons: AdminCron[] = [];

  notificationsState: AxTileState = 'loading';
  notifications: AdminNotification[] = [];

  constructor(private admin: AdminPortalService) {}

  ngOnInit(): void {
    this.loadHealth();
    this.loadUsers();
    this.loadCrons();
    this.loadNotifications();
  }

  retryHealth(): void {
    this.loadHealth();
  }
  retryUsers(): void {
    this.loadUsers();
  }
  retryCrons(): void {
    this.loadCrons();
  }
  retryNotifications(): void {
    this.loadNotifications();
  }

  go(tab: AdminTab): void {
    this.jumpToTab.emit(tab);
  }

  private loadHealth(): void {
    this.healthState = 'loading';
    this.admin.health(24).subscribe({
      next: (res) => {
        this.health = res;
        this.healthState = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.health = null;
        this.healthState = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  private loadUsers(): void {
    this.usersState = 'loading';
    this.admin.usersList().subscribe({
      next: (res) => {
        this.users = res ?? [];
        this.usersState = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.users = [];
        this.usersState = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  private loadCrons(): void {
    this.cronsState = 'loading';
    this.admin.crons().subscribe({
      next: (res) => {
        this.crons = res ?? [];
        this.cronsState = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.crons = [];
        this.cronsState = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  private loadNotifications(): void {
    this.notificationsState = 'loading';
    this.admin.notifications(OVERVIEW_NOTIFICATIONS_SAMPLE).subscribe({
      next: (res) => {
        this.notifications = res ?? [];
        this.notificationsState = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.notifications = [];
        this.notificationsState = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  // ── Health ────────────────────────────────────────────────────────
  get topErrors(): AdminHealthSummary['recentErrors'] {
    return (this.health?.recentErrors ?? []).slice(0, 5);
  }

  get errorRatePct(): string {
    if (!this.health || this.health.totalCalls === 0) return '0%';
    return `${((this.health.errorCount / this.health.totalCalls) * 100).toFixed(1)}%`;
  }

  // ── Users ─────────────────────────────────────────────────────────
  get recentUsers(): AdminUser[] {
    return [...this.users]
      .sort((a, b) => Date.parse(b.lastSeen || '') - Date.parse(a.lastSeen || ''))
      .slice(0, 5);
  }

  // ── Crons ─────────────────────────────────────────────────────────
  get failedCrons(): AdminCron[] {
    return this.crons.filter((c) => this.cronStatusClass(c) === 'error');
  }

  cronStatusClass(cron: AdminCron): 'ok' | 'error' | 'unknown' {
    const s = (cron.lastRun?.status || '').toLowerCase();
    if (s === 'ok' || s === 'success' || s === 'succeeded') return 'ok';
    if (s === 'error' || s === 'failed' || s === 'failure') return 'error';
    return 'unknown';
  }

  // ── Notifications ────────────────────────────────────────────────
  get failedNotifications(): AdminNotification[] {
    return this.notifications.filter((n) => this.isFailed(n.status));
  }

  get recentNotifications(): AdminNotification[] {
    return this.notifications.slice(0, 5);
  }

  isFailed(status: string | undefined | null): boolean {
    const s = (status || '').toLowerCase();
    return s === 'failed' || s === 'error' || s === 'bounced';
  }

  trackByPath(_index: number, row: { path: string }): string {
    return row.path;
  }

  trackByEmail(_index: number, user: AdminUser): string {
    return user.email;
  }

  trackByCron(_index: number, cron: AdminCron): string {
    return cron.cronName;
  }

  trackByRow(index: number, n: AdminNotification): string {
    return `${n.ts}-${n.toEmail}-${index}`;
  }
}
