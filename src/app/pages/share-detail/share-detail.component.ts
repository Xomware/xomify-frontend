import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { ShareCardIdentity } from 'src/app/components/share-card/share-card.component';
import { FriendsService } from 'src/app/services/friends.service';
import {
  ReactionToggleResponse,
  Share,
  ShareFeedService,
  ShareFriendRating,
  ShareInteractionEntry,
  ShareReaction,
} from 'src/app/services/share-feed.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

const MOOD_LABELS: Record<string, string> = {
  hype: 'Hype',
  chill: 'Chill',
  sad: 'Sad',
  party: 'Party',
  focus: 'Focus',
  discovery: 'Discovery',
};

/**
 * Detail screen for a single feed share — pushed when the user taps a card
 * in the feed. Hero art + track header + sharer block + stats + reactions +
 * comments.
 *
 * Mirrors `Xomify-iOS/Views/Feed/ShareDetailView.swift`. Loads `/shares/detail`
 * on init so listener + friend-rating lists are always fresh; render shows a
 * loader until the first response lands.
 */
@Component({
  selector: 'app-share-detail',
  templateUrl: './share-detail.component.html',
  styleUrls: ['./share-detail.component.scss'],
})
export class ShareDetailComponent implements OnInit, OnDestroy {
  shareId = '';
  share: Share | null = null;
  interactions: ShareInteractionEntry[] = [];
  friendRatings: ShareFriendRating[] = [];

  loading = true;
  error: string | null = null;

  // Drilldown modal state
  ratedListOpen = false;
  queuedListOpen = false;

  // Reactions in-flight set, scoped to the detail page so the bar disables
  // individual emoji while the toggle round-trips.
  reactingSlugs = new Set<ShareReaction>();
  reactionError: string | null = null;

  /**
   * Resolved display-name + avatar for every author this page might surface.
   * Built from the viewer's own profile + accepted friends — same map shape
   * the feed cards use (`pages/feed/feed.component.ts:loadIdentities`). When
   * an entry is missing, `authorLabel` falls back to the email local-part
   * and the avatar falls back to the letter chip.
   */
  identitiesByEmail: Record<string, ShareCardIdentity> = {};

