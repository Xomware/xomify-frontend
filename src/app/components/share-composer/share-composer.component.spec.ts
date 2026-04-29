import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ShareComposerComponent } from './share-composer.component';
import { PlaylistService } from 'src/app/services/playlist.service';
import {
  CreateShareRequest,
  CreateShareResponse,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';
import {
  RatingsService,
  TrackRating,
} from 'src/app/services/ratings.service';
import { Group, GroupsService } from 'src/app/services/groups.service';

describe('ShareComposerComponent', () => {
  let component: ShareComposerComponent;
  let fixture: ComponentFixture<ShareComposerComponent>;

  let shareFeed: jasmine.SpyObj<ShareFeedService>;
  let ratings: jasmine.SpyObj<RatingsService>;
  let groups: jasmine.SpyObj<GroupsService>;
  let user: jasmine.SpyObj<UserService>;
  let toast: jasmine.SpyObj<ToastService>;
  let playlist: jasmine.SpyObj<PlaylistService>;

  const VIEWER_EMAIL = 'viewer@example.com';

  const trackPick = {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Sample Song',
    artists: [{ id: 'a1', name: 'Sample Artist' }],
    album: {
      id: 'al1',
      name: 'Sample Album',
      images: [{ url: 'https://art/1' }],
    },
  };

  const sampleGroups: Group[] = [
    {
      id: 'g1',
      groupId: 'g1',
      name: 'Vinyl Club',
      createdBy: VIEWER_EMAIL,
      createdAt: '2026-04-01T00:00:00Z',
      memberCount: 4,
      songCount: 12,
    },
    {
      id: 'g2',
      groupId: 'g2',
      name: 'Roadtrip Bangers',
      createdBy: VIEWER_EMAIL,
      createdAt: '2026-04-01T00:00:00Z',
      memberCount: 7,
      songCount: 23,
    },
  ];

  const baseCreateResponse: CreateShareResponse = {
    shareId: 'share-1',
    email: VIEWER_EMAIL,
    trackId: trackPick.id,
    trackUri: trackPick.uri,
    trackName: trackPick.name,
    artistName: 'Sample Artist',
    albumName: trackPick.album.name,
    albumArtUrl: 'https://art/1',
    createdAt: '2026-04-26T10:00:00Z',
    sharedAt: '2026-04-26T10:00:00Z',
  };

  beforeEach(async () => {
    shareFeed = jasmine.createSpyObj('ShareFeedService', ['createShare']);
    ratings = jasmine.createSpyObj('RatingsService', [
      'getTrackRating',
      'rateTrack',
    ]);
    groups = jasmine.createSpyObj('GroupsService', ['getGroups']);
    user = jasmine.createSpyObj('UserService', ['getEmail']);
    toast = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    playlist = jasmine.createSpyObj('PlaylistService', ['searchTracks']);

    user.getEmail.and.returnValue(VIEWER_EMAIL);
    groups.getGroups.and.returnValue(of(sampleGroups));
    ratings.getTrackRating.and.returnValue(of(null));
    shareFeed.createShare.and.returnValue(of(baseCreateResponse));

    await TestBed.configureTestingModule({
      declarations: [ShareComposerComponent],
      imports: [FormsModule],
      providers: [
        { provide: ShareFeedService, useValue: shareFeed },
        { provide: RatingsService, useValue: ratings },
        { provide: GroupsService, useValue: groups },
        { provide: UserService, useValue: user },
        { provide: ToastService, useValue: toast },
        { provide: PlaylistService, useValue: playlist },
      ],
      // Allow <app-star-rating> without dragging in SharedModule.
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareComposerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ============================================
  // Bootstrap
  // ============================================

  describe('bootstrap', () => {
    it('loads groups on init for the targets section', () => {
      expect(groups.getGroups).toHaveBeenCalledWith(VIEWER_EMAIL);
      expect(component.availableGroups.length).toBe(2);
      expect(component.groupsLoading).toBeFalse();
    });

    it('defaults shareToPublic to true (legacy parity)', () => {
      expect(component.shareToPublic).toBeTrue();
      expect(component.selectedGroupIds.size).toBe(0);
    });
  });

  // ============================================
  // Rating pre-load (iOS parity #276)
  // ============================================

  describe('rating pre-load', () => {
    it('fetches the existing rating when a track is selected', () => {
      const existing: TrackRating = {
        email: VIEWER_EMAIL,
        trackId: trackPick.id,
        rating: 4,
        ratedAt: '2026-04-20T10:00:00Z',
        trackName: trackPick.name,
        artistName: 'Sample Artist',
      };
      ratings.getTrackRating.and.returnValue(of(existing));

      component.selectTrack(trackPick);

      expect(ratings.getTrackRating).toHaveBeenCalledWith(
        VIEWER_EMAIL,
        trackPick.id,
      );
      expect(component.rating).toBe(4);
      expect(component.existingRating).toBe(4);
      expect(component.ratingLoading).toBeFalse();
    });

    it('leaves rating at zero when the user has not rated this track', () => {
      ratings.getTrackRating.and.returnValue(of(null));

      component.selectTrack(trackPick);

      expect(component.rating).toBe(0);
      expect(component.existingRating).toBe(0);
    });

    it('clears rating state when the user picks a different track', () => {
      ratings.getTrackRating.and.returnValue(
        of({
          email: VIEWER_EMAIL,
          trackId: trackPick.id,
          rating: 5,
          ratedAt: '',
          trackName: '',
          artistName: '',
        }),
      );
      component.selectTrack(trackPick);
      expect(component.rating).toBe(5);

      component.clearSelection();
      expect(component.selectedTrack).toBeNull();
      expect(component.rating).toBe(0);
      expect(component.existingRating).toBe(0);
    });
  });

  // ============================================
  // Target validation (mirrors ComposerTargetState)
  // ============================================

  describe('target validation', () => {
    beforeEach(() => {
      component.selectTrack(trackPick);
    });

    it('reports ok when public is on and no groups selected', () => {
      component.shareToPublic = true;
      component.selectedGroupIds = new Set();
      expect(component.targetState).toBe('ok');
      expect(component.canSubmit).toBeTrue();
    });

    it('reports ok when public is off but at least one group is selected', () => {
      component.shareToPublic = false;
      component.toggleGroup('g1');
      expect(component.targetState).toBe('ok');
      expect(component.canSubmit).toBeTrue();
    });

    it('reports noTargets when public is off and no groups are selected', () => {
      component.shareToPublic = false;
      component.selectedGroupIds = new Set();
      expect(component.targetState).toBe('noTargets');
      expect(component.canSubmit).toBeFalse();
    });
  });

  // ============================================
  // Group selection
  // ============================================

  describe('group selection', () => {
    it('toggleGroup adds and removes a group id', () => {
      component.toggleGroup('g1');
      expect(component.isGroupSelected('g1')).toBeTrue();

      component.toggleGroup('g1');
      expect(component.isGroupSelected('g1')).toBeFalse();
    });

    it('targetSummary reflects friends-feed + group count', () => {
      component.shareToPublic = true;
      component.toggleGroup('g1');
      expect(component.targetSummary).toBe('Friends feed + 1 group');

      component.toggleGroup('g2');
      expect(component.targetSummary).toBe('Friends feed + 2 groups');

      component.shareToPublic = false;
      expect(component.targetSummary).toBe('2 groups');

      component.toggleGroup('g1');
      component.toggleGroup('g2');
      expect(component.targetSummary).toBe('No targets');
    });
  });

  // ============================================
  // Submit
  // ============================================

  describe('submit', () => {
    it('forwards isPublic + groupIds to the share-feed service', () => {
      component.selectTrack(trackPick);
      component.shareToPublic = false;
      component.toggleGroup('g1');
      component.toggleGroup('g2');

      component.submit();

      expect(shareFeed.createShare).toHaveBeenCalledTimes(1);
      const [, request] = shareFeed.createShare.calls.mostRecent().args as [
        string,
        CreateShareRequest,
      ];
      expect(request.isPublic).toBeFalse();
      expect(request.groupIds).toEqual(jasmine.arrayWithExactContents(['g1', 'g2']));
    });

    it('publishes the rating before/parallel to the share when the user changed it', () => {
      ratings.getTrackRating.and.returnValue(of(null));
      ratings.rateTrack.and.returnValue(
        of({
          email: VIEWER_EMAIL,
          trackId: trackPick.id,
          rating: 5,
          ratedAt: '2026-04-26T10:00:00Z',
          trackName: trackPick.name,
          artistName: 'Sample Artist',
        }),
      );
      component.selectTrack(trackPick);
      component.onRatingChange(5);

      component.submit();

      expect(ratings.rateTrack).toHaveBeenCalledWith(
        VIEWER_EMAIL,
        trackPick.id,
        5,
        trackPick.name,
        'Sample Artist',
        'https://art/1',
        'al1',
      );
      expect(shareFeed.createShare).toHaveBeenCalled();
    });

    it('does NOT republish the rating when the value matches the pre-loaded value', () => {
      ratings.getTrackRating.and.returnValue(
        of({
          email: VIEWER_EMAIL,
          trackId: trackPick.id,
          rating: 3,
          ratedAt: '2026-04-20T10:00:00Z',
          trackName: trackPick.name,
          artistName: 'Sample Artist',
        }),
      );
      component.selectTrack(trackPick);
      // user leaves rating at the pre-loaded value of 3
      component.submit();

      expect(ratings.rateTrack).not.toHaveBeenCalled();
      expect(shareFeed.createShare).toHaveBeenCalled();
    });

    it('still publishes the share when the rating call fails (errors are swallowed)', () => {
      ratings.getTrackRating.and.returnValue(of(null));
      ratings.rateTrack.and.returnValue(
        throwError(() => new Error('rating boom')),
      );
      component.selectTrack(trackPick);
      component.onRatingChange(4);

      component.submit();

      expect(shareFeed.createShare).toHaveBeenCalled();
    });

    it('refuses to submit when no target is selected', () => {
      component.selectTrack(trackPick);
      component.shareToPublic = false;
      component.selectedGroupIds = new Set();

      component.submit();

      expect(shareFeed.createShare).not.toHaveBeenCalled();
    });
  });
});
