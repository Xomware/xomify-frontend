import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ShareDetailComponent } from './share-detail.component';
import {
  ShareDetailResponse,
  ShareFeedService,
  ShareReaction,
} from '../../services/share-feed.service';
import {
  FriendsListResponse,
  FriendsService,
} from '../../services/friends.service';
import { ToastService } from '../../services/toast.service';
import { UserService } from '../../services/user.service';

// ---- stub child components (they have their own tests / are not under test
// here, so we shadow them with no-op selectors).

@Component({ selector: 'app-loader', template: '' })
class StubLoaderComponent {
  @Input() loading = false;
  @Input() message = '';
}

@Component({ selector: 'app-reactions-bar', template: '' })
class StubReactionsBarComponent {
  @Input() counts: Record<string, number> = {};
  @Input() viewerReactions: string[] = [];
  @Input() inFlight: ReadonlySet<string> = new Set<string>();
  @Input() compact = false;
  @Output() toggle = new EventEmitter<ShareReaction>();
}

@Component({ selector: 'app-comment-thread', template: '' })
class StubCommentThreadComponent {
  @Input() shareId = '';
  @Input() shareAuthorEmail = '';
  @Input() initialCount = 0;
  @Output() countChange = new EventEmitter<number>();
}

@Component({ selector: 'app-friends-rated-list', template: '' })
class StubFriendsRatedListComponent {
  @Input() trackName = '';
  @Input() ratings: unknown[] = [];
  @Input() average: number | null = null;
  @Output() closed = new EventEmitter<void>();
}

@Component({ selector: 'app-friends-queued-list', template: '' })
class StubFriendsQueuedListComponent {
  @Input() trackName = '';
  @Input() listeners: unknown[] = [];
  @Output() closed = new EventEmitter<void>();
}

