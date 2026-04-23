import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { FeedComponent } from './feed.component';
import {
  FeedResponse,
  Share,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { UserService } from 'src/app/services/user.service';
import { ToastService } from 'src/app/services/toast.service';

function mkShare(id: string, createdAt = '2026-04-23T10:00:00Z'): Share {
  return {
    shareId: id,
    email: 'dom@example.com',
    trackId: `t-${id}`,
    trackUri: `spotify:track:t-${id}`,
    trackName: `Track ${id}`,
    artistName: 'Artist',
    albumName: 'Album',
    albumArtUrl: 'https://art/1',
    createdAt,
    sharedAt: createdAt,
    queuedCount: 0,
    ratedCount: 0,
    viewerHasQueued: false,
    viewerRating: null,
    sharerRating: null,
  };
}

describe('FeedComponent', () => {
  let component: FeedComponent;
  let fixture: ComponentFixture<FeedComponent>;
  let shareFeed: jasmine.SpyObj<ShareFeedService>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    const shareFeedSpy = jasmine.createSpyObj('ShareFeedService', ['getFeed']);
    const userSpy = jasmine.createSpyObj('UserService', ['getEmail']);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    userSpy.getEmail.and.returnValue('dom@example.com');

    await TestBed.configureTestingModule({
      declarations: [FeedComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: ShareFeedService, useValue: shareFeedSpy },
        { provide: UserService, useValue: userSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    shareFeed = TestBed.inject(ShareFeedService) as jasmine.SpyObj<ShareFeedService>;
    userService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
  });

  it('consumes the new FeedResponse shape (shares + nextBefore)', () => {
    const resp: FeedResponse = {
      shares: [mkShare('a'), mkShare('b')],
      nextBefore: '2026-04-22T10:00:00Z',
    };
    shareFeed.getFeed.and.returnValue(of(resp));

    fixture.detectChanges(); // triggers ngOnInit → loadFeed

    expect(component.shares.length).toBe(2);
    expect(component.nextBefore).toBe('2026-04-22T10:00:00Z');
    expect(component.loading).toBe(false);
  });

  it('passes pagination limit on initial load', () => {
    const resp: FeedResponse = { shares: [], nextBefore: null };
    shareFeed.getFeed.and.returnValue(of(resp));

    fixture.detectChanges();

    expect(shareFeed.getFeed).toHaveBeenCalledWith(
      'dom@example.com',
      jasmine.objectContaining({ limit: jasmine.any(Number) }),
    );
  });

  it('loadMore appends new shares and updates nextBefore', () => {
    shareFeed.getFeed.and.returnValue(
      of({ shares: [mkShare('a')], nextBefore: '2026-04-22T10:00:00Z' }),
    );
    fixture.detectChanges();

    shareFeed.getFeed.and.returnValue(
      of({ shares: [mkShare('b')], nextBefore: null }),
    );
    component.loadMore();

    expect(component.shares.map((s) => s.shareId)).toEqual(['a', 'b']);
    expect(component.nextBefore).toBeNull();
  });

  it('loadMore does nothing when nextBefore is null', () => {
    shareFeed.getFeed.and.returnValue(
      of({ shares: [mkShare('a')], nextBefore: null }),
    );
    fixture.detectChanges();

    const calls = shareFeed.getFeed.calls.count();
    component.loadMore();
    expect(shareFeed.getFeed.calls.count()).toBe(calls);
  });

  it('sets error when initial feed load fails', () => {
    shareFeed.getFeed.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect(component.error).toBeTruthy();
    expect(component.loading).toBe(false);
  });

  it('onShareCreated prepends the new share', () => {
    shareFeed.getFeed.and.returnValue(
      of({ shares: [mkShare('a')], nextBefore: null }),
    );
    fixture.detectChanges();

    const newShare = mkShare('new');
    component.onShareCreated(newShare);

    expect(component.shares[0].shareId).toBe('new');
    expect(component.composerOpen).toBe(false);
  });
});
