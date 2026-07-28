import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { ListeningHistoryService } from 'src/app/services/listening-history.service';
import { TopItemsService } from 'src/app/services/top-items.service';
import { BroadcastsService } from 'src/app/services/broadcasts.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let listeningHistorySpy: jasmine.SpyObj<ListeningHistoryService>;
  let topItemsSpy: jasmine.SpyObj<TopItemsService>;
  let broadcastsSpy: jasmine.SpyObj<BroadcastsService>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'login']);
    userServiceSpy = jasmine.createSpyObj('UserService', ['getUserName', 'ensureLoaded']);
    listeningHistorySpy = jasmine.createSpyObj('ListeningHistoryService', ['getRecentlyPlayed', 'getRelativeTime']);
    topItemsSpy = jasmine.createSpyObj('TopItemsService', ['getTopItems']);
    broadcastsSpy = jasmine.createSpyObj('BroadcastsService', ['getActiveBroadcasts']);

    TestBed.configureTestingModule({
      declarations: [HomeComponent],
      schemas: [],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: ListeningHistoryService, useValue: listeningHistorySpy },
        { provide: TopItemsService, useValue: topItemsSpy },
        { provide: BroadcastsService, useValue: broadcastsSpy },
      ],
    });
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  }

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
});
