import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  ListeningHistoryService,
  RecentlyPlayedItem,
  PlaySession,
} from 'src/app/services/listening-history.service';
import { PlayerService } from 'src/app/services/player.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-recently-played',
  templateUrl: './recently-played.component.html',
  styleUrls: ['./recently-played.component.scss'],
})
export class RecentlyPlayedComponent implements OnInit {
  loading = true;
  error = '';
  sessions: PlaySession[] = [];
  allItems: RecentlyPlayedItem[] = [];

  // Stats
  uniqueTracks = 0;
  uniqueArtists = 0;
  timeSpan = '';

  constructor(
    private historyService: ListeningHistoryService,
    private playerService: PlayerService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading = true;
    this.error = '';

    this.historyService
      .getRecentlyPlayed()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.allItems = response.items;
          this.sessions = this.historyService.groupIntoSessions(response.items);
          this.calculateStats(response.items);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading recently played:', err);
          this.error = 'Failed to load listening history. Please try again.';
          this.loading = false;
        },
      });
  }

  refresh(): void {
    this.historyService.clearCache();
    this.loadHistory();
  }

  private calculateStats(items: RecentlyPlayedItem[]): void {
    const trackIds = new Set(items.map((i) => i.track.id));
    const artistIds = new Set(
      items.flatMap((i) => i.track.artists.map((a) => a.id))
    );
    this.uniqueTracks = trackIds.size;
    this.uniqueArtists = artistIds.size;

    if (items.length > 0) {
      const dates = items.map((i) => new Date(i.played_at));
      const oldest = new Date(Math.min(...dates.map((d) => d.getTime())));
      const newest = new Date(Math.max(...dates.map((d) => d.getTime())));
      const diffMs = newest.getTime() - oldest.getTime();
      const diffHr = Math.floor(diffMs / 3600000);
      const diffMin = Math.floor((diffMs % 3600000) / 60000);

      if (diffHr > 24) {
        const days = Math.floor(diffHr / 24);
        this.timeSpan = `${days} day${days !== 1 ? 's' : ''}`;
      } else if (diffHr > 0) {
        this.timeSpan = `${diffHr}h ${diffMin}m`;
      } else {
        this.timeSpan = `${diffMin} min`;
      }
    }
  }

  addToQueue(item: RecentlyPlayedItem, event: Event): void {
    event.stopPropagation();
    this.playerService
      .addToSpotifyQueue(item.track.id)
      .pipe(take(1))
      .subscribe({
        next: (success) => {
          if (success) {
            this.toastService.showPositiveToast(
              `"${item.track.name}" added to queue`
            );
          } else {
            this.toastService.showNegativeToast('Failed to add to queue');
          }
        },
        error: () => {
          this.toastService.showNegativeToast('Failed to add to queue');
        },
      });
  }

  openSpotify(url: string, event: Event): void {
    event.stopPropagation();
    window.open(url, '_blank');
  }

  getAlbumArt(item: RecentlyPlayedItem): string {
    const images = item.track.album.images;
    if (images && images.length > 0) {
      // Prefer smallest image for list display
      const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
      return sorted[0].url;
    }
    return 'assets/img/placeholder.png';
  }

  getRelativeTime(playedAt: string): string {
    return this.historyService.getRelativeTime(playedAt);
  }

  getArtistNames(item: RecentlyPlayedItem): string {
    return item.track.artists.map((a) => a.name).join(', ');
  }
}
