import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, take } from 'rxjs/operators';
import {
  CollaborativePlaylistsService,
  CollaborativePlaylist,
  CollaborativeTrack,
} from 'src/app/services/collaborative-playlists.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-collaborative-playlists',
  templateUrl: './collaborative-playlists.component.html',
  styleUrls: ['./collaborative-playlists.component.scss'],
})
export class CollaborativePlaylistsComponent implements OnInit {
  loading = true;
  error = '';

  playlists: CollaborativePlaylist[] = [];
  expandedPlaylistId: string | null = null;
  expandedTracks: CollaborativeTrack[] = [];
  expandedPlaylistDetail: any = null;
  loadingTracks = false;

  // Add track modal state
  showAddModal = false;
  addingToPlaylistId = '';
  searchQuery = '';
  searchResults: any[] = [];
  searchLoading = false;
  addingTrack = false;

  private searchSubject = new Subject<string>();

  constructor(
    private collabService: CollaborativePlaylistsService,
    private playlistService: PlaylistService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPlaylists();
    this.setupSearch();
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length < 2) {
            this.searchLoading = false;
            return [];
          }
          this.searchLoading = true;
          return this.playlistService.searchTracks(query, 8);
        })
      )
      .subscribe({
        next: (res: any) => {
          this.searchResults = res?.tracks?.items || [];
          this.searchLoading = false;
        },
        error: () => {
          this.searchResults = [];
          this.searchLoading = false;
        },
      });
  }

  loadPlaylists(): void {
    this.loading = true;
    this.error = '';

    this.collabService
      .getCollaborativePlaylists()
      .pipe(take(1))
      .subscribe({
        next: (playlists) => {
          this.playlists = playlists;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading collaborative playlists:', err);
          this.error = 'Failed to load playlists. Please try again.';
          this.loading = false;
        },
      });
  }

  togglePlaylist(playlist: CollaborativePlaylist): void {
    if (this.expandedPlaylistId === playlist.id) {
      this.expandedPlaylistId = null;
      this.expandedTracks = [];
      this.expandedPlaylistDetail = null;
      return;
    }

    this.expandedPlaylistId = playlist.id;
    this.expandedTracks = [];
    this.loadingTracks = true;

    this.collabService
      .getPlaylistWithTracks(playlist.id)
      .pipe(take(1))
      .subscribe({
        next: ({ playlist: detail, tracks }) => {
          this.expandedPlaylistDetail = detail;
          this.expandedTracks = tracks;
          this.loadingTracks = false;
        },
        error: (err) => {
          console.error('Error loading tracks:', err);
          this.toastService.showNegativeToast('Failed to load tracks');
          this.loadingTracks = false;
        },
      });
  }

  openAddModal(playlistId: string, event: Event): void {
    event.stopPropagation();
    this.addingToPlaylistId = playlistId;
    this.showAddModal = true;
    this.searchQuery = '';
    this.searchResults = [];
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.addingToPlaylistId = '';
    this.searchQuery = '';
    this.searchResults = [];
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  addTrack(track: any): void {
    if (!this.addingToPlaylistId || this.addingTrack) return;
    this.addingTrack = true;

    this.collabService
      .addTrackToPlaylist(this.addingToPlaylistId, track.uri)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.toastService.showPositiveToast(`Added "${track.name}" to playlist`);
          this.addingTrack = false;
          this.closeAddModal();

          // Refresh expanded tracks if this is the expanded playlist
          if (this.expandedPlaylistId === this.addingToPlaylistId) {
            // Re-fetch
          }
        },
        error: () => {
          this.toastService.showNegativeToast('Failed to add track');
          this.addingTrack = false;
        },
      });
  }

  getPlaylistArt(playlist: CollaborativePlaylist): string {
    return playlist.images?.[0]?.url || 'assets/img/placeholder.png';
  }

  getAlbumArt(track: CollaborativeTrack): string {
    return track.track?.album?.images?.[0]?.url || 'assets/img/placeholder.png';
  }

  getArtistNames(track: CollaborativeTrack): string {
    return (track.track?.artists || []).map((a) => a.name).join(', ');
  }

  getSearchAlbumArt(track: any): string {
    return track?.album?.images?.[0]?.url || 'assets/img/placeholder.png';
  }

  getSearchArtists(track: any): string {
    return (track?.artists || []).map((a: any) => a.name).join(', ');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
}
