import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import {
  ReactResponse,
  ReactionAction,
  ReactionToggleResponse,
  Share,
  ShareFeedService,
  ShareReaction,
} from 'src/app/services/share-feed.service';
import { PreviewPlayerService } from 'src/app/services/preview-player.service';
import { ShareService } from 'src/app/services/share.service';
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
 * Resolved identity for a share's author. Built by the parent feed component
 * from the friends list + the viewer's own profile and passed in so each
 * card renders the friend's real display name + avatar instead of the raw
 * email. Mirrors iOS `SharerIdentity` in `FeedViewModel.swift`.
 */
export interface ShareCardIdentity {
  displayName: string;
  avatar: string | null;
}

@Component({
  selector: 'app-share-card',
  templateUrl: './share-card.component.html',
  styleUrls: ['./share-card.component.scss'],
})
export class ShareCardComponent {
  @Input() share!: Share;
  @Input() identity?: ShareCardIdentity;
  @Output() reacted = new EventEmitter<{
    shareId: string;
    action: ReactionAction;
    rating?: number;
  }>();
  /**
   * Emitted after the viewer (the share author) successfully deletes their
   * own share. The parent feed listens for this so it can drop the card
   * from `shares` without a full reload. Mirrors iOS `TrackActionsMenu`
   * delete callback.
   */
  @Output() deleted = new EventEmitter<string>();

  queuePending = false;
  ratingPending = false;
  deletePending = false;
  menuOpen = false;

  /** Slugs currently in flight on the reactions row, scoped per card. */
  reactingSlugs = new Set<ShareReaction>();

