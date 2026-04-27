import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ShareCardComponent } from './share-card.component';
import { SharedModule } from 'src/app/shared/shared.module';
import {
  Share,
  ShareFeedService,
  ReactResponse,
} from 'src/app/services/share-feed.service';
import { PlayerService } from 'src/app/services/player.service';
import { UserService } from 'src/app/services/user.service';
import { ShareService } from 'src/app/services/share.service';
import { ToastService } from 'src/app/services/toast.service';

describe('ShareCardComponent', () => {
  let component: ShareCardComponent;
  let fixture: ComponentFixture<ShareCardComponent>;
  let shareFeed: jasmine.SpyObj<ShareFeedService>;
  let toast: jasmine.SpyObj<ToastService>;

  const baseShare: Share = {
    shareId: 'share-1',
    email: 'dom@example.com',
    trackId: 't1',
    trackUri: 'spotify:track:t1',
    trackName: 'Example Track',
    artistName: 'Example Artist',
    albumName: 'Example Album',
    albumArtUrl: 'https://art/1',
    caption: 'Love this',
    moodTag: 'chill',
    genreTags: ['indie'],
    createdAt: '2026-04-23T10:00:00Z',
    sharedAt: '2026-04-23T10:00:00Z',
    queuedCount: 2,
    ratedCount: 1,
    viewerHasQueued: false,
    viewerRating: null,
    sharerRating: null,
  };

  beforeEach(async () => {
    const shareFeedSpy = jasmine.createSpyObj('ShareFeedService', ['reactToShare']);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    const shareSpy = jasmine.createSpyObj('ShareService', ['share']);
    const userSpy = jasmine.createSpyObj('UserService', ['getEmail']);
    const playerSpy = jasmine.createSpyObj('PlayerService', ['playSong', 'addToSpotifyQueue']);
    userSpy.getEmail.and.returnValue('viewer@example.com');
    shareSpy.share.and.resolveTo(true);
    playerSpy.addToSpotifyQueue.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      declarations: [ShareCardComponent],
      imports: [RouterTestingModule, HttpClientTestingModule, SharedModule],
      providers: [
        { provide: ShareFeedService, useValue: shareFeedSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ShareService, useValue: shareSpy },
        { provide: UserService, useValue: userSpy },
        { provide: PlayerService, useValue: playerSpy },
      ],
      // Allow the new <app-reactions-bar> child without dragging in the
      // SocialModule wiring — the component is covered by its own spec.
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    shareFeed = TestBed.inject(ShareFeedService) as jasmine.SpyObj<ShareFeedService>;
    toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;

    fixture = TestBed.createComponent(ShareCardComponent);
    component = fixture.componentInstance;
    component.share = { ...baseShare };
    fixture.detectChanges();
  });

  it('renders denormalized track metadata', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.track-name')?.textContent).toContain(
      'Example Track',
    );
    expect(host.querySelector('.track-artist')?.textContent).toContain(
      'Example Artist',
    );
    expect(host.querySelector('.mood-chip')?.textContent?.toLowerCase()).toContain(
      'chill',
    );
    expect(host.querySelector('.genre-chip')?.textContent).toContain('indie');
  });

  it('queue toggle performs optimistic update and posts queued action', () => {
    const resp: ReactResponse = {
      queuedCount: 3,
      ratedCount: 1,
      viewerHasQueued: true,
      viewerRating: null,
      sharerRating: null,
    };
    shareFeed.reactToShare.and.returnValue(of(resp));

    component.toggleQueue();

    expect(shareFeed.reactToShare).toHaveBeenCalledWith(
      'viewer@example.com',
      'share-1',
      'queued',
    );
    expect(component.share.viewerHasQueued).toBe(true);
    expect(component.share.queuedCount).toBe(3);
  });

  it('rolls back queue toggle on error', () => {
    shareFeed.reactToShare.and.returnValue(throwError(() => new Error('boom')));
    const prevCount = component.share.queuedCount;
    const prevFlag = component.share.viewerHasQueued;

    component.toggleQueue();

    expect(component.share.viewerHasQueued).toBe(prevFlag);
    expect(component.share.queuedCount).toBe(prevCount);
    expect(toast.showNegativeToast).toHaveBeenCalled();
  });

  it('posts rated with the rating value and updates viewerRating', () => {
    const resp: ReactResponse = {
      queuedCount: 2,
      ratedCount: 2,
      viewerHasQueued: false,
      viewerRating: 4,
      sharerRating: null,
    };
    shareFeed.reactToShare.and.returnValue(of(resp));

    component.onRatingChange(4);

    expect(shareFeed.reactToShare).toHaveBeenCalledWith(
      'viewer@example.com',
      'share-1',
      'rated',
      4,
    );
    expect(component.share.viewerRating).toBe(4);
    expect(component.share.ratedCount).toBe(2);
  });

  it('treats re-click of same rating as unrated (clear)', () => {
    component.share.viewerRating = 4;
    component.share.ratedCount = 2;

    const resp: ReactResponse = {
      queuedCount: 2,
      ratedCount: 1,
      viewerHasQueued: false,
      viewerRating: null,
      sharerRating: null,
    };
    shareFeed.reactToShare.and.returnValue(of(resp));

    component.onRatingChange(4);

    expect(shareFeed.reactToShare).toHaveBeenCalledWith(
      'viewer@example.com',
      'share-1',
      'unrated',
      undefined,
    );
    expect(component.share.viewerRating).toBeNull();
  });

  it('rolls back rating on error', () => {
    component.share.viewerRating = 2;
    shareFeed.reactToShare.and.returnValue(throwError(() => new Error('boom')));

    component.onRatingChange(5);

    expect(component.share.viewerRating).toBe(2);
    expect(toast.showNegativeToast).toHaveBeenCalled();
  });

  describe('kebab menu', () => {
    it('toggleMenu opens the menu and stops propagation', () => {
      expect(component.menuOpen).toBe(false);
      const event = new MouseEvent('click');
      spyOn(event, 'stopPropagation');
      component.toggleMenu(event);
      expect(component.menuOpen).toBe(true);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('toggleMenu closes the menu on second call', () => {
      const event = new MouseEvent('click');
      component.toggleMenu(event);
      component.toggleMenu(event);
      expect(component.menuOpen).toBe(false);
    });

    it('document click closes the menu via HostListener', () => {
      component.menuOpen = true;
      component.onDocumentClick();
      expect(component.menuOpen).toBe(false);
    });

    it('menuPlay calls playerService.playSong and closes menu', () => {
      const playerService = TestBed.inject(PlayerService) as jasmine.SpyObj<PlayerService>;
      component.menuOpen = true;
      component.menuPlay();
      expect(component.menuOpen).toBe(false);
      expect(playerService.playSong).toHaveBeenCalledWith('t1');
    });

    it('menuQueue delegates to toggleQueue and closes menu', () => {
      const resp: ReactResponse = {
        queuedCount: 3,
        ratedCount: 1,
        viewerHasQueued: true,
        viewerRating: null,
        sharerRating: null,
      };
      shareFeed.reactToShare.and.returnValue(of(resp));
      component.menuOpen = true;
      component.menuQueue();
      expect(component.menuOpen).toBe(false);
      expect(shareFeed.reactToShare).toHaveBeenCalled();
    });
  });
});