describe('ShareDetailComponent', () => {
  let component: ShareDetailComponent;
  let fixture: ComponentFixture<ShareDetailComponent>;
  let shareFeedService: jasmine.SpyObj<ShareFeedService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let userService: jasmine.SpyObj<UserService>;
  let friendsService: jasmine.SpyObj<FriendsService>;

  const mockResponse: ShareDetailResponse = {
    share: {
      shareId: 's1',
      email: 'author@example.com',
      trackId: 't1',
      trackUri: 'spotify:track:t1',
      trackName: 'Track Name',
      artistName: 'Artist Name',
      albumName: 'Album Name',
      albumArtUrl: 'https://art/1',
      createdAt: '2026-04-23T10:00:00Z',
      sharedAt: '2026-04-23T10:00:00Z',
      queuedCount: 2,
      ratedCount: 3,
      viewerHasQueued: false,
      viewerRating: null,
      sharerRating: 4,
      commentCount: 1,
      reactionCounts: { fire: 2, heart: 1 },
      viewerReactions: ['fire'],
    },
    interactions: [
      {
        email: 'q1@x.com',
        displayName: 'Q One',
        avatar: null,
        action: 'queued',
        createdAt: '2026-04-23T09:00:00Z',
      },
      {
        email: 'q2@x.com',
        displayName: 'Q Two',
        avatar: null,
        action: 'rated',
        createdAt: '2026-04-23T08:00:00Z',
      },
    ],
    friendRatings: [
      {
        email: 'r1@x.com',
        displayName: 'R One',
        avatar: null,
        rating: 5,
        review: 'fire',
        ratedAt: '2026-04-23T08:00:00Z',
      },
      {
        email: 'r2@x.com',
        displayName: 'R Two',
        avatar: null,
        rating: 3,
        review: null,
        ratedAt: '2026-04-23T07:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    shareFeedService = jasmine.createSpyObj<ShareFeedService>(
      'ShareFeedService',
      ['getShareDetail', 'toggleReaction'],
    );
    shareFeedService.getShareDetail.and.returnValue(of(mockResponse));

    toastService = jasmine.createSpyObj<ToastService>('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);

    userService = jasmine.createSpyObj<UserService>('UserService', [
      'getEmail',
      'getUserName',
      'getProfilePic',
    ]);
    userService.getEmail.and.returnValue('viewer@example.com');
    userService.getUserName.and.returnValue('Viewer Name');
    userService.getProfilePic.and.returnValue('https://avatar/viewer');

    friendsService = jasmine.createSpyObj<FriendsService>('FriendsService', [
      'getFriendsList',
    ]);
    const friendsResp: FriendsListResponse = {
      email: 'viewer@example.com',
      totalCount: 1,
      accepted: [
        {
          email: 'viewer@example.com',
          friendEmail: 'author@example.com',
          displayName: 'Author Display',
          avatar: 'https://avatar/author',
        },
      ],
      requested: [],
      pending: [],
      blocked: [],
      acceptedCount: 1,
      requestedCount: 0,
      pendingCount: 0,
      blockedCount: 0,
    };
    friendsService.getFriendsList.and.returnValue(of(friendsResp));

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule],
      declarations: [
        ShareDetailComponent,
        StubLoaderComponent,
        StubReactionsBarComponent,
        StubCommentThreadComponent,
        StubFriendsRatedListComponent,
        StubFriendsQueuedListComponent,
      ],
      providers: [
        { provide: ShareFeedService, useValue: shareFeedService },
        { provide: ToastService, useValue: toastService },
        { provide: UserService, useValue: userService },
        { provide: FriendsService, useValue: friendsService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ shareId: 's1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareDetailComponent);
    component = fixture.componentInstance;
  });

  it('loads /shares/detail on init and renders the share', () => {
    fixture.detectChanges();

    expect(shareFeedService.getShareDetail).toHaveBeenCalledOnceWith('s1');
    expect(component.loading).toBeFalse();
    expect(component.share?.shareId).toBe('s1');
    expect(component.interactions.length).toBe(2);
    expect(component.friendRatings.length).toBe(2);

    // Track header is in the rendered DOM.
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Track Name');
    expect(html.textContent).toContain('Artist Name');
  });

  it('filters interactions to action="queued" for the queued drilldown', () => {
    fixture.detectChanges();
    expect(component.queuedFriends.length).toBe(1);
    expect(component.queuedFriends[0].email).toBe('q1@x.com');
  });

  it('computes the average friend rating client-side', () => {
    fixture.detectChanges();
    expect(component.averageFriendRating).toBe(4);
    expect(component.averageDisplay).toBe('4.0 avg');
  });

  it('returns null average when no friends have rated', () => {
    shareFeedService.getShareDetail.and.returnValue(
      of({
        ...mockResponse,
        friendRatings: [],
      }),
    );
    fixture.detectChanges();
    expect(component.averageFriendRating).toBeNull();
    expect(component.averageDisplay).toBe('');
  });

  it('toggles a reaction optimistically and applies the server response', () => {
    shareFeedService.toggleReaction = jasmine.createSpy('toggleReaction')
      .and.returnValue(
        of({
          active: true,
          reaction: 'heart' as ShareReaction,
          counts: { fire: 2, heart: 2 },
          viewerReactions: ['fire', 'heart'] as ShareReaction[],
        }),
      );

    fixture.detectChanges();

    component.onReactionToggle('heart');

    // After server response, local state replaced.
    expect(component.share?.reactionCounts?.['heart']).toBe(2);
    expect(component.share?.viewerReactions).toContain('heart');
    expect(component.reactingSlugs.has('heart')).toBeFalse();
  });

  it('opens and closes the friends-rated drilldown', () => {
    fixture.detectChanges();
    expect(component.ratedListOpen).toBeFalse();
    component.openRatedList();
    expect(component.ratedListOpen).toBeTrue();
    component.closeRatedList();
    expect(component.ratedListOpen).toBeFalse();
  });

  it('opens and closes the friends-queued drilldown', () => {
    fixture.detectChanges();
    expect(component.queuedListOpen).toBeFalse();
    component.openQueuedList();
    expect(component.queuedListOpen).toBeTrue();
    component.closeQueuedList();
    expect(component.queuedListOpen).toBeFalse();
  });

  it('updates the cached commentCount when the comment thread emits a new count', () => {
    fixture.detectChanges();
    component.onCommentCountChange(7);
    expect(component.share?.commentCount).toBe(7);
  });

  // ============================================
  // Identity resolution (#275)
  // ============================================

  it('resolves the share author against the friends list and shows the display name', () => {
    fixture.detectChanges();
    expect(friendsService.getFriendsList).toHaveBeenCalledWith(
      'viewer@example.com',
    );
    expect(component.authorLabel).toBe('Author Display');
    expect(component.authorAvatarUrl).toBe('https://avatar/author');
    const html = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(html).toContain('Shared by Author Display');
    expect(html).not.toContain('Shared by author@example.com');
  });

  it('falls back to the email local-part when no friend identity matches', () => {
    friendsService.getFriendsList.and.returnValue(
      of({
        email: 'viewer@example.com',
        totalCount: 0,
        accepted: [],
        requested: [],
        pending: [],
        blocked: [],
        acceptedCount: 0,
        requestedCount: 0,
        pendingCount: 0,
        blockedCount: 0,
      }),
    );
    shareFeedService.getShareDetail.and.returnValue(
      of({
        ...mockResponse,
        share: { ...mockResponse.share, email: 'somebody@gmail.com' },
      }),
    );
    fixture.detectChanges();
    expect(component.authorLabel).toBe('somebody');
    expect(component.authorAvatarUrl).toBeNull();
  });

  it('shows an inline error when /shares/detail fails', () => {
    shareFeedService.getShareDetail.and.returnValue(
      // jasmine spies don't have .pipe yet so we stub manually via callFake.
      // simulate error using rxjs throwError-style emit.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({
        pipe: () => ({
          subscribe: (handlers: { error: (e: unknown) => void }) =>
            handlers.error(new Error('boom')),
        }),
      } as unknown as ReturnType<ShareFeedService['getShareDetail']>),
    );
    fixture.detectChanges();
    expect(component.loading).toBeFalse();
    expect(component.error).toBe('Could not load this share.');
  });
});
