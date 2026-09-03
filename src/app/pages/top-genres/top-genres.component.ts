import { Component, OnInit } from '@angular/core';
import { FriendDataService } from 'src/app/services/friend-data.service';
import { FriendsService, type Friend } from 'src/app/services/friends.service';
import { UserService } from 'src/app/services/user.service';
import { take } from 'rxjs';
import { ArtistService } from 'src/app/services/artist.service';
import {
  GenresService,
  GenreItem,
  GenreGroup,
} from 'src/app/services/genre.service';
import { ToastService } from 'src/app/services/toast.service';
import { TopItemsService } from 'src/app/services/top-items.service';

@Component({
  selector: 'app-top-genres-page',
  templateUrl: './top-genres.component.html',
  styleUrls: ['./top-genres.component.scss'],
})
export class TopGenresComponent implements OnInit {
  loading = true;
  transitioning = false;
  selectedTerm = 'short_term';
  viewMode: 'detailed' | 'grouped' = 'detailed';
  /** Soft warning surfaced when one or more Spotify ranges failed upstream. */
  partialWarning = '';

  // Detailed genres (weighted)
  genreList: GenreItem[] = [];
  private genresShortTerm: GenreItem[] = [];
  private genresMedTerm: GenreItem[] = [];
  private genresLongTerm: GenreItem[] = [];

  // Grouped genres
  groupedGenres: GenreGroup[] = [];
  private groupedShortTerm: GenreGroup[] = [];
  private groupedMedTerm: GenreGroup[] = [];
  private groupedLongTerm: GenreGroup[] = [];

  // Artists cache
  private artistsShortTerm: any[] = [];
  private artistsMedTerm: any[] = [];
  private artistsLongTerm: any[] = [];

  // Expanded genre groups (for showing sub-genres)
  expandedGroups: Set<string> = new Set();

  constructor(
    private artistService: ArtistService,
    private friendData: FriendDataService,
    private friendsService: FriendsService,
    private userService: UserService,
    private genreService: GenresService,
    private toastService: ToastService,
    private topItemsService: TopItemsService
  ) {}

  ngOnInit(): void {
    this.artistsShortTerm = this.artistService.getShortTermTopArtists();

    if (this.artistsShortTerm.length === 0) {
      this.loadTopArtists();
      this.loadFriends();
    } else {
      this.artistsMedTerm = this.artistService.getMedTermTopArtists();
      this.artistsLongTerm = this.artistService.getLongTermTopArtists();
      this.processGenres();
    }
  }

  // Friend scope. Genres are derived from artists here, so a friend's genres
  // come from their cached artists rather than a second call.
  showingFriends = false;
  selectedFriendEmail: string | null = null;
  friends: Friend[] = [];
  friendDataDenied = false;
  friendCacheCold = false;

  onScopeChange(showingFriends: boolean): void {
    this.showingFriends = showingFriends;
    this.loadTopArtists();
  }

  onFriendChange(email: string): void {
    this.selectedFriendEmail = email;
    this.loadTopArtists();
  }

  private loadFriends(): void {
    const email = this.userService.getEmail();
    if (!email) return;
    this.friendsService
      .getFriendsList(email)
      .pipe(take(1))
      .subscribe({
        next: (response) => (this.friends = response?.accepted ?? []),
        error: () => (this.friends = []),
      });
  }

