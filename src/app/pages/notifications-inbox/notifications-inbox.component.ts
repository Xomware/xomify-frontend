import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, take, takeUntil } from 'rxjs';

import {
  InboxNotification,
  NotificationsService,
} from 'src/app/services/notifications.service';
import { ToastService } from 'src/app/services/toast.service';

/**
 * The web notifications inbox.
 *
 * This is web's ONLY notification surface — the browser has no APNs
 * registration, so nothing here is push. The backend writes inbox rows
 * independently of push deliverability precisely so this page has content.
 */
@Component({
  selector: 'app-notifications-inbox',
  templateUrl: './notifications-inbox.component.html',
  styleUrls: ['./notifications-inbox.component.scss'],
})
export class NotificationsInboxComponent implements OnInit, OnDestroy {
  items: InboxNotification[] = [];
  loading = true;
  loadingMore = false;
  error = false;

  private cursor: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private notifications: NotificationsService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFirstPage();
    this.notifications.refreshUnreadCount().pipe(take(1)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** True once a further page exists. Drives the "Load more" button. */
  get hasMore(): boolean {
    return this.cursor !== null;
  }

  get hasUnread(): boolean {
    return this.items.some((item) => !item.read);
  }

  trackByTsId(_index: number, item: InboxNotification): string {
    return item.tsId;
  }

  loadFirstPage(): void {
    this.loading = true;
    this.error = false;
    this.notifications
      .getFeed()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.items = page.items;
          this.cursor = page.nextCursor;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = true;
        },
      });
  }

  loadMore(): void {
    if (!this.cursor || this.loadingMore) return;
    this.loadingMore = true;
    this.notifications
      .getFeed(25, this.cursor)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.items = [...this.items, ...page.items];
          this.cursor = page.nextCursor;
          this.loadingMore = false;
        },
        error: () => {
          this.loadingMore = false;
          this.toast.showNegativeToast('Could not load more notifications');
        },
      });
  }

  /**
   * Open a notification. Marks read optimistically — the row flips before the
   * request resolves, because a list that stays bold after you clicked it
   * reads as broken. A failed mark-read is not worth a toast; the next refresh
   * corrects it.
   */
  open(item: InboxNotification): void {
    if (!item.read) {
      item.read = true;
      this.notifications.markRead(item.tsId).pipe(take(1)).subscribe({
        error: () => {
          item.read = false;
        },
      });
    }

    const target = this.routeFor(item.route);
    if (target) this.router.navigate(target);
  }

  markAllRead(): void {
    if (!this.hasUnread) return;
    const previous = this.items.map((item) => item.read);
    this.items.forEach((item) => (item.read = true));

    this.notifications.markAllRead().pipe(take(1)).subscribe({
      error: () => {
        this.items.forEach((item, index) => (item.read = previous[index]));
        this.toast.showNegativeToast('Could not mark all as read');
      },
    });
  }

  /**
   * Translate a backend route token into an Angular route.
   *
   * The tokens are shared with iOS, where they resolve to native destinations,
   * so the same string has to mean different things on each client. Unknown
   * tokens return null and the row simply does not navigate — better than
   * routing into a 404.
   */
  private routeFor(route?: string): string[] | null {
    if (!route) return null;
    const [kind, value] = route.split(':');

    switch (kind) {
      case 'share':
        return value ? ['/share', value] : null;
      case 'friend':
        return value ? ['/friend', value] : null;
      case 'friends':
        return ['/friends'];
      case 'invite':
        return ['/invites'];
      case 'wrapped':
        return ['/wrapped'];
      case 'release_radar':
        return ['/release-radar'];
      case 'favorites':
        return ['/favorites'];
      case 'shares':
        return ['/shares'];
      case 'home':
        return ['/'];
      default:
        return null;
    }
  }
}
