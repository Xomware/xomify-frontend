import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';

import { TopSongsComponent } from './top-songs.component';
import { SongService } from 'src/app/services/song.service';
import { PlayerService } from 'src/app/services/player.service';
import { PreviewPlayerService } from 'src/app/services/preview-player.service';
import { QueueService } from 'src/app/services/queue.service';
import { ToastService } from 'src/app/services/toast.service';
import { RatingsService } from 'src/app/services/ratings.service';
import {
  TopItemsResponse,
  TopItemsService,
} from 'src/app/services/top-items.service';

function mkTrack(id: string): any {
  return {
    id,
    name: `Track ${id}`,
    artists: [{ id: 'a1', name: 'Artist 1' }],
    album: {
      id: 'al1',
      name: 'Album',
      images: [{ url: 'https://art/' + id }],
      release_date: '2026-01-01',
    },
    duration_ms: 180_000,
    popularity: 70,
    explicit: false,
    preview_url: null,
    external_urls: { spotify: 'https://open.spotify.com/track/' + id },
  };
}

function mkResponse(
  overrides: Partial<TopItemsResponse['data']> = {}
): TopItemsResponse {
  const base: TopItemsResponse['data'] = {
    tracks: {
      short_term: [mkTrack('s1'), mkTrack('s2')],
      medium_term: [mkTrack('m1')],
      long_term: [mkTrack('l1')],
    },
    artists: {
      short_term: [],
      medium_term: [],
      long_term: [],
    },
    genres: { short_term: {}, medium_term: {}, long_term: {} },
  };
  return {
    data: { ...base, ...overrides },
    error: null,
    meta: {},
  };
}

describe('TopSongsComponent', () => {
  let component: TopSongsComponent;
  let fixture: ComponentFixture<TopSongsComponent>;
  let topItems: jasmine.SpyObj<TopItemsService>;
  let songService: jasmine.SpyObj<SongService>;

  beforeEach(async () => {
    const topItemsSpy = jasmine.createSpyObj('TopItemsService', ['getTopItems']);
    const songSpy = jasmine.createSpyObj('SongService', [
      'getShortTermTopTracks',
      'getMediumTermTopTracks',
      'getLongTermTopTracks',
      'setTopTracks',
    ]);
    songSpy.getShortTermTopTracks.and.returnValue([]);
    songSpy.getMediumTermTopTracks.and.returnValue([]);
    songSpy.getLongTermTopTracks.and.returnValue([]);

    const playerSpy = jasmine.createSpyObj('PlayerService', [
      'addToSpotifyQueue',
    ]);
    const previewPlayerSpy = jasmine.createSpyObj(
      'PreviewPlayerService',
      ['toggle', 'stop'],
      {
        currentTrackId$: new Subject<string | null>().asObservable(),
        isPlaying$: new Subject<boolean>().asObservable(),
        isLoading$: new Subject<boolean>().asObservable(),
      },
    );
    const queueSpy = jasmine.createSpyObj('QueueService', [
      'isInQueue',
      'addToQueue',
      'removeFromQueue',
    ]);
    queueSpy.isInQueue.and.returnValue(false);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    const ratingsSpy = jasmine.createSpyObj('RatingsService', [
      'getCachedRating',
      'isRated',
    ]);
    ratingsSpy.getCachedRating.and.returnValue(0);
    ratingsSpy.isRated.and.returnValue(false);

    await TestBed.configureTestingModule({
      declarations: [TopSongsComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: TopItemsService, useValue: topItemsSpy },
        { provide: SongService, useValue: songSpy },
        { provide: PlayerService, useValue: playerSpy },
        { provide: PreviewPlayerService, useValue: previewPlayerSpy },
        { provide: QueueService, useValue: queueSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: RatingsService, useValue: ratingsSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    topItems = TestBed.inject(TopItemsService) as jasmine.SpyObj<TopItemsService>;
    songService = TestBed.inject(SongService) as jasmine.SpyObj<SongService>;

    fixture = TestBed.createComponent(TopSongsComponent);
    component = fixture.componentInstance;
  });

  it('calls TopItemsService on init and renders the active range', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    fixture.detectChanges(); // ngOnInit -> loadTopSongs

    expect(topItems.getTopItems).toHaveBeenCalledTimes(1);
    expect(component.topSongs.length).toBe(2);
    expect(component.topSongs[0].id).toBe('s1');
    expect(component.loading).toBeFalse();
    expect(component.error).toBe('');
    expect(component.partialWarning).toBe('');
  });

  it('hydrates the SongService cache for all three ranges from one response', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    fixture.detectChanges();

    expect(songService.setTopTracks).toHaveBeenCalledTimes(1);
    const [short, medium, long] = songService.setTopTracks.calls.mostRecent().args;
    expect((short as any[]).length).toBe(2);
    expect((medium as any[]).length).toBe(1);
    expect((long as any[]).length).toBe(1);
  });

  it('uses the cached service data instead of refetching when all ranges are populated', () => {
    songService.getShortTermTopTracks.and.returnValue([mkTrack('cached1')]);
    songService.getMediumTermTopTracks.and.returnValue([mkTrack('cachedM')]);
    songService.getLongTermTopTracks.and.returnValue([mkTrack('cachedL')]);

    fixture.detectChanges();

    expect(topItems.getTopItems).not.toHaveBeenCalled();
    expect(component.topSongs[0].id).toBe('cached1');
    expect(component.loading).toBeFalse();
  });

  it('switches the rendered list when the active time range changes', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));
    fixture.detectChanges();

    // Cache is now populated by the success handler.
    songService.getShortTermTopTracks.and.returnValue([mkTrack('s1'), mkTrack('s2')]);
    songService.getMediumTermTopTracks.and.returnValue([mkTrack('m1')]);
    songService.getLongTermTopTracks.and.returnValue([mkTrack('l1')]);

    component.onTimeRangeChange('long_term');

    expect(component.activeTimeRange).toBe('long_term');
    expect(component.topSongs.length).toBe(1);
    expect(component.topSongs[0].id).toBe('l1');
    // Still only one HTTP call total; the second load hit the in-memory cache.
    expect(topItems.getTopItems).toHaveBeenCalledTimes(1);
  });

  it('shows the soft warning when meta.failed_ranges is non-empty', () => {
    const resp = mkResponse({
      tracks: {
        short_term: [mkTrack('s1')],
        medium_term: null,
        long_term: [mkTrack('l1')],
      },
      meta: { failed_ranges: ['medium_term'] },
    });
    topItems.getTopItems.and.returnValue(of(resp));

    fixture.detectChanges();

    expect(component.partialWarning).toContain('Some periods unavailable');
    expect(component.topSongs.length).toBe(1); // short_term still rendered
    expect(component.loading).toBeFalse();
  });

  it('sets an error message when the request fails', () => {
    topItems.getTopItems.and.returnValue(throwError(() => new Error('boom')));

    fixture.detectChanges();

    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });
});
