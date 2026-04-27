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
import { Group, GroupsService } from 'src/app/services/groups.service';
import { UserService } from 'src/app/services/user.service';
import { ToastService } from 'src/app/services/toast.service';
import { FriendsService } from 'src/app/services/friends.service';

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
  let groupsService: jasmine.SpyObj<GroupsService>;
  let userService: jasmine.SpyObj<UserService>;

  const mkGroup = (id: string, name: string): Group => ({
    id,
    name,
    createdBy: 'dom@example.com',
    createdAt: '2026-04-01T00:00:00Z',
    memberCount: 2,
    songCount: 0,
  });

  beforeEach(async () => {
    const shareFeedSpy = jasmine.createSpyObj('ShareFeedService', ['getFeed']);
    const groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroups']);
    const userSpy = jasmine.createSpyObj('UserService', [
      'getEmail',
      'getUserName',
      'getProfilePic',
    ]);
    const friendsSpy = jasmine.createSpyObj('FriendsService', [
      'getFriendsList',
    ]);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    userSpy.getEmail.and.returnValue('dom@example.com');
    userSpy.getUserName.and.returnValue('Dom');
    userSpy.getProfilePic.and.returnValue('');
    friendsSpy.getFriendsList.and.returnValue(
      of({
        email: 'dom@example.com',
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
    groupsSpy.getGroups.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [FeedComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: ShareFeedService, useValue: shareFeedSpy },
        { provide: GroupsService, useValue: groupsSpy },
        { provide: UserService, useValue: userSpy },
        { provide: FriendsService, useValue: friendsSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    shareFeed = TestBed.inject(ShareFeedService) as jasmine.SpyObj<ShareFeedService>;
    groupsService = TestBed.inject(GroupsService) as jasmine.SpyObj<GroupsService>;
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

  it('loadGroups populates the chip list on init', () => {
    groupsService.getGroups.and.returnValue(
      of([mkGroup('g1', 'Hiking'), mkGroup('g2', 'Drivin')]),
    );
    shareFeed.getFeed.and.returnValue(of({ shares: [], nextBefore: null }));

    fixture.detectChanges();

    expect(groupsService.getGroups).toHaveBeenCalledWith('dom@example.com');
    expect(component.groups.length).toBe(2);
    expect(component.activeGroupId).toBeNull();
  });

  it('selectGroup reloads the feed with the chosen groupId', () => {
    groupsService.getGroups.and.returnValue(of([mkGroup('g1', 'Hiking')]));
    shareFeed.getFeed.and.returnValue(of({ shares: [], nextBefore: null }));

    fixture.detectChanges();
    // Clear the initial call so we only inspect the one triggered by selectGroup.
    shareFeed.getFeed.calls.reset();

    component.selectGroup('g1');

    expect(component.activeGroupId).toBe('g1');
    expect(shareFeed.getFeed).toHaveBeenCalledWith(
      'dom@example.com',
      jasmine.objectContaining({ groupId: 'g1' }),
    );
  });

  it('selectGroup(null) does not include groupId in the query', () => {
    groupsService.getGroups.and.returnValue(of([mkGroup('g1', 'Hiking')]));
    shareFeed.getFeed.and.returnValue(of({ shares: [], nextBefore: null }));

    fixture.detectChanges();
    component.activeGroupId = 'g1';
    shareFeed.getFeed.calls.reset();

    component.selectGroup(null);

    expect(component.activeGroupId).toBeNull();
    const opts = shareFeed.getFeed.calls.mostRecent().args[1] ?? {};
    expect((opts as any).groupId).toBeUndefined();
  });
});
