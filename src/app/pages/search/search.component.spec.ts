import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SearchComponent } from './search.component';
import {
  SearchResults,
  SearchService,
  SearchType,
} from 'src/app/services/search.service';
import { PlayerService } from 'src/app/services/player.service';

const TRACK_RESULT: SearchResults = {
  tracks: [
    {
      id: 't1',
      name: 'Around the World',
      uri: 'spotify:track:t1',
      artists: [{ id: 'a1', name: 'Daft Punk' }],
      album: {
        id: 'al1',
        name: 'Homework',
        images: [{ url: 'https://example.com/x.jpg' }],
      },
    },
  ],
  artists: [],
  albums: [],
  total: 1,
};

const ARTIST_RESULT: SearchResults = {
  tracks: [],
  artists: [
    {
      id: 'a1',
      name: 'Radiohead',
      uri: 'spotify:artist:a1',
      images: [{ url: 'https://example.com/r.jpg' }],
      genres: ['rock'],
    },
  ],
  albums: [],
  total: 1,
};

const EMPTY_RESULT: SearchResults = {
  tracks: [],
  artists: [],
  albums: [],
  total: 0,
};

describe('SearchComponent', () => {
  let fixture: ComponentFixture<SearchComponent>;
  let component: SearchComponent;
  let searchSpy: jasmine.SpyObj<SearchService>;
  let playerSpy: jasmine.SpyObj<PlayerService>;
  let router: Router;

  beforeEach(async () => {
    searchSpy = jasmine.createSpyObj('SearchService', ['search']);
    playerSpy = jasmine.createSpyObj('PlayerService', ['playSong']);
    searchSpy.search.and.returnValue(of(TRACK_RESULT));

    await TestBed.configureTestingModule({
      declarations: [SearchComponent],
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: SearchService, useValue: searchSpy },
        { provide: PlayerService, useValue: playerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('creates with default Tracks tab and no results', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab).toBe('track');
    expect(component.tracks).toEqual([]);
    expect(component.artists).toEqual([]);
    expect(component.albums).toEqual([]);
    expect(component.hasSearched).toBeFalse();
  });

  describe('min-length hint', () => {
    it('shows when query has 1 character', () => {
      component.onQueryChange('a');
      expect(component.showMinLengthHint).toBeTrue();
    });

    it('does not show when query is empty', () => {
      component.onQueryChange('');
      expect(component.showMinLengthHint).toBeFalse();
    });

    it('does not show when query has >= 2 characters', () => {
      component.onQueryChange('ab');
      expect(component.showMinLengthHint).toBeFalse();
    });

    it('does not call SearchService while below min length', fakeAsync(() => {
      searchSpy.search.calls.reset();
      component.onQueryChange('a');
      tick(500);
      expect(searchSpy.search).not.toHaveBeenCalled();
    }));
  });

  describe('debounced search', () => {
    it('debounces typing for 300ms before calling the service once', fakeAsync(() => {
      searchSpy.search.calls.reset();
      component.onQueryChange('da');
      tick(100);
      component.onQueryChange('daf');
      tick(100);
      component.onQueryChange('daft');
      // Only 200ms elapsed since the first input — service should not fire yet.
      expect(searchSpy.search).not.toHaveBeenCalled();
      tick(300);
      expect(searchSpy.search).toHaveBeenCalledTimes(1);
      expect(searchSpy.search).toHaveBeenCalledWith('daft', 'track', 20);
      expect(component.tracks.length).toBe(1);
      expect(component.hasSearched).toBeTrue();
    }));

    it('skips duplicate consecutive queries (distinctUntilChanged)', fakeAsync(() => {
      searchSpy.search.calls.reset();
      component.onQueryChange('hello');
      tick(400);
      component.onQueryChange('hello');
      tick(400);
      expect(searchSpy.search).toHaveBeenCalledTimes(1);
    }));

    it('uses the active tab when issuing the search', fakeAsync(() => {
      searchSpy.search.and.returnValue(of(ARTIST_RESULT));
      component.setTab('artist');
      // setTab with no query yet — no call.
      expect(searchSpy.search).not.toHaveBeenCalled();
      component.onQueryChange('rad');
      tick(400);
      expect(searchSpy.search).toHaveBeenCalledWith('rad', 'artist', 20);
      expect(component.artists.length).toBe(1);
    }));
  });

  describe('tab switching', () => {
    it('clears prior results and re-issues the query immediately', fakeAsync(() => {
      // Seed with a track search.
      component.onQueryChange('rad');
      tick(400);
      expect(component.tracks.length).toBe(1);

      searchSpy.search.calls.reset();
      searchSpy.search.and.returnValue(of(ARTIST_RESULT));

      component.setTab('artist');

      // Tracks cleared synchronously; new search runs without waiting on debounce.
      expect(component.tracks).toEqual([]);
      expect(searchSpy.search).toHaveBeenCalledWith('rad', 'artist', 20);
      expect(component.artists.length).toBe(1);
    }));

    it('does not refetch when the tab is unchanged', () => {
      searchSpy.search.calls.reset();
      component.setTab('track');
      expect(searchSpy.search).not.toHaveBeenCalled();
    });

    it('does not fetch on tab switch when query is below min length', () => {
      searchSpy.search.calls.reset();
      component.query = 'a';
      component.setTab('artist');
      expect(searchSpy.search).not.toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('shows after a search returns zero results', fakeAsync(() => {
      searchSpy.search.and.returnValue(of(EMPTY_RESULT));
      component.onQueryChange('xyzqq');
      tick(400);
      expect(component.hasSearched).toBeTrue();
      expect(component.showEmptyState).toBeTrue();
    }));

    it('does not show before any search has fired', () => {
      expect(component.hasSearched).toBeFalse();
      expect(component.showEmptyState).toBeFalse();
    });
  });

  describe('error handling', () => {
    it('exposes a generic error message and clears loading', fakeAsync(() => {
      searchSpy.search.and.returnValue(throwError(() => ({ status: 500 })));
      component.onQueryChange('boom');
      tick(400);
      expect(component.errorMessage).toBe('Search failed. Try again.');
      expect(component.loading).toBeFalse();
    }));

    it('shows a session-expired message on 401', fakeAsync(() => {
      searchSpy.search.and.returnValue(throwError(() => ({ status: 401 })));
      component.onQueryChange('expired');
      tick(400);
      expect(component.errorMessage).toContain('session expired');
    }));
  });

  describe('result row clicks', () => {
    it('plays a track via PlayerService when clicked', () => {
      component.onTrackClick(TRACK_RESULT.tracks[0]);
      expect(playerSpy.playSong).toHaveBeenCalledWith('t1');
    });

    it('navigates to /artist-profile/:id when an artist is clicked', () => {
      const navSpy = spyOn(router, 'navigate');
      component.onArtistClick(ARTIST_RESULT.artists[0]);
      expect(navSpy).toHaveBeenCalledWith(['/artist-profile', 'a1']);
    });

    it('navigates to /album/:id when an album is clicked', () => {
      const navSpy = spyOn(router, 'navigate');
      component.onAlbumClick({
        id: 'al42',
        name: 'OK Computer',
        uri: 'spotify:album:al42',
        artists: [],
        images: [],
      });
      expect(navSpy).toHaveBeenCalledWith(['/album', 'al42']);
    });

    it('opens the Spotify track URL in a new tab without bubbling the row click', () => {
      const winSpy = spyOn(window, 'open');
      const stop = jasmine.createSpy('stopPropagation');
      component.openTrackInSpotify(TRACK_RESULT.tracks[0], {
        stopPropagation: stop,
      } as unknown as MouseEvent);
      expect(stop).toHaveBeenCalled();
      expect(winSpy).toHaveBeenCalledWith(
        'https://open.spotify.com/track/t1',
        '_blank',
        'noopener',
      );
    });
  });

  describe('helpers', () => {
    it('joins multiple track artists with a comma', () => {
      const out = component.trackArtists({
        id: 't',
        name: 'x',
        uri: '',
        artists: [
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ],
        album: { id: '', name: '', images: [] },
      });
      expect(out).toBe('A, B');
    });

    it('returns empty string when there is no artwork', () => {
      expect(component.artworkFor(undefined)).toBe('');
      expect(component.artworkFor([])).toBe('');
    });

    it('picks an image when artwork is present', () => {
      const url = component.artworkFor([
        { url: 'a' },
        { url: 'b' },
        { url: 'c' },
      ]);
      expect(['a', 'b', 'c']).toContain(url);
    });
  });

  it('submitting with a short query is a no-op', () => {
    searchSpy.search.calls.reset();
    component.query = 'a';
    component.onSubmit();
    expect(searchSpy.search).not.toHaveBeenCalled();
  });

  it('submitting with a valid query bypasses debounce', () => {
    searchSpy.search.calls.reset();
    searchSpy.search.and.returnValue(of(TRACK_RESULT));
    component.query = 'daft';
    component.onSubmit();
    expect(searchSpy.search).toHaveBeenCalledWith('daft', 'track', 20);
  });

  it('cleans up on destroy', () => {
    const next = spyOn<any>((component as any).destroy$, 'next').and.callThrough();
    const complete = spyOn<any>(
      (component as any).destroy$,
      'complete',
    ).and.callThrough();
    component.ngOnDestroy();
    expect(next).toHaveBeenCalled();
    expect(complete).toHaveBeenCalled();
  });
});

// Aid TS narrowing on the imported type to keep test files lint-clean.
type _UnusedReExport = SearchType;
