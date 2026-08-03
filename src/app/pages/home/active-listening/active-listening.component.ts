import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import {
  ListeningHistoryService,
  RecentlyPlayedItem,
} from 'src/app/services/listening-history.service';
import { pickAlbumImage } from 'src/app/utils/spotify-image.util';

/** `.listening-art` renders at 130px (108px on mobile) — needs at least the
 * 300px Spotify image, or the 64px thumbnail shows up visibly blurry. */
const ART_MIN_PX = 260;

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
    return pickAlbumImage(item.track.album?.images, ART_MIN_PX);
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
