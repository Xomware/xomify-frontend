import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { ShareFriendRating } from 'src/app/services/share-feed.service';

/**
 * Drilldown modal opened from the "friends rated" stat tile on the share
 * detail page. Shows the average across all friend ratings up top, then one
 * row per friend with their stars + optional review.
 *
 * Mirrors `Xomify-iOS/Views/Feed/FriendsRatedListView.swift`.
 */
@Component({
  selector: 'app-friends-rated-list',
  templateUrl: './friends-rated-list.component.html',
  styleUrls: ['./friends-rated-list.component.scss'],
})
export class FriendsRatedListComponent {
  @Input() trackName = '';
  @Input() ratings: ShareFriendRating[] = [];
  /** nil when no friend has rated yet — drives the empty state copy. */
  @Input() average: number | null = null;

  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    // Only close when the click is on the backdrop itself, not the dialog.
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  trackByEmail(_index: number, rating: ShareFriendRating): string {
    return rating.email;
  }

  authorOf(rating: ShareFriendRating): string {
    return rating.displayName && rating.displayName.trim().length > 0
      ? rating.displayName
      : rating.email;
  }

  initialOf(rating: ShareFriendRating): string {
    return this.authorOf(rating).charAt(0).toUpperCase() || '?';
  }

  /** Round to integer for the 1-5 star summary chip. */
  starsFor(rating: ShareFriendRating): number {
    const value = Number(rating.rating ?? 0);
    if (!isFinite(value)) return 0;
    return Math.max(0, Math.min(5, Math.round(value)));
  }

  averageDisplay(): string {
    if (this.average === null || this.average === undefined) return '';
    return `${this.average.toFixed(1)} / 5`;
  }

  get countLabel(): string {
    return this.ratings.length === 1
      ? '1 friend rated this'
      : `${this.ratings.length} friends rated this`;
  }
}
