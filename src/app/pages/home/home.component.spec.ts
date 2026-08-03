import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { ListeningHistoryService } from 'src/app/services/listening-history.service';
import { TopItemsService } from 'src/app/services/top-items.service';
import { BroadcastsService } from 'src/app/services/broadcasts.service';
import { ImpersonationService } from 'src/app/services/impersonation.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let listeningHistorySpy: jasmine.SpyObj<ListeningHistoryService>;
  let topItemsSpy: jasmine.SpyObj<TopItemsService>;
  let broadcastsSpy: jasmine.SpyObj<BroadcastsService>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let impersonationSpy: jasmine.SpyObj<ImpersonationService>;

  beforeEach(() => {
    sessionStorage.clear();
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'login']);
    userServiceSpy = jasmine.createSpyObj('UserService', ['getUserName', 'ensureLoaded']);
    listeningHistorySpy = jasmine.createSpyObj('ListeningHistoryService', ['getRecentlyPlayed', 'getRelativeTime']);
    topItemsSpy = jasmine.createSpyObj('TopItemsService', ['getTopItems']);
    broadcastsSpy = jasmine.createSpyObj('BroadcastsService', ['getActiveBroadcasts']);
    // Not impersonating by default -- individual tests override
    // `impersonationSpy.impersonatedEmail` to cover the cache-key isolation.
    impersonationSpy = jasmine.createSpyObj('ImpersonationService', [], {
      impersonatedEmail: null,
    });

    TestBed.configureTestingModule({
      declarations: [HomeComponent],
      schemas: [],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: ListeningHistoryService, useValue: listeningHistorySpy },
        { provide: TopItemsService, useValue: topItemsSpy },
        { provide: BroadcastsService, useValue: broadcastsSpy },
        { provide: ImpersonationService, useValue: impersonationSpy },
      ],
    });
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    sessionStorage.clear();
  });

  it('does not fetch any dashboard data for a logged-out visitor', () => {
    authServiceSpy.isLoggedIn.and.returnValue(false);
    createComponent();

    component.ngOnInit();

    expect(component.isLoggedIn).toBe(false);
    expect(listeningHistorySpy.getRecentlyPlayed).not.toHaveBeenCalled();
    expect(topItemsSpy.getTopItems).not.toHaveBeenCalled();
    expect(broadcastsSpy.getActiveBroadcasts).not.toHaveBeenCalled();
  });

  it('loads the dashboard modules for a logged-in user', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    userServiceSpy.getUserName.and.returnValue('Dom');
    listeningHistorySpy.getRecentlyPlayed.and.returnValue(
      of({ items: [], next: null, limit: 50, href: '' }),
    );
    topItemsSpy.getTopItems.and.returnValue(
      of({
        data: {
          tracks: { short_term: [], medium_term: [], long_term: [] },
          artists: { short_term: [], medium_term: [], long_term: [] },
          genres: { short_term: {}, medium_term: {}, long_term: {} },
        },
        error: null,
        meta: {},
      }),
    );
    broadcastsSpy.getActiveBroadcasts.and.returnValue(of([]));
    createComponent();

    component.ngOnInit();

    expect(component.isLoggedIn).toBe(true);
    expect(component.userName).toBe('Dom');
    expect(component.recentItems).toEqual([]);
    expect(component.topItemsData).toBeTruthy();
    expect(component.broadcasts).toEqual([]);
  });

  it('degrades recently-played to an empty state instead of blocking the rest of the page', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    userServiceSpy.getUserName.and.returnValue('Dom');
    listeningHistorySpy.getRecentlyPlayed.and.returnValue(throwError(() => new Error('boom')));
    topItemsSpy.getTopItems.and.returnValue(
      of({
        data: {
          tracks: { short_term: [], medium_term: [], long_term: [] },
          artists: { short_term: [], medium_term: [], long_term: [] },
          genres: { short_term: {}, medium_term: {}, long_term: {} },
        },
        error: null,
        meta: {},
      }),
    );
    broadcastsSpy.getActiveBroadcasts.and.returnValue(of([]));
    createComponent();

    component.ngOnInit();

    expect(component.recentItems).toEqual([]);
    expect(component.recentError).toBe(true);
  });

  it('marks the Favorites quick-link unavailable when no /favorites route is registered', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    userServiceSpy.getUserName.and.returnValue('Dom');
    listeningHistorySpy.getRecentlyPlayed.and.returnValue(
      of({ items: [], next: null, limit: 50, href: '' }),
    );
    topItemsSpy.getTopItems.and.returnValue(
      of({
        data: {
          tracks: { short_term: [], medium_term: [], long_term: [] },
          artists: { short_term: [], medium_term: [], long_term: [] },
          genres: { short_term: {}, medium_term: {}, long_term: {} },
        },
        error: null,
        meta: {},
      }),
    );
    broadcastsSpy.getActiveBroadcasts.and.returnValue(of([]));
    createComponent();

    const router = TestBed.inject(Router);
    router.resetConfig([{ path: '', pathMatch: 'full', children: [] }]);

    component.ngOnInit();

    expect(component.favoritesAvailable).toBe(false);
    const favoritesSlide = component.spotlightSlides.find((s) => s.kind === 'favorites');
    expect(favoritesSlide?.link).toBeUndefined();
  });

  it('starts spotlightLoading true and flips false once any fetch resolves', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    userServiceSpy.getUserName.and.returnValue('Dom');
    listeningHistorySpy.getRecentlyPlayed.and.returnValue(
      of({ items: [], next: null, limit: 50, href: '' }),
    );
    topItemsSpy.getTopItems.and.returnValue(
      of({
        data: {
          tracks: { short_term: [], medium_term: [], long_term: [] },
          artists: { short_term: [], medium_term: [], long_term: [] },
          genres: { short_term: {}, medium_term: {}, long_term: {} },
        },
        error: null,
        meta: {},
      }),
    );
    broadcastsSpy.getActiveBroadcasts.and.returnValue(of([]));
    createComponent();

    expect(component.spotlightLoading).toBe(true);

    component.ngOnInit();

    // All three sources here are synchronous mocks, so by the time
    // ngOnInit returns at least one has already resolved.
    expect(component.spotlightLoading).toBe(false);
  });

  it('reuses a cached top-items response instead of re-fetching within the session', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    userServiceSpy.getUserName.and.returnValue('Dom');
    listeningHistorySpy.getRecentlyPlayed.and.returnValue(
      of({ items: [], next: null, limit: 50, href: '' }),
    );
    const topItemsResponse = {
      data: {
        tracks: { short_term: [], medium_term: [], long_term: [] },
        artists: { short_term: [], medium_term: [], long_term: [] },
        genres: { short_term: {}, medium_term: {}, long_term: {} },
      },
      error: null,
      meta: {},
    };
    topItemsSpy.getTopItems.and.returnValue(of(topItemsResponse));
    broadcastsSpy.getActiveBroadcasts.and.returnValue(of([]));

    createComponent();
    component.ngOnInit();
    expect(topItemsSpy.getTopItems).toHaveBeenCalledTimes(1);
    expect(component.topItemsData).toEqual(topItemsResponse.data);

    // Simulate navigating away and back within the same session -- a fresh
    // component instance, same sessionStorage.
    createComponent();
    component.ngOnInit();

    expect(topItemsSpy.getTopItems).toHaveBeenCalledTimes(1);
    expect(component.topItemsData).toEqual(topItemsResponse.data);
  });

  it('does not reuse the self-scoped top-items cache entry once impersonating a target', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    userServiceSpy.getUserName.and.returnValue('Dom');
    listeningHistorySpy.getRecentlyPlayed.and.returnValue(
      of({ items: [], next: null, limit: 50, href: '' }),
    );
    const topItemsResponse = {
      data: {
        tracks: { short_term: [], medium_term: [], long_term: [] },
        artists: { short_term: [], medium_term: [], long_term: [] },
        genres: { short_term: {}, medium_term: {}, long_term: {} },
      },
      error: null,
      meta: {},
    };
    topItemsSpy.getTopItems.and.returnValue(of(topItemsResponse));
    broadcastsSpy.getActiveBroadcasts.and.returnValue(of([]));

    createComponent();
    component.ngOnInit();
    expect(topItemsSpy.getTopItems).toHaveBeenCalledTimes(1);

    // Simulate the admin starting to impersonate a target and landing back
    // on Home (`stepThroughAs` navigates to `/`) -- the self-scoped cache
    // entry from above must NOT be reused for the target's identity.
    Object.defineProperty(impersonationSpy, 'impersonatedEmail', {
      value: 'target@example.com',
      configurable: true,
    });
    createComponent();
    component.ngOnInit();

    expect(topItemsSpy.getTopItems).toHaveBeenCalledTimes(2);
  });
});
