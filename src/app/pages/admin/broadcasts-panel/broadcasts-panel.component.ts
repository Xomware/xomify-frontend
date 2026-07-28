import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BroadcastsService } from '../services/broadcasts.service';
import { Broadcast } from '../models/broadcast.model';

type PanelState = 'loading' | 'loaded' | 'not-live' | 'error';

/**
 * Admin Portal (`/admin`) — Broadcasts panel. Author an app-update
 * broadcast (title, body, optional expiry) and manage the existing list.
 * WS-B of `docs/features/xomify-favorites-home-admin/PLAN.md`; consumed on
 * Home by the sibling WS-C work once that ships.
 *
 * The `xomify-backend` endpoints this hits are built by a sibling PR that
 * may not have deployed yet — a 404 on the initial list load is treated as
 * "not live yet" (a distinct, calmer empty state) rather than a hard error,
 * per the task brief's "degrade gracefully" instruction.
 */
@Component({
  selector: 'app-broadcasts-panel',
  templateUrl: './broadcasts-panel.component.html',
  styleUrls: ['./broadcasts-panel.component.scss'],
})
export class BroadcastsPanelComponent implements OnInit {
  state: PanelState = 'loading';
  broadcasts: Broadcast[] = [];
  loadErrorMessage = '';

  // Form state
  title = '';
  body = '';
  activeUntil = '';
  submitting = false;
  formError = '';

  /** id currently mid-delete, so its button can show a busy state. */
  deletingId: string | null = null;

  constructor(private broadcastsService: BroadcastsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.loadErrorMessage = '';
    this.broadcastsService.list().subscribe({
      next: (broadcasts) => {
        this.broadcasts = this.sortNewestFirst(broadcasts);
        this.state = 'loaded';
      },
      error: (err: HttpErrorResponse) => {
        this.broadcasts = [];
        if (err.status === 404) {
          this.state = 'not-live';
        } else {
          this.state = 'error';
          this.loadErrorMessage = "Couldn't load broadcasts — try again in a moment.";
        }
      },
    });
  }

  retry(): void {
    this.load();
  }

  get canSubmit(): boolean {
    return this.title.trim().length > 0 && this.body.trim().length > 0 && !this.submitting;
  }

  submit(): void {
    if (!this.canSubmit) return;

    this.submitting = true;
    this.formError = '';
    const activeUntilIso = this.activeUntil ? new Date(this.activeUntil).toISOString() : null;

    this.broadcastsService
      .create({
        title: this.title.trim(),
        body: this.body.trim(),
        activeUntil: activeUntilIso,
      })
      .subscribe({
        next: (created) => {
          this.broadcasts = this.sortNewestFirst([created, ...this.broadcasts]);
          // A successful create proves the endpoint is live even if the
          // initial GET 404'd first (e.g. deploy landed mid-session).
          this.state = 'loaded';
          this.title = '';
          this.body = '';
          this.activeUntil = '';
          this.submitting = false;
        },
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          this.formError =
            err.status === 404
              ? "Broadcasts aren't live on the backend yet — try again after that ships."
              : "Couldn't publish that broadcast — try again in a moment.";
        },
      });
  }

  remove(broadcast: Broadcast): void {
    if (this.deletingId) return;
    const confirmed = window.confirm(`Delete "${broadcast.title}"? This cannot be undone.`);
    if (!confirmed) return;

    this.deletingId = broadcast.id;
    this.broadcastsService.delete(broadcast.id).subscribe({
      next: () => {
        this.broadcasts = this.broadcasts.filter((b) => b.id !== broadcast.id);
        this.deletingId = null;
      },
      error: () => {
        this.loadErrorMessage = "Couldn't delete that broadcast — try again in a moment.";
        this.deletingId = null;
      },
    });
  }

  humanDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '—';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  trackById(_index: number, broadcast: Broadcast): string {
    return broadcast.id;
  }

  private sortNewestFirst(broadcasts: Broadcast[]): Broadcast[] {
    return [...broadcasts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}
