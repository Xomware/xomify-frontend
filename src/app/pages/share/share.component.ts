import { Component, OnInit } from '@angular/core';
import { take, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ShareService, ShareableStats } from 'src/app/services/share.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrls: ['./share.component.scss'],
})
export class ShareComponent implements OnInit {
  loading = true;
  error = '';

  stats: ShareableStats = { topSongs: [], topArtists: [] };
  statsText = '';

  // Playlist share
  playlistSearchQuery = '';
  playlistSearchResults: any[] = [];
  playlistSearchLoading = false;
  selectedPlaylist: any = null;

  private searchSubject = new Subject<string>();

  constructor(
    private shareService: ShareService,
    private playlistService: PlaylistService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.setupSearch();
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length < 2) {
            this.playlistSearchLoading = false;
            return [];
          }
          this.playlistSearchLoading = true;
          return this.playlistService.getUserPlaylists(50, 0);
        })
      )
      .subscribe({
        next: (res: any) => {
          const query = this.playlistSearchQuery.toLowerCase();
          const items: any[] = res?.items || [];
          this.playlistSearchResults = items.filter((p) =>
            p.name?.toLowerCase().includes(query)
          );
          this.playlistSearchLoading = false;
        },
        error: () => {
          this.playlistSearchResults = [];
          this.playlistSearchLoading = false;
        },
      });
  }

  loadStats(): void {
    this.loading = true;
    this.error = '';

    this.shareService
      .getTopItems()
      .pipe(take(1))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.statsText = this.shareService.shareStats(stats);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading stats:', err);
          this.error = 'Failed to load your stats. Please try again.';
          this.loading = false;
        },
      });
  }

  async copyStats(): Promise<void> {
    const success = await this.shareService.copyToClipboard(this.statsText);
    if (success) {
      this.toastService.showPositiveToast('Stats copied to clipboard!');
    } else {
      this.toastService.showNegativeToast('Failed to copy');
    }
  }

  async copySongsSection(): Promise<void> {
    const text = this.stats.topSongs
      .slice(0, 5)
      .map((s, i) => `${i + 1}. ${s.name} — ${(s.artists || []).map((a: any) => a.name).join(', ')}`)
      .join('\n');
    const success = await this.shareService.copyToClipboard(`My Top Songs:\n${text}`);
    if (success) {
      this.toastService.showPositiveToast('Top songs copied!');
    } else {
      this.toastService.showNegativeToast('Failed to copy');
    }
  }

  async copyArtistsSection(): Promise<void> {
    const text = this.stats.topArtists
      .slice(0, 5)
      .map((a, i) => `${i + 1}. ${a.name}`)
      .join('\n');
    const success = await this.shareService.copyToClipboard(`My Top Artists:\n${text}`);
    if (success) {
      this.toastService.showPositiveToast('Top artists copied!');
    } else {
      this.toastService.showNegativeToast('Failed to copy');
    }
  }

  onPlaylistSearch(): void {
    this.selectedPlaylist = null;
    this.searchSubject.next(this.playlistSearchQuery);
  }

  selectPlaylist(playlist: any): void {
    this.selectedPlaylist = playlist;
    this.playlistSearchQuery = playlist.name;
    this.playlistSearchResults = [];
  }

  async copyPlaylistLink(): Promise<void> {
    if (!this.selectedPlaylist) return;
    const url = this.selectedPlaylist.external_urls?.spotify || '';
    const success = await this.shareService.copyToClipboard(url);
    if (success) {
      this.toastService.showPositiveToast('Playlist link copied!');
    } else {
      this.toastService.showNegativeToast('Failed to copy');
    }
  }

  sharePlaylist(): void {
    if (!this.selectedPlaylist) return;
    this.shareService.sharePlaylist(this.selectedPlaylist);
    this.toastService.showPositiveToast('Sharing playlist...');
  }

  hasWebShare(): boolean {
    return !!(navigator.share);
  }

  getArtistImage(artist: any): string {
    return artist?.images?.[0]?.url || 'assets/img/placeholder.png';
  }

  getAlbumArt(track: any): string {
    return track?.album?.images?.[0]?.url || 'assets/img/placeholder.png';
  }

  getArtistNames(track: any): string {
    return (track?.artists || []).map((a: any) => a.name).join(', ');
  }

  getPlaylistArt(playlist: any): string {
    return playlist?.images?.[0]?.url || 'assets/img/placeholder.png';
  }
}