  private loadFriendItems(email: string): void {
    this.loading = true;
    this.friendData
      .getTopItems(email)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          if (response?.cached !== true) {
            this.friendCacheCold = true;
            this.loading = false;
            return;
          }
          const byRange = (response.artists ?? {}) as Record<string, any[]>;
          this.artistsShortTerm = byRange['short_term'] ?? [];
          this.artistsMedTerm = byRange['medium_term'] ?? [];
          this.artistsLongTerm = byRange['long_term'] ?? [];
          this.loading = false;
        },
        error: () => {
          this.friendDataDenied = true;
          this.loading = false;
        },
      });
  }

  loadTopArtists(): void {
    this.friendDataDenied = false;
    this.friendCacheCold = false;

    if (this.showingFriends && this.selectedFriendEmail) {
      this.loadFriendItems(this.selectedFriendEmail);
      return;
    }

    this.loading = true;
    this.partialWarning = '';

    this.topItemsService
      .getTopItems()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const artists = response.data.artists;
          this.artistsShortTerm = artists.short_term ?? [];
          this.artistsMedTerm = artists.medium_term ?? [];
          this.artistsLongTerm = artists.long_term ?? [];

          this.artistService.setShortTermTopArtists(this.artistsShortTerm);
          this.artistService.setMedTermTopArtists(this.artistsMedTerm);
          this.artistService.setLongTermTopArtists(this.artistsLongTerm);

          const failed = response.data.meta?.failed_ranges ?? [];
          if (failed.length > 0) {
            this.partialWarning =
              'Some periods unavailable from Spotify — refresh in a moment.';
          }

          this.processGenres();
        },
        error: (err) => {
          console.error('Error fetching artists', err);
          this.toastService.showNegativeToast('Error loading genres');
          this.loading = false;
        },
      });
  }

  private processGenres(): void {
    // Process weighted genres for each term
    this.genresShortTerm = this.genreService.getTopGenres(
      this.artistsShortTerm,
      'short_term'
    );
    this.genresMedTerm = this.genreService.getTopGenres(
      this.artistsMedTerm,
      'medium_term'
    );
    this.genresLongTerm = this.genreService.getTopGenres(
      this.artistsLongTerm,
      'long_term'
    );

    // Process grouped genres for each term
    this.groupedShortTerm = this.genreService.getGroupedGenres(
      this.genresShortTerm,
      'short_term'
    );
    this.groupedMedTerm = this.genreService.getGroupedGenres(
      this.genresMedTerm,
      'medium_term'
    );
    this.groupedLongTerm = this.genreService.getGroupedGenres(
      this.genresLongTerm,
      'long_term'
    );

    // Set initial display data
    this.genreList = [...this.genresShortTerm];
    this.groupedGenres = [...this.groupedShortTerm];
    this.loading = false;
  }

  selectTerm(term: string): void {
    if (term === this.selectedTerm) return;

    this.selectedTerm = term;
    this.transitioning = true;

    setTimeout(() => {
      switch (term) {
        case 'short_term':
          this.genreList = [...this.genresShortTerm];
          this.groupedGenres = [...this.groupedShortTerm];
          break;
        case 'medium_term':
          this.genreList = [...this.genresMedTerm];
          this.groupedGenres = [...this.groupedMedTerm];
          break;
        case 'long_term':
          this.genreList = [...this.genresLongTerm];
          this.groupedGenres = [...this.groupedLongTerm];
          break;
      }
      this.transitioning = false;
    }, 300);
  }

  setViewMode(mode: 'detailed' | 'grouped'): void {
    if (mode === this.viewMode) return;

    this.transitioning = true;
    setTimeout(() => {
      this.viewMode = mode;
      this.expandedGroups.clear();
      this.transitioning = false;
    }, 200);
  }

  toggleGroupExpand(groupName: string): void {
    if (this.expandedGroups.has(groupName)) {
      this.expandedGroups.delete(groupName);
    } else {
      this.expandedGroups.add(groupName);
    }
  }

  isGroupExpanded(groupName: string): boolean {
    return this.expandedGroups.has(groupName);
  }

  // Format genre name for display (capitalize)
  formatGenreName(name: string): string {
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }


  // Get artists text (truncated if too many)
  getArtistsPreview(artists: string[], max: number = 3): string {
    if (artists.length <= max) {
      return artists.join(', ');
    }
    return artists.slice(0, max).join(', ') + ` +${artists.length - max} more`;
  }
}
