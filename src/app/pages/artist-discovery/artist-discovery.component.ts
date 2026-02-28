import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import {
  ArtistDiscoveryService,
  SpotifyArtist,
  DiscoveryArtist,
} from 'src/app/services/artist-discovery.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-artist-discovery',
  templateUrl: './artist-discovery.component.html',
  styleUrls: ['./artist-discovery.component.scss'],
})
export class ArtistDiscoveryComponent implements OnInit {
  loading = true;
  error = '';

  seedArtists: SpotifyArtist[] = [];
  discoveredArtists: DiscoveryArtist[] = [];

  constructor(
    private discoveryService: ArtistDiscoveryService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadDiscovery();
  }

  loadDiscovery(): void {
    this.loading = true;
    this.error = '';

    this.discoveryService
      .loadDiscovery()
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.seedArtists = result.seeds;
          this.discoveredArtists = result.discovered;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading artist discovery:', err);
          this.error = 'Failed to load artist discovery. Please try again.';
          this.loading = false;
        },
      });
  }

  refresh(): void {
    this.discoveryService.clearCache();
    this.seedArtists = [];
    this.discoveredArtists = [];
    this.loadDiscovery();
  }

  goToArtist(artist: DiscoveryArtist): void {
    this.router.navigate(['/artist-profile', artist.id]);
  }

  toggleFollow(artist: DiscoveryArtist, event: Event): void {
    event.stopPropagation();
    if (artist.followLoading) return;

    artist.followLoading = true;

    const action$ = artist.isFollowing
      ? this.discoveryService.unfollowArtist(artist.id)
      : this.discoveryService.followArtist(artist.id);

    action$.pipe(take(1)).subscribe({
      next: () => {
        artist.isFollowing = !artist.isFollowing;
        artist.followLoading = false;
        const msg = artist.isFollowing
          ? `Following ${artist.name}`
          : `Unfollowed ${artist.name}`;
        this.toastService.showPositiveToast(msg);
        // Invalidate cache so follow state is fresh next time
        this.discoveryService.clearCache();
      },
      error: (err) => {
        console.error('Error toggling follow:', err);
        artist.followLoading = false;
        this.toastService.showNegativeToast('Failed to update follow status');
      },
    });
  }

  getArtistImage(artist: SpotifyArtist): string {
    if (artist.images && artist.images.length > 0) {
      // Medium image
      const sorted = [...artist.images].sort((a, b) => (b.width || 0) - (a.width || 0));
      return sorted[Math.min(1, sorted.length - 1)].url;
    }
    return 'assets/img/placeholder.png';
  }

  getGenres(artist: SpotifyArtist): string[] {
    return (artist.genres || []).slice(0, 2);
  }

  getPopularityLabel(popularity: number): string {
    if (popularity >= 80) return 'Very Popular';
    if (popularity >= 60) return 'Popular';
    if (popularity >= 40) return 'Rising';
    return 'Underground';
  }
}
