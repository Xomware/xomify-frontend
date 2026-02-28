import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import {
  NewReleasesService,
  SpotifyAlbum,
} from 'src/app/services/new-releases.service';

@Component({
  selector: 'app-new-releases',
  templateUrl: './new-releases.component.html',
  styleUrls: ['./new-releases.component.scss'],
})
export class NewReleasesComponent implements OnInit {
  loading = true;
  loadingMore = false;
  error = '';

  allAlbums: SpotifyAlbum[] = [];
  filteredAlbums: SpotifyAlbum[] = [];
  searchQuery = '';

  totalCount = 0;
  nextPageUrl: string | null = null;
  currentOffset = 0;
  dateLoaded = '';

  constructor(
    private newReleasesService: NewReleasesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadNewReleases();
  }

  loadNewReleases(offset: number = 0): void {
    this.loading = true;
    this.error = '';

    this.newReleasesService
      .getNewReleases(offset)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.allAlbums = response.albums.items;
          this.totalCount = response.albums.total;
          this.nextPageUrl = response.albums.next;
          this.currentOffset = response.albums.offset + response.albums.items.length;
          this.dateLoaded = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          this.applyFilter();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading new releases:', err);
          this.error = 'Failed to load new releases. Please try again.';
          this.loading = false;
        },
      });
  }

  loadMore(): void {
    if (!this.nextPageUrl || this.loadingMore) return;

    this.loadingMore = true;

    this.newReleasesService
      .getNewReleases(this.currentOffset)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.allAlbums = [...this.allAlbums, ...response.albums.items];
          this.nextPageUrl = response.albums.next;
          this.currentOffset += response.albums.items.length;
          this.applyFilter();
          this.loadingMore = false;
        },
        error: (err) => {
          console.error('Error loading more releases:', err);
          this.loadingMore = false;
        },
      });
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredAlbums = [...this.allAlbums];
    } else {
      this.filteredAlbums = this.allAlbums.filter((album) => {
        const nameMatch = album.name.toLowerCase().includes(q);
        const artistMatch = album.artists.some((a) =>
          a.name.toLowerCase().includes(q)
        );
        return nameMatch || artistMatch;
      });
    }
  }

  goToAlbum(album: SpotifyAlbum): void {
    this.router.navigate(['/album', album.id]);
  }

  openInSpotify(album: SpotifyAlbum, event: Event): void {
    event.stopPropagation();
    window.open(album.external_urls.spotify, '_blank');
  }

  getAlbumArt(album: SpotifyAlbum): string {
    const images = album.images;
    if (images && images.length > 0) {
      return images[0].url;
    }
    return 'assets/img/placeholder.png';
  }

  getArtistNames(album: SpotifyAlbum): string {
    return album.artists.map((a) => a.name).join(', ');
  }

  formatReleaseDate(album: SpotifyAlbum): string {
    return this.newReleasesService.formatReleaseDate(
      album.release_date,
      album.release_date_precision
    );
  }

  formatAlbumType(album: SpotifyAlbum): string {
    return this.newReleasesService.formatAlbumType(album.album_type);
  }

  refresh(): void {
    this.newReleasesService.clearCache();
    this.searchQuery = '';
    this.allAlbums = [];
    this.filteredAlbums = [];
    this.loadNewReleases();
  }
}
