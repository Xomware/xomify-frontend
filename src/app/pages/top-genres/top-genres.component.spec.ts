import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';

import { TopGenresComponent } from './top-genres.component';
import { ArtistService } from 'src/app/services/artist.service';
import { GenresService } from 'src/app/services/genre.service';
import { ToastService } from 'src/app/services/toast.service';
import {
  TopItemsResponse,
  TopItemsService,
} from 'src/app/services/top-items.service';

function mkArtist(id: string, genres: string[] = ['indie rock']): any {
  return {
    id,
    name: `Artist ${id}`,
    images: [{ url: 'https://art/' + id }],
    genres,
    popularity: 60,
    external_urls: { spotify: 'https://open.spotify.com/artist/' + id },
  };
}

function mkResponse(
  overrides: Partial<TopItemsResponse['data']> = {}
): TopItemsResponse {
  const base: TopItemsResponse['data'] = {
    tracks: { short_term: [], medium_term: [], long_term: [] },
    artists: {
      short_term: [mkArtist('s1', ['indie rock', 'pop'])],
      medium_term: [mkArtist('m1', ['indie pop'])],
      long_term: [mkArtist('l1', ['rock'])],
    },
    genres: { short_term: {}, medium_term: {}, long_term: {} },
  };
  return {
    data: { ...base, ...overrides },
    error: null,
    meta: {},
  };
}

describe('TopGenresComponent', () => {
  let component: TopGenresComponent;
  let fixture: ComponentFixture<TopGenresComponent>;
  let topItems: jasmine.SpyObj<TopItemsService>;
  let artistService: jasmine.SpyObj<ArtistService>;

  beforeEach(async () => {
    const topItemsSpy = jasmine.createSpyObj('TopItemsService', ['getTopItems']);
    const artistSpy = jasmine.createSpyObj('ArtistService', [
      'getShortTermTopArtists',
      'getMedTermTopArtists',
      'getLongTermTopArtists',
      'setShortTermTopArtists',
      'setMedTermTopArtists',
      'setLongTermTopArtists',
    ]);
    artistSpy.getShortTermTopArtists.and.returnValue([]);
    artistSpy.getMedTermTopArtists.and.returnValue([]);
    artistSpy.getLongTermTopArtists.and.returnValue([]);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);

    await TestBed.configureTestingModule({
      declarations: [TopGenresComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: TopItemsService, useValue: topItemsSpy },
        { provide: ArtistService, useValue: artistSpy },
        // GenresService is a pure helper with no HTTP — use the real one.
        GenresService,
        { provide: ToastService, useValue: toastSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    topItems = TestBed.inject(TopItemsService) as jasmine.SpyObj<TopItemsService>;
    artistService = TestBed.inject(ArtistService) as jasmine.SpyObj<ArtistService>;

    fixture = TestBed.createComponent(TopGenresComponent);
    component = fixture.componentInstance;
  });

  it('calls TopItemsService on init when no cached artists exist', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    fixture.detectChanges(); // ngOnInit

    expect(topItems.getTopItems).toHaveBeenCalledTimes(1);
    expect(component.loading).toBeFalse();
    expect(component.genreList.length).toBeGreaterThan(0);
  });

  it('hydrates the ArtistService cache for all three ranges', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    fixture.detectChanges();

    expect(artistService.setShortTermTopArtists).toHaveBeenCalled();
    expect(artistService.setMedTermTopArtists).toHaveBeenCalled();
    expect(artistService.setLongTermTopArtists).toHaveBeenCalled();
  });

  it('uses the ArtistService cache when short-term is already populated', () => {
    artistService.getShortTermTopArtists.and.returnValue([
      mkArtist('cached', ['rock']),
    ]);
    artistService.getMedTermTopArtists.and.returnValue([
      mkArtist('cachedM', ['pop']),
    ]);
    artistService.getLongTermTopArtists.and.returnValue([
      mkArtist('cachedL', ['jazz']),
    ]);

    fixture.detectChanges();

    expect(topItems.getTopItems).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('shows the soft warning when meta.failed_ranges is non-empty', () => {
    const resp = mkResponse({
      artists: {
        short_term: [mkArtist('s1')],
        medium_term: null,
        long_term: [mkArtist('l1')],
      },
      meta: { failed_ranges: ['medium_term'] },
    });
    topItems.getTopItems.and.returnValue(of(resp));

    fixture.detectChanges();

    expect(component.partialWarning).toContain('Some periods unavailable');
    expect(component.loading).toBeFalse();
  });

  it('toasts an error and stops loading when the request fails', () => {
    topItems.getTopItems.and.returnValue(throwError(() => new Error('boom')));
    const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;

    fixture.detectChanges();

    expect(toast.showNegativeToast).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
