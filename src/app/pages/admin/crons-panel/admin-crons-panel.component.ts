import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminCron, AdminCronRun } from '../models/admin-portal.model';

type AxLoadState = 'loading' | 'loaded' | 'not-live' | 'error';

/**
 * Admin Portal — "Crons" tab. `GET /admin/crons`: one card per scheduled
 * job with its last-run status/timing/itemsProcessed, plus an expandable
 * (native `<details>`) recent-runs history.
 */
@Component({
  selector: 'app-admin-crons-panel',
  templateUrl: './admin-crons-panel.component.html',
  styleUrls: ['./admin-crons-panel.component.scss'],
})
export class AdminCronsPanelComponent implements OnInit {
  state: AxLoadState = 'loading';
  crons: AdminCron[] = [];

  constructor(private admin: AdminPortalService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.admin.crons().subscribe({
      next: (res) => {
        this.crons = res ?? [];
        this.state = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.crons = [];
        this.state = err.status === 404 ? 'not-live' : 'error';
      },
    });
  }

  retry(): void {
    this.load();
  }

  statusClass(status: string | undefined | null): 'ok' | 'error' | 'unknown' {
    const s = (status || '').toLowerCase();
    if (s === 'ok' || s === 'success' || s === 'succeeded') return 'ok';
    if (s === 'error' || s === 'failed' || s === 'failure') return 'error';
    return 'unknown';
  }

  duration(run: AdminCronRun | null | undefined): string {
    if (!run?.startedAt) return '—';
    if (!run.finishedAt) return 'In progress';
    const startMs = Date.parse(run.startedAt);
    const endMs = Date.parse(run.finishedAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return '—';
    const diffMs = Math.max(0, endMs - startMs);
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60_000) return `${(diffMs / 1000).toFixed(1)}s`;
    const totalSec = Math.round(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
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

  trackByCron(_index: number, cron: AdminCron): string {
    return cron.cronName;
  }

  trackByRun(index: number, run: AdminCronRun): string {
    return `${run.startedAt}-${index}`;
  }
}