  private routeSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private shareFeedService: ShareFeedService,
    private toastService: ToastService,
    private userService: UserService,
    private friendsService: FriendsService,
  ) {}

  ngOnInit(): void {
    this.loadIdentities();
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('shareId') || '';
      if (id !== this.shareId) {
        this.shareId = id;
        this.loadDetail();
      }
    });
  }

  /**
   * Build `identitiesByEmail` from the viewer's own profile + their accepted
   * friends. Mirrors `FeedComponent.loadIdentities` so the same author shows
   * the same display name + avatar across feed and detail. Best-effort —
   * a failure here just means the header falls back to email-as-label.
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

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  // ============================================
  // Data
  // ============================================

  loadDetail(): void {
    if (!this.shareId) {
      this.loading = false;
      this.error = 'Missing share id.';
      return;
    }
    this.loading = true;
    this.error = null;

    this.shareFeedService
      .getShareDetail(this.shareId)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.share = resp.share;
          this.interactions = resp.interactions || [];
          this.friendRatings = resp.friendRatings || [];
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading share detail:', err);
          this.loading = false;
          this.error = 'Could not load this share.';
        },
      });
  }

  goBack(): void {
    // Prefer browser-history back when available so we land on the right feed
    // tab; fallback to the feed root for direct deep-links.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/feed']);
    }
  }

  openAuthor(): void {
    if (!this.share?.email) return;
    this.router.navigate(['/friend', this.share.email]);
  }

  // ============================================
  // Render helpers
  // ============================================

  /**
   * Resolved display label for the share author. Mirrors the share-card
   * fallback chain: friend's display name -> email local-part -> 'Friend'.
   * Stops the page from rendering "Shared by foo@gmail.com".
   */
  get authorLabel(): string {
    const email = this.share?.email?.trim() || '';
    const identity = email ? this.identitiesByEmail[email] : undefined;
    const name = identity?.displayName?.trim();
    if (name) return name;
    if (email) {
      const at = email.indexOf('@');
      return at > 0 ? email.slice(0, at) : email;
    }
    return 'Friend';
  }

  /** Resolved avatar URL for the author, or null to fall back to the letter chip. */
  get authorAvatarUrl(): string | null {
    const email = this.share?.email?.trim() || '';
    if (!email) return null;
    return this.identitiesByEmail[email]?.avatar?.trim() || null;
  }

  get authorInitial(): string {
    return (this.authorLabel.charAt(0) || '?').toUpperCase();
  }

  get relativeTime(): string {
    const ts = this.share?.sharedAt || this.share?.createdAt;
    if (!ts) return '';
    const created = new Date(ts).getTime();
    if (isNaN(created)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
    if (diffSec < 60) return 'just now';
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(day / 365)}y ago`;
  }

  get moodLabel(): string {
    if (!this.share?.moodTag) return '';
    return MOOD_LABELS[this.share.moodTag] || this.share.moodTag;
  }

  get genreTags(): string[] {
    return Array.isArray(this.share?.genreTags) ? this.share!.genreTags! : [];
  }

  get queuedCount(): number {
    return this.share?.queuedCount ?? 0;
  }

  get ratedCount(): number {
    return this.share?.ratedCount ?? 0;
  }

  get viewerHasQueued(): boolean {
    return this.share?.viewerHasQueued === true;
  }

  get viewerRating(): number | null {
    return this.share?.viewerRating ?? null;
  }

  get sharerRating(): number | null {
    return this.share?.sharerRating ?? null;
  }

  get reactionCounts(): Partial<Record<ShareReaction, number>> {
    return this.share?.reactionCounts || {};
  }

  get viewerReactions(): ShareReaction[] {
    return this.share?.viewerReactions || [];
  }

  get commentCount(): number {
    return this.share?.commentCount ?? 0;
  }

  get queuedFriends(): ShareInteractionEntry[] {
    return this.interactions.filter((i) => i.action === 'queued');
  }

  get sortedFriendRatings(): ShareFriendRating[] {
    // Newest-first by ratedAt; fall back to alphabetical by display name.
    const copy = [...this.friendRatings];
    copy.sort((a, b) => {
      const ta = a.ratedAt ? new Date(a.ratedAt).getTime() : 0;
      const tb = b.ratedAt ? new Date(b.ratedAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      const na = (a.displayName || a.email || '').toLowerCase();
      const nb = (b.displayName || b.email || '').toLowerCase();
      return na.localeCompare(nb);
    });
    return copy;
  }

  /** Average of all friend ratings (1-5). null when none — drives empty state. */
  get averageFriendRating(): number | null {
    if (this.friendRatings.length === 0) return null;
    const total = this.friendRatings.reduce(
      (sum, r) => sum + (Number(r.rating) || 0),
      0,
    );
    return total / this.friendRatings.length;
  }

  /** Pre-formatted "X.Y avg" sublabel for the rated tile. */
  get averageDisplay(): string {
    const avg = this.averageFriendRating;
    if (avg === null) return '';
    return `${avg.toFixed(1)} avg`;
  }

  get ratedTileLabel(): string {
    return this.ratedCount === 1 ? 'friend rated' : 'friends rated';
  }

  get queuedTileLabel(): string {
    return this.queuedCount === 1 ? 'friend queued' : 'friends queued';
  }

  get queuedFriendsCount(): number {
    return this.queuedFriends.length;
  }

  // ============================================
  // Drilldowns
  // ============================================

  openRatedList(): void {
    this.ratedListOpen = true;
  }

  closeRatedList(): void {
    this.ratedListOpen = false;
  }

  openQueuedList(): void {
    this.queuedListOpen = true;
  }

  closeQueuedList(): void {
    this.queuedListOpen = false;
  }

  // ============================================
  // Reactions
  // ============================================

  onReactionToggle(reaction: ShareReaction): void {
    if (!this.share) return;
    if (this.reactingSlugs.has(reaction)) return;

    const email = this.userService.getEmail();
    if (!email) {
      this.toastService.showNegativeToast('Sign in to react');
      return;
    }

    const previousCounts = { ...(this.share.reactionCounts || {}) };
    const previousViewer = [...(this.share.viewerReactions || [])];

    // Optimistic patch.
    const nextCounts = { ...previousCounts };
    const nextViewer = [...previousViewer];
    if (previousViewer.includes(reaction)) {
      const idx = nextViewer.indexOf(reaction);
      if (idx >= 0) nextViewer.splice(idx, 1);
      const next = Math.max(0, (nextCounts[reaction] ?? 0) - 1);
      if (next === 0) {
        delete nextCounts[reaction];
      } else {
        nextCounts[reaction] = next;
      }
    } else {
      nextViewer.push(reaction);
      nextCounts[reaction] = (nextCounts[reaction] ?? 0) + 1;
    }
    this.share.reactionCounts = nextCounts;
    this.share.viewerReactions = nextViewer;

    this.reactingSlugs.add(reaction);
    this.reactionError = null;

    this.shareFeedService
      .toggleReaction(this.share.shareId, reaction)
      .pipe(take(1))
      .subscribe({
        next: (resp: ReactionToggleResponse) => {
          // Trust server response — it just walked DDB for canonical counts.
          if (this.share) {
            this.share.reactionCounts = resp.counts || {};
            this.share.viewerReactions = resp.viewerReactions || [];
          }
          this.reactingSlugs.delete(reaction);
        },
        error: (err) => {
          console.error('Error toggling reaction:', err);
          // Rollback.
          if (this.share) {
            this.share.reactionCounts = previousCounts;
            this.share.viewerReactions = previousViewer;
          }
          this.reactingSlugs.delete(reaction);
          this.reactionError = 'Could not save reaction.';
          this.toastService.showNegativeToast('Could not save reaction');
        },
      });
  }

  onCommentCountChange(next: number): void {
    if (this.share) {
      this.share.commentCount = next;
    }
  }
}
