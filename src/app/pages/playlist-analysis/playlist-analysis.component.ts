import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  PlaylistAnalysisService,
  PlaylistAnalysis,
  TrackWithFeatures,
} from 'src/app/services/playlist-analysis.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-playlist-analysis',
  templateUrl: './playlist-analysis.component.html',
  styleUrls: ['./playlist-analysis.component.scss'],
})
export class PlaylistAnalysisComponent implements OnInit {
  loading = false;
  loadingPlaylists = true;
  error = '';

  playlists: any[] = [];
  selectedPlaylistId = '';
  analysis: PlaylistAnalysis | null = null;

  sortColumn: keyof TrackWithFeatures['features'] | 'name' | 'artists' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private analysisService: PlaylistAnalysisService,
    private playlistService: PlaylistService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPlaylists();
  }

  loadPlaylists(): void {
    this.loadingPlaylists = true;
    this.playlistService
      .getUserPlaylists(50, 0)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.playlists = res.items || [];
          if (this.playlists.length > 0) {
            this.selectedPlaylistId = this.playlists[0].id;
          }
          this.loadingPlaylists = false;
        },
        error: (err) => {
          console.error('Error loading playlists:', err);
          this.error = 'Failed to load your playlists.';
          this.loadingPlaylists = false;
        },
      });
  }

  analyze(): void {
    if (!this.selectedPlaylistId) return;
    this.loading = true;
    this.error = '';
    this.analysis = null;

    this.analysisService
      .analyzePlaylist(this.selectedPlaylistId)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.analysis = result;
          this.loading = false;
          if (result.tracks.length === 0) {
            this.toastService.showNegativeToast('No audio features found for this playlist.');
          }
        },
        error: (err) => {
          console.error('Error analyzing playlist:', err);
          this.error = 'Failed to analyze playlist. Please try again.';
          this.loading = false;
        },
      });
  }

  get sortedTracks(): TrackWithFeatures[] {
    if (!this.analysis) return [];
    return [...this.analysis.tracks].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (this.sortColumn === 'name' || this.sortColumn === 'artists') {
        valA = a[this.sortColumn].toLowerCase();
        valB = b[this.sortColumn].toLowerCase();
      } else {
        valA = a.features[this.sortColumn as keyof TrackWithFeatures['features']];
        valB = b.features[this.sortColumn as keyof TrackWithFeatures['features']];
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  setSort(col: string): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col as any;
      this.sortDirection = 'asc';
    }
  }

  getSortIcon(col: string): string {
    if (this.sortColumn !== col) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  formatPercent(val: number): string {
    return `${val}%`;
  }

  formatBpm(val: number): string {
    return `${val} BPM`;
  }

  getSelectedPlaylistName(): string {
    const pl = this.playlists.find((p) => p.id === this.selectedPlaylistId);
    return pl ? pl.name : '';
  }
}
