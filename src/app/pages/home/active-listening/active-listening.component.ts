import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import {
  ListeningHistoryService,
  RecentlyPlayedItem,
} from 'src/app/services/listening-history.service';

/**
 * Recently-played strip for Home. Purely presentational — `@Input items`
 * (`null` while loading, `[]` once loaded-but-empty) is supplied by
 * HomeComponent, which owns the single `ListeningHistoryService` call this
 * page needs (avoids a duplicate fetch if the spotlight rotator also wants
 * the latest play).
 */
@Component({
  selector: 'app-home-active-listening',
  templateUrl: './active-listening.component.html',
  styleUrls: ['./active-listening.component.scss'],
})
export class ActiveListeningComponent {
  @Input() items: RecentlyPlayedItem[] | null = null;
  @Input() error = false;

  constructor(
    private listeningHistoryService: ListeningHistoryService,
    private router: Router,
  ) {}

  get displayItems(): RecentlyPlayedItem[] {
    return (this.items ?? []).slice(0, 8);
  }

  trackImage(item: RecentlyPlayedItem): string {
    const images = item.track.album?.images ?? [];
    if (images.length === 0) return '';
    return images[images.length - 1]?.url || images[0]?.url || '';
  }

  trackArtists(item: RecentlyPlayedItem): string {
    return (item.track.artists ?? []).map((a) => a.name).join(', ');
  }

  playedLabel(item: RecentlyPlayedItem): string {
    return this.listeningHistoryService.getRelativeTime(item.played_at);
  }

  trackByPlayedAt(_index: number, item: RecentlyPlayedItem): string {
    return `${item.played_at}-${item.track.id}`;
  }

  openTrack(item: RecentlyPlayedItem): void {
    const albumId = item.track.album?.id;
    if (albumId) {
      this.router.navigate(['/album', albumId]);
    }
  }
}