  constructor(
    private router: Router,
    private shareFeedService: ShareFeedService,
    private previewPlayer: PreviewPlayerService,
    private shareService: ShareService,
    private toastService: ToastService,
    private userService: UserService,
  ) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.menuOpen) {
      this.menuOpen = false;
    }
  }

  // ============================================
  // Render helpers
  // ============================================

  get authorLabel(): string {
    const name = this.identity?.displayName?.trim();
    if (name) return name;
    // Fall back to the local-part of the email so the header isn't an
    // ugly full address. e.g. dominickj.giordano@gmail.com -> dominickj.giordano
    const email = this.share.email?.trim() || '';
    if (email) {
      const at = email.indexOf('@');
      return at > 0 ? email.slice(0, at) : email;
    }
    // Ultimate fallback so the row is never visually empty (which on the
    // feed looked like the avatar + timestamp had no person attached at all).
    return 'Friend';
  }

  /** Resolved avatar URL for the author, or `null` to fall back to the letter chip. */
  get authorAvatarUrl(): string | null {
    return this.identity?.avatar?.trim() || null;
  }

  /** First letter of `authorLabel` for the fallback avatar chip. */
  get authorInitial(): string {
    const label = this.authorLabel;
    return label ? label.charAt(0).toUpperCase() : '?';
  }

  get relativeTime(): string {
    const ts = this.share.sharedAt || this.share.createdAt;
    const created = new Date(ts).getTime();
    if (isNaN(created)) return '';
    const diffMs = Date.now() - created;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.floor(day / 365);
    return `${yr}y ago`;
  }

  get moodLabel(): string {
    if (!this.share.moodTag) return '';
    return MOOD_LABELS[this.share.moodTag] || this.share.moodTag;
  }

  get genreTags(): string[] {
    return Array.isArray(this.share.genreTags) ? this.share.genreTags : [];
  }

  get queuedCount(): number {
    return this.share.queuedCount ?? 0;
  }

  get ratedCount(): number {
    return this.share.ratedCount ?? 0;
  }

  get viewerHasQueued(): boolean {
    return this.share.viewerHasQueued === true;
  }

  get viewerRating(): number {
    return this.share.viewerRating ?? 0;
  }

  get commentCount(): number {
    return this.share.commentCount ?? 0;
  }

  get reactionCounts(): Partial<Record<ShareReaction, number>> {
    return this.share.reactionCounts || {};
  }

  get viewerReactions(): ShareReaction[] {
    return this.share.viewerReactions || [];
  }

  /**
   * True when the signed-in viewer is the share's author. Drives the
   * `Delete share` menu item visibility (mirrors iOS `TrackActionsMenu`).
   */
  get viewerIsAuthor(): boolean {
    const viewer = this.userService.getEmail();
    if (!viewer) return false;
    return this.share?.email === viewer;
  }

  // ============================================
  // Actions
  // ============================================

  toggleQueue(): void {
    if (this.queuePending) return;

    const email = this.userService.getEmail();
    if (!email) {
      this.toastService.showNegativeToast('Sign in to queue');
      return;
    }

    const wasQueued = this.viewerHasQueued;
    const nextAction: ReactionAction = wasQueued ? 'unqueued' : 'queued';

    // Optimistic update
    const prevQueuedCount = this.queuedCount;
    this.share.viewerHasQueued = !wasQueued;
    this.share.queuedCount = Math.max(
      0,
      prevQueuedCount + (wasQueued ? -1 : 1),
    );
    this.queuePending = true;

    this.shareFeedService
      .reactToShare(email, this.share.shareId, nextAction)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.applyEnrichment(resp);
          this.queuePending = false;
          this.reacted.emit({
            shareId: this.share.shareId,
            action: nextAction,
          });
        },
        error: (err) => {
          console.error('Error toggling queue:', err);
          // Rollback
          this.share.viewerHasQueued = wasQueued;
          this.share.queuedCount = prevQueuedCount;
          this.queuePending = false;
          this.toastService.showNegativeToast('Could not save queue');
        },
      });
  }

  onRatingChange(rating: number): void {
    if (this.ratingPending) return;

    const email = this.userService.getEmail();
    if (!email) {
      this.toastService.showNegativeToast('Sign in to rate');
      return;
    }

    // Treat picking the same rating as "clear" — backend supports `unrated`.
    const prevRating = this.viewerRating;
    const prevRatedCount = this.ratedCount;
    const isClear = rating === prevRating || rating <= 0;

    const nextAction: ReactionAction = isClear ? 'unrated' : 'rated';
    const nextRating = isClear ? 0 : rating;

    // Optimistic
    this.share.viewerRating = nextRating || null;
    if (isClear && prevRating) {
      this.share.ratedCount = Math.max(0, prevRatedCount - 1);
    } else if (!isClear && !prevRating) {
      this.share.ratedCount = prevRatedCount + 1;
    }
    this.ratingPending = true;

    this.shareFeedService
      .reactToShare(
        email,
        this.share.shareId,
        nextAction,
        nextAction === 'rated' ? nextRating : undefined,
      )
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.applyEnrichment(resp);
          this.ratingPending = false;
          this.reacted.emit({
            shareId: this.share.shareId,
            action: nextAction,
            rating: nextAction === 'rated' ? nextRating : undefined,
          });
        },
        error: (err) => {
          console.error('Error saving rating:', err);
          // Rollback
          this.share.viewerRating = prevRating || null;
          this.share.ratedCount = prevRatedCount;
          this.ratingPending = false;
          this.toastService.showNegativeToast('Could not save rating');
        },
      });
  }

  private applyEnrichment(resp: ReactResponse): void {
    this.share.queuedCount = resp.queuedCount;
    this.share.ratedCount = resp.ratedCount;
    this.share.viewerHasQueued = resp.viewerHasQueued;
    this.share.viewerRating = resp.viewerRating;
    this.share.sharerRating = resp.sharerRating;
  }

  // ============================================
  // Kebab menu
  // ============================================

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  menuPlay(): void {
    this.menuOpen = false;
    if (this.share.trackId) {
      this.previewPlayer.toggle({
        id: this.share.trackId,
        title: this.share.trackName,
        artist: this.share.artistName,
      });
    }
  }

  menuQueue(): void {
    this.menuOpen = false;
    this.toggleQueue();
  }

  menuSharePostLink(): void {
    this.menuOpen = false;
    this.shareLink();
  }

  menuOpenInSpotify(): void {
    this.menuOpen = false;
    const url = this.share.trackUri
      ? `https://open.spotify.com/track/${this.share.trackId}`
      : '';
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  /**
   * Delete the viewer's own share. Owner-only at the UI (`viewerIsAuthor`)
   * AND backend (`shares_delete` 403s anyone else). Confirms before issuing
   * the DELETE — there's no undo. Emits `deleted` so the parent feed can
   * drop the card without a full refresh.
   */
  menuDelete(): void {
    this.menuOpen = false;
    if (this.deletePending) return;
    if (!this.viewerIsAuthor) return;
    if (!this.share?.shareId) return;

    const ok = window.confirm(
      'Delete this share? This cannot be undone.',
    );
    if (!ok) return;

    this.deletePending = true;

    this.shareFeedService
      .deleteShare(this.share.shareId, this.share.sharedAt)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.deletePending = false;
          this.toastService.showPositiveToast('Share deleted');
          this.deleted.emit(this.share.shareId);
        },
        error: (err) => {
          console.error('Error deleting share:', err);
          this.deletePending = false;
          this.toastService.showNegativeToast('Could not delete share');
        },
      });
  }

  async shareLink(): Promise<void> {
    const profileUrl = `${window.location.origin}/friend/${encodeURIComponent(
      this.share.email,
    )}`;
    const shared = await this.shareService.share({
      title: `${this.authorLabel} on Xomify`,
      text: this.share.caption || this.share.trackName,
      url: profileUrl,
    });
    this.toastService.showPositiveToast(
      shared ? 'Shared!' : 'Copied to clipboard',
    );
  }

  openAuthor(): void {
    if (!this.share.email) return;
    this.router.navigate(['/friend', this.share.email]);
  }

  /**
   * Navigate to the share-detail page. Triggered by the card body tap-zone
   * (header + track + caption + tags) and by the comment-count chip — mirrors
   * iOS `ShareCardView.swift:116-125`. The action footer (kebab, ratings,
   * reactions) is intentionally NOT inside the tap target.
   */
  openDetail(): void {
    if (!this.share.shareId) return;
    this.router.navigate(['/share', this.share.shareId]);
  }

  /**
   * Toggle one emoji reaction. Optimistic patch (counts + viewerReactions),
   * server response replaces local state, rollback on error.
   */
  onReactionToggle(reaction: ShareReaction): void {
    if (!this.share || this.reactingSlugs.has(reaction)) return;

    const email = this.userService.getEmail();
    if (!email) {
      this.toastService.showNegativeToast('Sign in to react');
      return;
    }

    const previousCounts: Partial<Record<ShareReaction, number>> = {
      ...(this.share.reactionCounts || {}),
    };
    const previousViewer: ShareReaction[] = [
      ...(this.share.viewerReactions || []),
    ];

    // Optimistic patch.
    const nextCounts: Partial<Record<ShareReaction, number>> = { ...previousCounts };
    const nextViewer: ShareReaction[] = [...previousViewer];
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

    this.shareFeedService
      .toggleReaction(this.share.shareId, reaction)
      .pipe(take(1))
      .subscribe({
        next: (resp: ReactionToggleResponse) => {
          this.share.reactionCounts = resp.counts || {};
          this.share.viewerReactions = resp.viewerReactions || [];
          this.reactingSlugs.delete(reaction);
        },
        error: (err) => {
          console.error('Error toggling reaction:', err);
          // Rollback.
          this.share.reactionCounts = previousCounts;
          this.share.viewerReactions = previousViewer;
          this.reactingSlugs.delete(reaction);
          this.toastService.showNegativeToast('Could not save reaction');
        },
      });
  }
}
