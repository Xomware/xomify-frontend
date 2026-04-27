import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { MyProfileComponent } from './my-profile.component';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { LikesService } from 'src/app/services/likes.service';
import { SongService } from 'src/app/services/song.service';
import { ArtistService } from 'src/app/services/artist.service';
import { FriendsService } from 'src/app/services/friends.service';
import { ToastService } from 'src/app/services/toast.service';
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
    tracks: {
      short_term: [mkTrack('s1'), mkTrack('s2')],
      medium_term: [mkTrack('m1')],
      long_term: [mkTrack('l1')],
    },
    artists: {
      short_term: [
        mkArtist('a1', ['indie rock', 'pop']),
        mkArtist('a2', ['indie rock']),
      ],
      medium_term: [mkArtist('am1')],
      long_term: [mkArtist('al1')],
    },
    genres: { short_term: {}, medium_term: {}, long_term: {} },
  };
  return {
    data: { ...base, ...overrides },
    error: null,
    meta: {},
  };
}

describe('MyProfileComponent — loadTickerData', () => {
  let component: MyProfileComponent;
  let fixture: ComponentFixture<MyProfileComponent>;

  let topItems: jasmine.SpyObj<TopItemsService>;
  let songService: jasmine.SpyObj<SongService>;
  let artistService: jasmine.SpyObj<ArtistService>;
  let userService: jasmine.SpyObj<UserService>;
  let friendsService: jasmine.SpyObj<FriendsService> & {
    friendsList$: BehaviorSubject<any>;
    incomingCount$: BehaviorSubject<number>;
  };

  beforeEach(async () => {
    const topItemsSpy = jasmine.createSpyObj('TopItemsService', ['getTopItems']);
    const songSpy = jasmine.createSpyObj('SongService', [
      'getShortTermTopTracks',
      'getMediumTermTopTracks',
      'getLongTermTopTracks',
      'setTopTracks',
      'getTopTracks',
    ]);
    songSpy.getShortTermTopTracks.and.returnValue([]);
    songSpy.getMediumTermTopTracks.and.returnValue([]);
    songSpy.getLongTermTopTracks.and.returnValue([]);

    const artistSpy = jasmine.createSpyObj('ArtistService', [
      'getShortTermTopArtists',
      'setShortTermTopArtists',
      'getTopArtists',
    ]);
    artistSpy.getShortTermTopArtists.and.returnValue([]);

    const userSpy = jasmine.createSpyObj('UserService', [
      'getUserName',
      'getEmail',
      'getProfilePic',
      'getFollowers',
      'getWrappedEnrollment',
      'getReleaseRadarEnrollment',
      'getPlaylistCount',
      'getFollowingCount',
      'getLikesCount',
      'getLikesPublic',
      'getUser',
      'getUserData',
      'getUserPlaylists',
      'getFollowedArtists',
      'getUserTableData',
      'updateUserTableRefreshToken',
      'setPlaylistCount',
      'setFollowingCount',
      'setWrappedEnrollment',
      'setReleaseRadarEnrollment',
    ]);
    userSpy.getUserName.and.returnValue('Dominick');
    userSpy.getEmail.and.returnValue('dom@example.com');
    userSpy.getProfilePic.and.returnValue('');
    userSpy.getFollowers.and.returnValue(0);
    userSpy.getWrappedEnrollment.and.returnValue(false);
    userSpy.getReleaseRadarEnrollment.and.returnValue(false);
    userSpy.getPlaylistCount.and.returnValue(5);
    userSpy.getFollowingCount.and.returnValue(7);
    userSpy.getLikesCount.and.returnValue(0);
    userSpy.getLikesPublic.and.returnValue(false);
    userSpy.getUser.and.returnValue({ email: 'dom@example.com' });

    const authSpy = jasmine.createSpyObj('AuthService', [
      'getAccessToken',
      'logout',
    ]);
    authSpy.getAccessToken.and.returnValue('access-token');

    const likesSpy = jasmine.createSpyObj('LikesService', ['setLikesPublic']);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);

    const friendsSpy: any = jasmine.createSpyObj('FriendsService', [
      'getFriendsList',
      'setCurrentUserEmail',
      'getCachedFriendsList',
    ]);
    friendsSpy.friendsList$ = new BehaviorSubject<any>(null);
    friendsSpy.incomingCount$ = new BehaviorSubject<number>(0);
    friendsSpy.getCachedFriendsList.and.returnValue(null);
    friendsSpy.getFriendsList.and.returnValue(of({ acceptedCount: 0 }));

    await TestBed.configureTestingModule({
      declarations: [MyProfileComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: TopItemsService, useValue: topItemsSpy },
        { provide: SongService, useValue: songSpy },
        { provide: ArtistService, useValue: artistSpy },
        { provide: UserService, useValue: userSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: LikesService, useValue: likesSpy },
        { provide: FriendsService, useValue: friendsSpy },
        { provide: ToastService, useValue: toastSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    topItems = TestBed.inject(TopItemsService) as jasmine.SpyObj<TopItemsService>;
    songService = TestBed.inject(SongService) as jasmine.SpyObj<SongService>;
    artistService = TestBed.inject(ArtistService) as jasmine.SpyObj<ArtistService>;
    userService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
    friendsService = TestBed.inject(FriendsService) as any;

    fixture = TestBed.createComponent(MyProfileComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // initializeTicker schedules a setInterval -- clear it so tests don't
    // leak timers across specs.
    const interval = (component as any).tickerInterval;
    if (interval) {
      clearInterval(interval);
      (component as any).tickerInterval = null;
    }
  });

  it('uses TopItemsService.getTopItems when caches are empty', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    (component as any).loadTickerData();

    expect(topItems.getTopItems).toHaveBeenCalledTimes(1);
    expect(songService.getTopTracks).not.toHaveBeenCalled();
    expect(artistService.getTopArtists).not.toHaveBeenCalled();
  });

  it('does NOT poison the SongService cache (no setTopTracks write)', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    (component as any).loadTickerData();

    expect(songService.setTopTracks).not.toHaveBeenCalled();
  });

  it('hydrates ticker arrays from response.data.tracks/artists.short_term', () => {
    topItems.getTopItems.and.returnValue(of(mkResponse()));

    (component as any).loadTickerData();

    expect((component as any).topSongs.length).toBe(2);
    expect((component as any).topSongs[0].id).toBe('s1');
    expect((component as any).topArtists.length).toBe(2);
    expect((component as any).topArtists[0].id).toBe('a1');
    // Genres derived from artists: 'indie rock' appears twice → top.
    expect((component as any).topGenres[0].name).toBe('indie rock');
    expect((component as any).topGenres[0].count).toBe(2);
  });

  it('skips the network call when SongService and ArtistService have warm caches', () => {
    songService.getShortTermTopTracks.and.returnValue([mkTrack('cached1')]);
    artistService.getShortTermTopArtists.and.returnValue([mkArtist('cachedA')]);

    (component as any).loadTickerData();

    expect(topItems.getTopItems).not.toHaveBeenCalled();
    expect((component as any).topSongs[0].id).toBe('cached1');
    expect((component as any).topArtists[0].id).toBe('cachedA');
  });

  it('handles a TopItemsService failure without throwing', () => {
    topItems.getTopItems.and.returnValue(throwError(() => new Error('boom')));

    expect(() => (component as any).loadTickerData()).not.toThrow();
    // Ticker just stays empty -- the rest of the page still renders.
    expect((component as any).topSongs.length).toBe(0);
  });

  it('treats null short_term arrays as empty (failed-range tolerance)', () => {
    const resp = mkResponse({
      tracks: { short_term: null, medium_term: [], long_term: [] },
      artists: { short_term: null, medium_term: [], long_term: [] },
    });
    topItems.getTopItems.and.returnValue(of(resp));

    (component as any).loadTickerData();

    expect((component as any).topSongs.length).toBe(0);
    expect((component as any).topArtists.length).toBe(0);
    expect((component as any).topGenres.length).toBe(0);
  });
});
