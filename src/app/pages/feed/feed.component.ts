import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import { ShareCardIdentity } from 'src/app/components/share-card/share-card.component';
import { FriendsService } from 'src/app/services/friends.service';
import { Group, GroupsService } from 'src/app/services/groups.service';
import {
  FeedQueryOptions,
  Share,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

const FEED_PAGE_SIZE = 25;

@Component({
  selector: 'app-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit {
  loading = true;
  refreshing = false;
  loadingMore = false;
  error: string | null = null;

  shares: Share[] = [];
  nextBefore: string | null = null;

  composerOpen = false;

  // Group filter — null means "all friends".
  groups: Group[] = [];
  activeGroupId: string | null = null;

  /**
   * Resolved display-name + avatar for every author the feed might surface.
   * Built from the viewer's own profile + accepted friends. Mirrors iOS
   * `FeedViewModel.identitiesByEmail`. Cards fall back to the email
   * local-part + a letter chip when an entry is missing.
   */
  identitiesByEmail: Record<string, ShareCardIdentity> = {};

  private currentEmail = '';

  constructor(
    private shareFeedService: ShareFeedService,
    private groupsService: GroupsService,
    private friendsService: FriendsService,
    private userService: UserService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.currentEmail = this.userService.getEmail();
    this.loadIdentities();
    this.loadGroups();
    this.loadFeed();
  }

  /**
   * Build `identitiesByEmail` from the viewer's own profile + their accepted
   * friends. Best-effort — a failure here just means cards fall back to
   * email-as-label and the letter chip avatar.
   */
  private loadIdentities(): void {
    const map: Record<string, ShareCardIdentity> = {};
    const selfEmail = this.userService.getEmail();
    if (selfEmail) {
      map[selfEmail] = {
        displayName: this.userService.getUserName() || selfEmail,
        avatar: this.userService.getProfilePic() || null,
      };
    }
    if (!selfEmail) {
      this.identitiesByEmail = map;
      return;
    }
    this.friendsService
      .getFriendsList(selfEmail)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          for (const friend of resp?.accepted ?? []) {
            const email = friend.friendEmail;
            if (!email) continue;
            map[email] = {
              displayName: friend.displayName || email,
              avatar: friend.avatar || null,
            };
          }
          this.identitiesByEmail = map;
        },
        error: () => {
          this.identitiesByEmail = map;
        },
      });
  }

  loadGroups(): void {
    if (!this.currentEmail) return;
    this.groupsService
      .getGroups(this.currentEmail)
      .pipe(take(1))
      .subscribe({
        next: (groups) => {
          this.groups = groups || [];
        },
        error: (err) => {
          // Non-fatal — feed still works; just skip filter chips.
          console.warn('Could not load groups for feed filter:', err);
        },
      });
  }

  selectGroup(groupId: string | null): void {
    if (this.activeGroupId === groupId) return;
    this.activeGroupId = groupId;
    this.nextBefore = null;
    this.shares = [];
    this.loadFeed();
  }

  trackByGroupId(_index: number, group: Group): string {
    return group.id;
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

    const opts: FeedQueryOptions = { limit: FEED_PAGE_SIZE };
    if (this.activeGroupId) opts.groupId = this.activeGroupId;

    this.shareFeedService
      .getFeed(this.currentEmail, opts)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.shares = response?.shares || [];
          this.nextBefore = response?.nextBefore ?? null;
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

  loadMore(): void {
    if (!this.nextBefore || this.loadingMore || !this.currentEmail) return;

    this.loadingMore = true;
    const before = this.nextBefore;

    const opts: FeedQueryOptions = {
      limit: FEED_PAGE_SIZE,
      before,
    };
    if (this.activeGroupId) opts.groupId = this.activeGroupId;

    this.shareFeedService
      .getFeed(this.currentEmail, opts)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const newShares = response?.shares || [];
          // De-dupe against whatever is already in the list (defensive against
          // overlap when backend cursor semantics change).
          const existing = new Set(this.shares.map((s) => s.shareId));
          for (const s of newShares) {
            if (!existing.has(s.shareId)) {
              this.shares.push(s);
            }
          }
          this.nextBefore = response?.nextBefore ?? null;
          this.loadingMore = false;
        },
        error: (err) => {
          console.error('Error loading more shares:', err);
          this.loadingMore = false;
          this.toastService.showNegativeToast('Could not load more');
        },
      });
  }

  refresh(): void {
    this.loadFeed(true);
  }

  trackByShareId(_index: number, share: Share): string {
    return share.shareId;
  }

  // ============================================
  // Composer
  // ============================================

  openComposer(): void {
    this.composerOpen = true;
  }

  closeComposer(): void {
    this.composerOpen = false;
  }

  onShareCreated(share: Share): void {
    this.composerOpen = false;
    // Prepend the new share so the user sees it immediately; backend feed is
    // authoritative on next refresh.
    this.shares = [share, ...this.shares];
    this.toastService.showPositiveToast('Shared to your feed');
  }
}
