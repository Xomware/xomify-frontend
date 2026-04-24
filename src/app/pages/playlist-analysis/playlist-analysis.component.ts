import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  PlaylistAnalysisService,
  PlaylistAnalysis,
  TrackSummary,
} from 'src/app/services/playlist-analysis.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { ToastService } from 'src/app/services/toast.service';

type SortColumn = 'name' | 'artists' | 'popularity' | 'durationMs' | 'releaseYear';

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

  sortColumn: SortColumn = 'name';
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
    this.error = '';
    this.playlistService
      .getUserPlaylists(50, 0)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.playlists = (res?.items || []).filter((p: any) => p != null);
          if (this.playlists.length > 0) {
            this.selectedPlaylistId = this.playlists[0].id;
          }
          this.loadingPlaylists = false;
        },
        error: (err) => {
          console.error('Error loading playlists:', err);
          const status = err?.status ? ` (${err.status})` : '';
          const detail = err?.error?.error?.message || err?.message || '';
          this.error = `Failed to load your playlists${status}${detail ? ': ' + detail : '.'}`;
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
          if (result.totalTracks === 0) {
            this.toastService.showNegativeToast('This playlist has no analyzable tracks.');
          }
        },
        error: (err) => {
          console.error('Error analyzing playlist:', err);
          this.error = 'Failed to analyze playlist. Please try again.';
          this.loading = false;
        },
      });
  }

  get sortedTracks(): TrackSummary[] {
    if (!this.analysis) return [];
    return [...this.analysis.tracks].sort((a, b) => {
      let valA: any = a[this.sortColumn];
      let valB: any = b[this.sortColumn];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  setSort(col: SortColumn): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }
  }

  getSortIcon(col: SortColumn): string {
    if (this.sortColumn !== col) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  getSelectedPlaylistName(): string {
    const pl = this.playlists.find((p) => p.id === this.selectedPlaylistId);
    return pl ? pl.name : '';
  }

  getExplicitPercent(): number {
    if (!this.analysis || this.analysis.totalTracks === 0) return 0;
    return Math.round((this.analysis.explicitCount / this.analysis.totalTracks) * 100);
  }
}
