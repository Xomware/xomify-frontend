import { Component, OnInit } from '@angular/core';
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
    private toastService: ToastService,
    private topItemsService: TopItemsService
  ) {}

  ngOnInit(): void {
    const cached = this.artistService.getShortTermTopArtists();

    if (cached.length === 0) {
      this.loadTopArtists();
    } else {
      this.topArtistsShortTerm = cached;
      this.topArtistsMedTerm = this.artistService.getMedTermTopArtists();
      this.topArtistsLongTerm = this.artistService.getLongTermTopArtists();
      this.displayedArtists = [...this.topArtistsShortTerm];
      this.loading = false;
    }
  }

  loadTopArtists(): void {
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
