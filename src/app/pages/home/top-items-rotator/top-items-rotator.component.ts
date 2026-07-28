import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Router } from '@angular/router';
import { TopItemsData, TopItemsTimeRange } from 'src/app/services/top-items.service';
import { ReducedMotionService } from 'src/app/services/reduced-motion.service';

type Category = 'songs' | 'albums' | 'artists' | 'genres';

interface CategoryTab {
  id: Category;
  label: string;
}

interface RotatorItem {
  id: string;
  rank: number;
  name: string;
  subtitle?: string;
  image?: string;
  round?: boolean;
  weightPct?: number;
  link: string[];
}

const ROTATE_MS = 10_000;
const RANGE_LABELS: Record<TopItemsTimeRange, string> = {
  short_term: 'Last Month',
  medium_term: 'Last 6 Months',
  long_term: 'All Time',
};

/**
 * "Rotating top 3-5" Home module. Cycles Top Songs/Albums/Artists/Genres
 * automatically (paused on hover/focus, disabled entirely under
 * `prefers-reduced-motion`), with the category tabs doubling as manual
 * controls and a separate manual time-period toggle (short/medium/long).
 *
 * Albums is a sibling-backend addition to `/user/top-items` — the tab only
 * appears when `data.albums` is present, so this degrades cleanly against
 * an older backend deploy.
 */
@Component({
  selector: 'app-home-top-items-rotator',
  templateUrl: './top-items-rotator.component.html',
  styleUrls: ['./top-items-rotator.component.scss'],
  animations: [
    // Same "any state change" crossfade idiom as SpotlightRotatorComponent —
    // bound to category+range so switching either fades the whole grid.
    trigger('crossfade', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
  host: {
    '[@.disabled]': 'reducedMotion.prefersReducedMotion()',
  },
})
export class TopItemsRotatorComponent implements OnChanges, OnDestroy {
  @Input() data: TopItemsData | null = null;
  @Input() error = false;

  activeCategory: Category = 'songs';
  activeRange: TopItemsTimeRange = 'short_term';
  paused = false;

  readonly rangeOptions: { value: TopItemsTimeRange; label: string }[] = [
    { value: 'short_term', label: RANGE_LABELS.short_term },
    { value: 'medium_term', label: RANGE_LABELS.medium_term },
    { value: 'long_term', label: RANGE_LABELS.long_term },
  ];

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    public reducedMotion: ReducedMotionService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      // Albums tab may appear/disappear once data arrives — make sure the
      // active category is still valid, and (re)start the auto-rotate timer
      // now that there's something to rotate through.
      if (!this.categoryTabs.some((t) => t.id === this.activeCategory)) {
        this.activeCategory = 'songs';
      }
      this.restartTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get categoryTabs(): CategoryTab[] {
    const tabs: CategoryTab[] = [{ id: 'songs', label: 'Top Songs' }];
    if (this.data?.albums) {
      tabs.push({ id: 'albums', label: 'Top Albums' });
    }
    tabs.push({ id: 'artists', label: 'Top Artists' });
    tabs.push({ id: 'genres', label: 'Top Genres' });
    return tabs;
  }

  get activeRangeLabel(): string {
    return RANGE_LABELS[this.activeRange];
  }

  get activeCategoryLabel(): string {
    return this.categoryTabs.find((t) => t.id === this.activeCategory)?.label ?? 'Top Songs';
  }

  get items(): RotatorItem[] {
    if (!this.data) return [];
    switch (this.activeCategory) {
      case 'songs':
        return this.buildTrackItems();
      case 'albums':
        return this.buildAlbumItems();
      case 'artists':
        return this.buildArtistItems();
      case 'genres':
        return this.buildGenreItems();
    }
  }

  selectCategory(category: Category): void {
    this.activeCategory = category;
    this.restartTimer();
  }

  selectRange(range: TopItemsTimeRange): void {
    this.activeRange = range;
  }

  onItemActivate(item: RotatorItem): void {
    this.router.navigate(item.link);
  }

  trackById(_index: number, item: RotatorItem): string {
    return item.id;
  }

  private buildTrackItems(): RotatorItem[] {
    const tracks = this.data?.tracks[this.activeRange] ?? [];
    return tracks.slice(0, 5).map((track, index) => ({
      id: track.id,
      rank: index + 1,
      name: track.name,
      subtitle: track.artists?.map((a) => a.name).join(', '),
      image: track.album?.images?.[track.album.images.length - 1]?.url || track.album?.images?.[0]?.url,
      link: ['/top-songs'],
    }));
  }

  private buildAlbumItems(): RotatorItem[] {
    const albums = this.data?.albums?.[this.activeRange] ?? [];
    return albums.slice(0, 5).map((album, index) => ({
      id: album.spotifyId,
      rank: index + 1,
      name: album.name,
      subtitle: album.artist,
      image: album.imageUrl,
      link: ['/album', album.spotifyId],
    }));
  }

  private buildArtistItems(): RotatorItem[] {
    const artists = this.data?.artists[this.activeRange] ?? [];
    return artists.slice(0, 5).map((artist, index) => ({
      id: artist.id,
      rank: index + 1,
      name: artist.name,
      subtitle: artist.genres?.[0] || 'Artist',
      image: artist.images?.[artist.images.length - 1]?.url || artist.images?.[0]?.url,
      round: true,
      link: ['/artist-profile', artist.id],
    }));
  }

  private buildGenreItems(): RotatorItem[] {
    const genres = this.data?.genres[this.activeRange] ?? {};
    const entries = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxWeight = entries[0]?.[1] || 1;
    return entries.map(([name, weight], index) => ({
      id: `genre-${name}`,
      rank: index + 1,
      name,
      weightPct: Math.round((weight / maxWeight) * 100),
      link: ['/top-genres'],
    }));
  }

  private restartTimer(): void {
    this.clearTimer();
    if (this.reducedMotion.prefersReducedMotion()) return;
    if (this.categoryTabs.length <= 1) return;
    this.timer = setInterval(() => {
      if (this.paused) return;
      const tabs = this.categoryTabs;
      const currentIndex = tabs.findIndex((t) => t.id === this.activeCategory);
      const nextIndex = (currentIndex + 1 + tabs.length) % tabs.length;
      this.activeCategory = tabs[nextIndex].id;
    }, ROTATE_MS);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
