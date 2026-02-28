import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { LikedArtistsPlaylistService, ArtistRelease, GeneratePlaylistOptions } from 'src/app/services/liked-artists-playlist.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-liked-artists-playlist-generator',
  templateUrl: './liked-artists-playlist-generator.component.html',
  styleUrls: ['./liked-artists-playlist-generator.component.scss'],
})
export class LikedArtistsPlaylistGeneratorComponent implements OnInit {
  // Loading states
  loadingReleases = false;
  generatingPlaylist = false;
  
  // Data
  allReleases: ArtistRelease[] = [];
  filteredReleases: ArtistRelease[] = [];
  availableGenres: string[] = [];
  dateRange: { min: Date; max: Date } | null = null;
  
  // Filter options
  selectedAlbumTypes = {
    album: true,
    single: true,
    appearsOn: false,
  };
  selectedGenres: string[] = [];
  releaseDateFrom: string = '';
  releaseDateTo: string = '';
  searchQuery: string = '';
  limitTracksInput: number = 50;
  
  // Playlist options
  playlistName: string = 'My Liked Artists Releases';
  playlistDescription: string = 'Auto-generated playlist from your liked artists\' latest releases';
  isPlaylistPublic: boolean = false;
  addXomifyLogo: boolean = true;
  
  // UI state
  showFilters = true;
  currentStep: 'load' | 'filter' | 'generate' = 'load';

  constructor(
    private likedArtistsService: LikedArtistsPlaylistService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadReleases();
  }

  /**
   * Load all releases from liked artists
   */
  loadReleases(): void {
    this.loadingReleases = true;
    this.currentStep = 'load';

    this.likedArtistsService
      .getAllLikedArtistsReleases(5)
      .pipe(take(1))
      .subscribe({
        next: (releases) => {
          this.allReleases = releases;
          this.filteredReleases = [...releases];
          this.availableGenres = this.likedArtistsService.getGenresFromReleases(releases);
          this.dateRange = this.likedArtistsService.getDateRangeFromReleases(releases);
          this.loadingReleases = false;
          this.currentStep = 'filter';

          if (releases.length === 0) {
            this.toastService.showNegativeToast('No releases found from your liked artists');
          } else {
            this.toastService.showPositiveToast(`Loaded ${releases.length} releases from your liked artists`);
          }
        },
        error: (err) => {
          console.error('Error loading releases', err);
          this.toastService.showNegativeToast('Error loading releases from your liked artists');
          this.loadingReleases = false;
        },
      });
  }

  /**
   * Apply filters to releases
   */
  applyFilters(): void {
    this.filteredReleases = this.likedArtistsService.filterReleases(
      this.allReleases,
      {
        albumTypes: this.selectedAlbumTypes,
        releaseDateFrom: this.releaseDateFrom ? new Date(this.releaseDateFrom) : undefined,
        releaseDateTo: this.releaseDateTo ? new Date(this.releaseDateTo) : undefined,
        genres: this.selectedGenres,
      }
    );

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      this.filteredReleases = this.filteredReleases.filter(
        (release) =>
          release.albumName.toLowerCase().includes(query) ||
          release.artistName.toLowerCase().includes(query)
      );
    }

    this.toastService.showPositiveToast(`Filtered to ${this.filteredReleases.length} releases`);
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.selectedAlbumTypes = {
      album: true,
      single: true,
      appearsOn: false,
    };
    this.selectedGenres = [];
    this.releaseDateFrom = '';
    this.releaseDateTo = '';
    this.searchQuery = '';
    this.applyFilters();
    this.toastService.showPositiveToast('Filters reset');
  }

  /**
   * Toggle album type filter
   */
  toggleAlbumType(type: 'album' | 'single' | 'appearsOn'): void {
    this.selectedAlbumTypes[type] = !this.selectedAlbumTypes[type];
    this.applyFilters();
  }

  /**
   * Toggle genre filter
   */
  toggleGenre(genre: string): void {
    const index = this.selectedGenres.indexOf(genre);
    if (index > -1) {
      this.selectedGenres.splice(index, 1);
    } else {
      this.selectedGenres.push(genre);
    }
    this.applyFilters();
  }

  /**
   * Check if genre is selected
   */
  isGenreSelected(genre: string): boolean {
    return this.selectedGenres.includes(genre);
  }

  /**
   * Generate the playlist
   */
  generatePlaylist(): void {
    if (this.filteredReleases.length === 0) {
      this.toastService.showNegativeToast('No releases match the selected filters');
      return;
    }

    this.generatingPlaylist = true;
    this.currentStep = 'generate';

    const options: GeneratePlaylistOptions = {
      name: this.playlistName,
      description: this.playlistDescription,
      isPublic: this.isPlaylistPublic,
      addXomifyLogo: this.addXomifyLogo,
      includeAlbumTypes: this.selectedAlbumTypes,
      releaseDateFilter: {
        from: this.releaseDateFrom ? new Date(this.releaseDateFrom) : undefined,
        to: this.releaseDateTo ? new Date(this.releaseDateTo) : undefined,
      },
      genreFilters: this.selectedGenres,
      limitTracks: this.limitTracksInput,
    };

    this.likedArtistsService
      .generatePlaylistFromOptions(this.filteredReleases, options)
      .pipe(take(1))
      .subscribe({
        next: (playlist) => {
          this.generatingPlaylist = false;
          this.toastService.showPositiveToast(`Playlist "${playlist.name}" created successfully!`);
          
          // Navigate to the new playlist
          setTimeout(() => {
            this.router.navigate(['/playlist', playlist.id]);
          }, 1500);
        },
        error: (err) => {
          console.error('Error generating playlist', err);
          this.toastService.showNegativeToast(`Error creating playlist: ${err.message}`);
          this.generatingPlaylist = false;
          this.currentStep = 'filter';
        },
      });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Get display count for album type
   */
  getAlbumTypeCount(type: 'album' | 'single' | 'appearsOn'): number {
    return this.filteredReleases.filter((r) => r.albumType === type).length;
  }

  /**
   * Reload releases
   */
  reloadReleases(): void {
    this.loadReleases();
  }

  /**
   * Check if generate playlist button should be disabled
   */
  isGenerateDisabled(): boolean {
    return this.filteredReleases.length === 0 || this.generatingPlaylist;
  }

  /**
   * Check if reload button should be disabled
   */
  isReloadDisabled(): boolean {
    return this.loadingReleases || this.generatingPlaylist;
  }

  /**
   * Format date for input[type="date"] min/max attributes
   */
  formatDateForInput(date: Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
