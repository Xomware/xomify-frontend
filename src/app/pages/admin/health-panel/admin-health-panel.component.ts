import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import { AX_HEALTH_WINDOWS, AdminHealthSummary } from '../models/admin-portal.model';

type AxLoadState = 'loading' | 'loaded' | 'not-live' | 'error';

/**
 * Admin Portal — "Health" tab. `GET /admin/health?windowHours=`: call
 * volume, error rate, a by-route breakdown, and the most recent errors over
 * a trailing window. A 404 (request-log instrumentation not deployed yet)
 * renders a calm "not live" state rather than a hard error.
 */
@Component({
  selector: 'app-admin-health-panel',
  templateUrl: './admin-health-panel.component.html',
  styleUrls: ['./admin-health-panel.component.scss'],
})
export class AdminHealthPanelComponent implements OnInit {
  readonly windowOptions = AX_HEALTH_WINDOWS;

  windowHours = 24;
  state: AxLoadState = 'loading';
  summary: AdminHealthSummary | null = null;

  constructor(private admin: AdminPortalService) {}

  ngOnInit(): void {
    this.load();
  }

  setWindow(hours: number): void {
    if (this.windowHours === hours) return;
    this.windowHours = hours;
    this.load();
  }

  retry(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.admin.health(this.windowHours).subscribe({
      next: (res) => {
        this.summary = res;
        this.state = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.summary = null;
        this.state = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  get errorRatePct(): string {
    if (!this.summary || this.summary.totalCalls === 0) return '0%';
    return `${((this.summary.errorCount / this.summary.totalCalls) * 100).toFixed(1)}%`;
  }

  windowLabel(hours: number): string {
    return this.windowOptions.find((w) => w.value === hours)?.label ?? `${hours}h`;
  }

  isErrorStatus(status: number): boolean {
    return status >= 400;
  }

  trackByPath(_index: number, row: { path: string }): string {
    return row.path;
  }

  trackByError(index: number, row: { ts: string; path: string }): string {
    return `${row.ts}-${row.path}-${index}`;
  }
}
