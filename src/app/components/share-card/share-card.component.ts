import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import {
  ReactionAction,
  Share,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { ShareService } from 'src/app/services/share.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

type ReactionKind = 'fire' | 'love' | 'like';

interface ReactionButton {
  action: ReactionKind;
  emoji: string;
  label: string;
}

@Component({
  selector: 'app-share-card',
  templateUrl: './share-card.component.html',
  styleUrls: ['./share-card.component.scss'],
})
export class ShareCardComponent {
  @Input() share!: Share;
  @Output() reacted = new EventEmitter<{ shareId: string; action: ReactionAction }>();

  // Local optimistic copies of the counts + which reaction this user is showing
  // Note: backend doesn't yet return the viewer's current reaction, so we track
  // the last action this user clicked in this session only.
  private myReaction: ReactionKind | null = null;
  reactionPending = false;

  readonly reactions: ReactionButton[] = [
    { action: 'fire', emoji: '🔥', label: 'Fire' },
    { action: 'love', emoji: '❤️', label: 'Love' },
    { action: 'like', emoji: '👍', label: 'Like' },
  ];

  constructor(
    private router: Router,
    private shareFeedService: ShareFeedService,
    private shareService: ShareService,
    private toastService: ToastService,
    private userService: UserService,
  ) {}

  // ============================================
  // Render helpers
  // ============================================

  get authorLabel(): string {
    return this.share.payload?.displayName || this.share.email;
  }

  get relativeTime(): string {
    const created = new Date(this.share.createdAt).getTime();
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

  get monthYearLabel(): string {
    const p = this.share.payload || {};
    if (p.monthYear) return p.monthYear;
    if (p.month && p.year) return `${p.month} ${p.year}`;
    return '';
  }

  get weekLabel(): string {
    return this.share.payload?.weekLabel || this.share.payload?.weekKey || '';
  }

  get topTracks(): Array<{ name: string; artists?: string[] }> {
    const items = this.share.payload?.topTracks;
    return Array.isArray(items) ? items : [];
  }

  get topReleases(): Array<{ name: string; artist?: string }> {
    const items = this.share.payload?.topReleases;
    return Array.isArray(items) ? items : [];
  }

  get trackName(): string {
    return this.share.payload?.name || '';
  }

  get trackArtist(): string {
    const artists = this.share.payload?.artists;
    if (Array.isArray(artists)) return artists.join(', ');
    return this.share.payload?.artist || '';
  }

  get trackImage(): string | null {
    return (
      this.share.payload?.albumArt ||
      this.share.payload?.image ||
      this.share.payload?.album?.images?.[0]?.url ||
      null
    );
  }

  get playlistName(): string {
    return this.share.payload?.playlistName || this.share.payload?.name || '';
  }

  get playlistCover(): string | null {
    return (
      this.share.payload?.cover ||
      this.share.payload?.image ||
      this.share.payload?.images?.[0]?.url ||
      null
    );
  }

  get playlistTrackCount(): number {
    const n =
      this.share.payload?.trackCount ?? this.share.payload?.tracks?.total;
    return typeof n === 'number' ? n : 0;
  }

  getCount(action: ReactionKind): number {
    return this.share.interactionCounts?.[action] || 0;
  }

  isActive(action: ReactionKind): boolean {
    return this.myReaction === action;
  }

  // ============================================
  // Actions
  // ============================================

  reactOrToggle(action: ReactionKind): void {
    if (this.reactionPending) return;

    const email = this.userService.getEmail();
    if (!email) {
      this.toastService.showNegativeToast('Sign in to react');
      return;
    }

    const wasActive = this.myReaction === action;
    const nextAction: ReactionAction = wasActive ? 'none' : action;
    const previousReaction = this.myReaction;

    // Optimistic update
    if (!this.share.interactionCounts) {
      this.share.interactionCounts = {};
    }
    if (wasActive) {
      this.share.interactionCounts[action] = Math.max(
        0,
        (this.share.interactionCounts[action] || 0) - 1,
      );
      this.myReaction = null;
    } else {
      // If another reaction was active, decrement it
      if (previousReaction) {
        this.share.interactionCounts[previousReaction] = Math.max(
          0,
          (this.share.interactionCounts[previousReaction] || 0) - 1,
        );
      }
      this.share.interactionCounts[action] =
        (this.share.interactionCounts[action] || 0) + 1;
      this.myReaction = action;
    }

    this.reactionPending = true;

    this.shareFeedService
      .reactToShare(this.share.shareId, email, nextAction)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.reactionPending = false;
          this.reacted.emit({ shareId: this.share.shareId, action: nextAction });
        },
        error: (err) => {
          console.error('Error reacting to share:', err);
          // Revert optimistic update
          if (wasActive) {
            this.share.interactionCounts[action] =
              (this.share.interactionCounts[action] || 0) + 1;
            this.myReaction = action;
          } else {
            this.share.interactionCounts[action] = Math.max(
              0,
              (this.share.interactionCounts[action] || 0) - 1,
            );
            if (previousReaction) {
              this.share.interactionCounts[previousReaction] =
                (this.share.interactionCounts[previousReaction] || 0) + 1;
            }
            this.myReaction = previousReaction;
          }
          this.reactionPending = false;
          this.toastService.showNegativeToast('Could not save reaction');
        },
      });
  }

  async shareLink(): Promise<void> {
    const profileUrl = `${window.location.origin}/friend/${encodeURIComponent(
      this.share.email,
    )}`;
    const shared = await this.shareService.share({
      title: `${this.authorLabel} on Xomify`,
      text: this.share.caption || '',
      url: profileUrl,
    });
    this.toastService.showPositiveToast(
      shared ? 'Shared!' : 'Copied to clipboard',
    );
  }

  onCardTargetClick(): void {
    switch (this.share.type) {
      case 'wrapped':
        this.router.navigate(['/wrapped']);
        break;
      case 'release_radar':
        this.router.navigate(['/release-radar']);
        break;
      default:
        break;
    }
  }
}
