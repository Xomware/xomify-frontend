import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  Share,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit {
  loading = true;
  refreshing = false;
  error: string | null = null;

  shares: Share[] = [];
  totalCount = 0;

  private currentEmail = '';

  constructor(
    private shareFeedService: ShareFeedService,
    private userService: UserService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.currentEmail = this.userService.getEmail();
    this.loadFeed();
  }

  loadFeed(userInitiated = false): void {
    if (!this.currentEmail) {
      this.currentEmail = this.userService.getEmail();
    }

    if (!this.currentEmail) {
      this.loading = false;
      this.error = 'Sign in to view your feed.';
      return;
    }

    if (userInitiated) {
      this.refreshing = true;
    } else {
      this.loading = true;
    }
    this.error = null;

    this.shareFeedService
      .getFeed(this.currentEmail)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.shares = response?.shares || [];
          this.totalCount = response?.totalCount || this.shares.length;
          this.loading = false;
          this.refreshing = false;

          if (userInitiated) {
            this.toastService.showPositiveToast('Feed refreshed');
          }
        },
        error: (err) => {
          console.error('Error loading feed:', err);
          this.loading = false;
          this.refreshing = false;
          this.error = 'Failed to load feed. Please try again.';
          if (userInitiated) {
            this.toastService.showNegativeToast('Could not refresh feed');
          }
        },
      });
  }

  refresh(): void {
    this.loadFeed(true);
  }

  trackByShareId(_index: number, share: Share): string {
    return share.shareId;
  }
}
