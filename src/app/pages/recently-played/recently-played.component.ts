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

  // Filter state
  filterArtist = '';
  filterTrack = '';
  filterDateFrom = '';
  filterDateTo = '';
  filteredSessions: PlaySession[] = [];
  activeFilterCount = 0;

  // Active filter chips for display
  activeFilterChips: { label: string; key: string }[] = [];

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
          this.filteredSessions = this.sessions;
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

  // ─── Filters ──────────────────────────────────

  applyFilters(): void {
    const artistQuery = this.filterArtist.trim().toLowerCase();
    const trackQuery = this.filterTrack.trim().toLowerCase();
    const dateFrom = this.filterDateFrom ? new Date(this.filterDateFrom) : null;
    const dateTo = this.filterDateTo ? new Date(this.filterDateTo + 'T23:59:59') : null;

    this.filteredSessions = this.sessions
      .map((session) => {
        const filteredItems = session.items.filter((item) => {
          const matchArtist =
            !artistQuery ||
            item.track.artists.some((a) => a.name.toLowerCase().includes(artistQuery));
          const matchTrack =
            !trackQuery || item.track.name.toLowerCase().includes(trackQuery);
          const playedAt = new Date(item.played_at);
          const matchFrom = !dateFrom || playedAt >= dateFrom;
          const matchTo = !dateTo || playedAt <= dateTo;
          return matchArtist && matchTrack && matchFrom && matchTo;
        });
        return { ...session, items: filteredItems };
      })
      .filter((session) => session.items.length > 0);

    this.updateFilterChips();
  }

  clearFilters(): void {
    this.filterArtist = '';
    this.filterTrack = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filteredSessions = this.sessions;
    this.activeFilterCount = 0;
    this.activeFilterChips = [];
  }

  private updateFilterChips(): void {
    this.activeFilterChips = [];
    this.activeFilterCount = 0;

    if (this.filterArtist.trim()) {
      this.activeFilterChips.push({ label: `Artist: "${this.filterArtist.trim()}"`, key: 'artist' });
      this.activeFilterCount++;
    }
    if (this.filterTrack.trim()) {
      this.activeFilterChips.push({ label: `Track: "${this.filterTrack.trim()}"`, key: 'track' });
      this.activeFilterCount++;
    }
    if (this.filterDateFrom) {
      this.activeFilterChips.push({ label: `From: ${this.filterDateFrom}`, key: 'dateFrom' });
      this.activeFilterCount++;
    }
    if (this.filterDateTo) {
      this.activeFilterChips.push({ label: `To: ${this.filterDateTo}`, key: 'dateTo' });
      this.activeFilterCount++;
    }
  }

  removeChip(key: string): void {
    if (key === 'artist') this.filterArtist = '';
    if (key === 'track') this.filterTrack = '';
    if (key === 'dateFrom') this.filterDateFrom = '';
    if (key === 'dateTo') this.filterDateTo = '';
    this.applyFilters();
  }

  // ─── Stats ────────────────────────────────────

  private calculateStats(items: RecentlyPlayedItem[]): void {
    const trackIds = new Set(items.map((i) => i.track.id));
    const artistIds = new Set(
      items.reduce((acc: string[], i) => acc.concat(i.track.artists.map((a) => a.id)), [])
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
