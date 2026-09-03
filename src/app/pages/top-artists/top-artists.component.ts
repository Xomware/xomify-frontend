import { Component, OnInit } from '@angular/core';
import { FriendDataService } from 'src/app/services/friend-data.service';
import { FriendsService, type Friend } from 'src/app/services/friends.service';
import { UserService } from 'src/app/services/user.service';
import { take } from 'rxjs';
import { ArtistService } from 'src/app/services/artist.service';
import { ToastService } from 'src/app/services/toast.service';
import { TopItemsService } from 'src/app/services/top-items.service';

@Component({
  selector: 'app-top-artists-page',
  templateUrl: './top-artists.component.html',
  styleUrls: ['./top-artists.component.scss']
})
export class TopArtistsComponent implements OnInit {
  loading = true;
  transitioning = false;
  selectedTerm = 'short_term';
  displayedArtists: any[] = [];
  /** Soft warning surfaced when one or more Spotify ranges failed upstream. */
  partialWarning = '';

  private topArtistsShortTerm: any[] = [];
  private topArtistsMedTerm: any[] = [];
  private topArtistsLongTerm: any[] = [];

  constructor(
    private artistService: ArtistService,
    private friendData: FriendDataService,
    private friendsService: FriendsService,
    private userService: UserService,
    private toastService: ToastService,
    private topItemsService: TopItemsService
  ) {}

  ngOnInit(): void {
    const cached = this.artistService.getShortTermTopArtists();

    if (cached.length === 0) {
      this.loadTopArtists();
      this.loadFriends();
    } else {
      this.topArtistsShortTerm = cached;
      this.topArtistsMedTerm = this.artistService.getMedTermTopArtists();
      this.topArtistsLongTerm = this.artistService.getLongTermTopArtists();
      this.displayedArtists = [...this.topArtistsShortTerm];
      this.loading = false;
    }
  }

  // Friend scope. Friends' data comes from the backend's cached
  // /friends/top-items, never from Spotify — the backend does not fetch on
  // someone else's behalf, so viewing a friend cannot spend their quota.
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

  /**
   * `cached: false` is NOT a refusal — it means they have not loaded their own
   * top items yet. Kept separate from a denial so the copy can say so.
   */
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
          this.topArtistsShortTerm = byRange['short_term'] ?? [];
          this.topArtistsMedTerm = byRange['medium_term'] ?? [];
          this.topArtistsLongTerm = byRange['long_term'] ?? [];
          this.displayedArtists = [...this.topArtistsShortTerm];
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
          this.topArtistsShortTerm = artists.short_term ?? [];
          this.topArtistsMedTerm = artists.medium_term ?? [];
          this.topArtistsLongTerm = artists.long_term ?? [];

          this.artistService.setShortTermTopArtists(this.topArtistsShortTerm);
          this.artistService.setMedTermTopArtists(this.topArtistsMedTerm);
          this.artistService.setLongTermTopArtists(this.topArtistsLongTerm);

          this.displayedArtists = [...this.topArtistsShortTerm];

          const failed = response.data.meta?.failed_ranges ?? [];
          if (failed.length > 0) {
            this.partialWarning =
              'Some periods unavailable from Spotify — refresh in a moment.';
          }

          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching top artists', err);
          this.toastService.showNegativeToast('Error loading top artists');
          this.loading = false;
        },
      });
  }

  selectTerm(term: string): void {
    if (term === this.selectedTerm) return;
    
    this.selectedTerm = term;
    
    // Fade transition
    this.transitioning = true;
    
    setTimeout(() => {
      switch (term) {
        case 'short_term':
          this.displayedArtists = [...this.topArtistsShortTerm];
          break;
        case 'medium_term':
          this.displayedArtists = [...this.topArtistsMedTerm];
          break;
        case 'long_term':
          this.displayedArtists = [...this.topArtistsLongTerm];
          break;
      }
      this.transitioning = false;
    }, 300);
  }
}
