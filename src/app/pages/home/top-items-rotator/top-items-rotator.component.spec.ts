import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { TopItemsRotatorComponent } from './top-items-rotator.component';
import { TopItemsData } from 'src/app/services/top-items.service';
import { ReducedMotionService } from 'src/app/services/reduced-motion.service';

function baseData(overrides: Partial<TopItemsData> = {}): TopItemsData {
  return {
    tracks: { short_term: [], medium_term: [], long_term: [] },
    artists: { short_term: [], medium_term: [], long_term: [] },
    genres: { short_term: {}, medium_term: {}, long_term: {} },
    ...overrides,
  };
}

describe('TopItemsRotatorComponent', () => {
  let component: TopItemsRotatorComponent;
  let fixture: ComponentFixture<TopItemsRotatorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [TopItemsRotatorComponent],
      providers: [
        { provide: ReducedMotionService, useValue: { prefersReducedMotion: () => true } },
      ],
    });
    fixture = TestBed.createComponent(TopItemsRotatorComponent);
    component = fixture.componentInstance;
  });

  it('hides the Albums tab when data.albums is absent', () => {
    component.data = baseData();
    component.ngOnChanges({ data: {} as any });

    expect(component.categoryTabs.map((t) => t.id)).toEqual(['songs', 'artists', 'genres']);
  });

  it('shows the Albums tab once data.albums is present', () => {
    component.data = baseData({
      albums: {
        short_term: [
          {
            spotifyId: 'al1',
            name: 'Album 1',
            artist: 'Artist 1',
            imageUrl: 'https://art/al1',
            trackCount: 12,
          },
        ],
        medium_term: [],
        long_term: [],
      },
    });
    component.ngOnChanges({ data: {} as any });

    expect(component.categoryTabs.map((t) => t.id)).toEqual([
      'songs',
      'albums',
      'artists',
      'genres',
    ]);
  });

  it('maps top albums (flattened spotifyId/artist/imageUrl shape) into item cards', () => {
    component.data = baseData({
      albums: {
        short_term: [
          {
            spotifyId: 'al1',
            name: 'Album 1',
            artist: 'Artist 1',
            imageUrl: 'https://art/al1',
            trackCount: 12,
          },
        ],
        medium_term: [],
        long_term: [],
      },
    });
    component.ngOnChanges({ data: {} as any });
    component.selectCategory('albums');

    expect(component.items).toEqual([
      {
        id: 'al1',
        rank: 1,
        name: 'Album 1',
        subtitle: 'Artist 1',
        image: 'https://art/al1',
        link: ['/album', 'al1'],
      },
    ]);
  });

  it('falls back to the songs tab if the active category disappears from data', () => {
    component.data = baseData({
      albums: { short_term: [], medium_term: [], long_term: [] },
    });
    component.ngOnChanges({ data: {} as any });
    component.selectCategory('albums');

    // New data with no albums key -- albums tab (and the active selection) disappears.
    component.data = baseData();
    component.ngOnChanges({ data: {} as any });

    expect(component.activeCategory).toBe('songs');
  });

  it('sorts genres by weight descending and computes a relative weightPct', () => {
    component.data = baseData({
      genres: {
        short_term: { pop: 10, rock: 5, jazz: 20 },
        medium_term: {},
        long_term: {},
      },
    });
    component.ngOnChanges({ data: {} as any });
    component.selectCategory('genres');

    const items = component.items;
    expect(items.map((i) => i.name)).toEqual(['jazz', 'pop', 'rock']);
    expect(items[0].weightPct).toBe(100);
    expect(items[1].weightPct).toBe(50);
  });

  it('maps top tracks for the active range into item cards', () => {
    component.data = baseData({
      tracks: {
        short_term: [
          {
            id: 't1',
            name: 'Song One',
            artists: [{ id: 'ar1', name: 'Artist One' }],
            album: { id: 'al1', name: 'Album', images: [{ url: 'https://art/t1' }], release_date: '2026-01-01' },
            duration_ms: 1,
            popularity: 1,
            explicit: false,
            preview_url: null,
            external_urls: { spotify: '' },
          },
        ],
        medium_term: [],
        long_term: [],
      },
    });
    component.ngOnChanges({ data: {} as any });

    expect(component.items.length).toBe(1);
    expect(component.items[0].name).toBe('Song One');
    expect(component.items[0].subtitle).toBe('Artist One');
  });
});

describe('TopItemsRotatorComponent auto-rotate', () => {
  let component: TopItemsRotatorComponent;
  let fixture: ComponentFixture<TopItemsRotatorComponent>;

  function setUp(prefersReducedMotion: boolean) {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [TopItemsRotatorComponent],
      providers: [
        { provide: ReducedMotionService, useValue: { prefersReducedMotion: () => prefersReducedMotion } },
      ],
    });
    fixture = TestBed.createComponent(TopItemsRotatorComponent);
    component = fixture.componentInstance;
    component.data = baseData();
    component.ngOnChanges({ data: {} as any });
  }

  // `ngOnDestroy` clears the periodic `setInterval`. It must run inside the
  // same `fakeAsync` zone as the test that started the timer -- fakeAsync
  // checks for pending periodic timers as soon as its callback returns, so a
  // normal (non-fakeAsync) `afterEach` would run too late to satisfy it.

  it('auto-cycles through the category tabs on a timer', fakeAsync(() => {
    setUp(false);
    expect(component.activeCategory).toBe('songs');

    tick(7_000);
    expect(component.activeCategory).toBe('artists');

    tick(7_000);
    expect(component.activeCategory).toBe('genres');

    tick(7_000);
    expect(component.activeCategory).toBe('songs');

    component.ngOnDestroy();
  }));

  it('does not auto-cycle when prefers-reduced-motion is set', fakeAsync(() => {
    setUp(true);
    expect(component.activeCategory).toBe('songs');

    tick(30_000);
    expect(component.activeCategory).toBe('songs');

    component.ngOnDestroy();
  }));

  it('pauses the auto-cycle while paused (hover/focus) is true', fakeAsync(() => {
    setUp(false);
    component.paused = true;

    tick(30_000);
    expect(component.activeCategory).toBe('songs');

    component.paused = false;
    tick(7_000);
    expect(component.activeCategory).toBe('artists');

    component.ngOnDestroy();
  }));

  it('a manual tab selection resets the auto-cycle countdown', fakeAsync(() => {
    setUp(false);

    tick(5_000);
    // Manual override mid-cycle.
    component.selectCategory('genres');
    expect(component.activeCategory).toBe('genres');

    // The old countdown (5s in) would have rolled over at 7s; confirm the
    // manual pick reset it instead of letting a stale timer fire early.
    tick(2_000);
    expect(component.activeCategory).toBe('genres');

    tick(5_000);
    expect(component.activeCategory).toBe('songs');

    component.ngOnDestroy();
  }));
});
