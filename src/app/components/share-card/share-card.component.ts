import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import {
  ReactResponse,
  ReactionAction,
  Share,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { PlayerService } from 'src/app/services/player.service';
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

@Component({
  selector: 'app-share-card',
  templateUrl: './share-card.component.html',
  styleUrls: ['./share-card.component.scss'],
})
export class ShareCardComponent {
  @Input() share!: Share;
  @Output() reacted = new EventEmitter<{
    shareId: string;
    action: ReactionAction;
    rating?: number;
  }>();

  queuePending = false;
  ratingPending = false;
  menuOpen = false;

  constructor(
    private router: Router,
    private shareFeedService: ShareFeedService,
    private playerService: PlayerService,
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
    return this.share.email;
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
      this.playerService.playSong(this.share.trackId);
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
}
