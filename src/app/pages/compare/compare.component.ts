import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  trigger,
  state,
  style,
  animate,
  transition,
} from '@angular/animations';
import {
  ComparisonService,
  ListeningSnapshot,
} from '../../services/comparison.service';
import { ArtistService } from '../../services/artist.service';
import { SongService } from '../../services/song.service';
import { UserService } from '../../services/user.service';
import { ToastService } from '../../services/toast.service';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss'],
  animations: [
    trigger('barGrow', [
      transition(':enter', [
        style({ width: '0%' }),
        animate('600ms ease-out', style({ width: '*' })),
      ]),
    ]),
  ],
})
export class CompareComponent implements OnInit {
  mySnapshot: ListeningSnapshot | null = null;
  friendSnapshot: ListeningSnapshot | null = null;
  compatibilityScore: number = 0;
  sharedArtists: string[] = [];
  sharedGenres: string[] = [];
  loading = true;
  shareLoading = false;

  constructor(
    private route: ActivatedRoute,
    private comparisonService: ComparisonService,
    private artistService: ArtistService,
    private songService: SongService,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const snapParam = this.route.snapshot.queryParamMap.get('snap');
    if (snapParam) {
      this.friendSnapshot = this.comparisonService.decodeSnapshot(snapParam);
    }
    this.loadMyStats();
  }

  loadMyStats(): void {
    forkJoin({
      artists: this.artistService.getTopArtists('short_term', 10).pipe(
        map((res: any) => res.items || []),
        catchError(() => of([]))
      ),
      tracks: this.songService.getTopTracks('short_term', 10).pipe(
        map((res: any) => res.items || []),
        catchError(() => of([]))
      ),
    }).subscribe({
      next: ({ artists, tracks }) => {
        const genreSet = new Set<string>();
        artists.forEach((a: any) =>
          (a.genres || []).forEach((g: string) => genreSet.add(g))
        );

        this.mySnapshot = {
          username: this.userService.userName || 'You',
          generatedAt: new Date().toISOString(),
          topArtists: artists.map((a: any, i: number) => ({
            name: a.name,
            playCount: 100 - i * 8,
            imageUrl: a.images?.[0]?.url,
          })),
          topTracks: tracks.map((t: any, i: number) => ({
            name: t.name,
            artist: t.artists?.[0]?.name || 'Unknown',
            playCount: 80 - i * 6,
          })),
          topGenres: Array.from(genreSet).slice(0, 10),
          totalMinutes: Math.floor(Math.random() * 3000) + 500,
        };

        this.calculateOverlap();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  calculateOverlap(): void {
    if (!this.mySnapshot || !this.friendSnapshot) return;

    this.compatibilityScore = this.comparisonService.calculateCompatibility(
      this.mySnapshot.topArtists,
      this.friendSnapshot.topArtists
    );

    this.sharedArtists = this.comparisonService.getSharedItems(
      this.mySnapshot.topArtists.map((a) => a.name),
      this.friendSnapshot.topArtists.map((a) => a.name)
    );

    this.sharedGenres = this.comparisonService.getSharedItems(
      this.mySnapshot.topGenres,
      this.friendSnapshot.topGenres
    );
  }

  shareStats(): void {
    this.shareLoading = true;
    this.comparisonService.generateShareableSnapshot().subscribe({
      next: ({ encoded }) => {
        const url = `${window.location.origin}/compare?snap=${encoded}`;
        navigator.clipboard
          .writeText(url)
          .then(() => {
            this.toastService.showPositiveToast(
              'Share link copied to clipboard!'
            );
          })
          .catch(() => {
            this.toastService.showNegativeToast('Failed to copy link');
          });
        this.shareLoading = false;
      },
      error: () => {
        this.toastService.showNegativeToast('Failed to generate share link');
        this.shareLoading = false;
      },
    });
  }

  getBarWidth(playCount: number, maxCount: number): number {
    if (!maxCount || maxCount <= 0) return 0;
    return Math.round((playCount / maxCount) * 100);
  }

  getGenreSlices(
    genres: string[]
  ): { name: string; percentage: number; offset: number; color: string }[] {
    if (!genres || genres.length === 0) return [];
    const total = genres.length;
    let offset = 0;
    const colors = [
      '#1DB954',
      '#1ed760',
      '#2ee86b',
      '#4bf07f',
      '#69f593',
      '#87faa7',
      '#a5ffbb',
      '#c3ffd0',
      '#e1ffe4',
      '#f0fff2',
    ];
    return genres.map((name, i) => {
      const percentage = 100 / total;
      const slice = {
        name,
        percentage,
        offset,
        color: colors[i % colors.length],
      };
      offset += percentage;
      return slice;
    });
  }
}
