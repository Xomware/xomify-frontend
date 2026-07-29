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
import { PreviewPlayerService } from 'src/app/services/preview-player.service';
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
    const shareFeedSpy = jasmine.createSpyObj('ShareFeedService', [
      'reactToShare',
      'deleteShare',
    ]);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    const shareSpy = jasmine.createSpyObj('ShareService', ['share']);
    const userSpy = jasmine.createSpyObj('UserService', ['getEmail']);
    const previewPlayerSpy = jasmine.createSpyObj('PreviewPlayerService', ['toggle']);
    userSpy.getEmail.and.returnValue('viewer@example.com');
    shareSpy.share.and.resolveTo(true);

    await TestBed.configureTestingModule({
      declarations: [ShareCardComponent],
      imports: [RouterTestingModule, HttpClientTestingModule, SharedModule],
      providers: [
        { provide: ShareFeedService, useValue: shareFeedSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ShareService, useValue: shareSpy },
        { provide: UserService, useValue: userSpy },
        { provide: PreviewPlayerService, useValue: previewPlayerSpy },
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

    it('menuPlay toggles the shared preview player and closes menu', () => {
      const previewPlayer = TestBed.inject(
        PreviewPlayerService,
      ) as jasmine.SpyObj<PreviewPlayerService>;
      component.menuOpen = true;
      component.menuPlay();
      expect(component.menuOpen).toBe(false);
      expect(previewPlayer.toggle).toHaveBeenCalledWith({
        id: 't1',
        title: 'Example Track',
        artist: 'Example Artist',
      });
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

  // ============================================
  // Delete share (#275)
  // ============================================

  describe('delete share', () => {
    it('viewerIsAuthor is true when viewer email matches share.email', () => {
      const userSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
      userSpy.getEmail.and.returnValue('dom@example.com');
      expect(component.viewerIsAuthor).toBe(true);
    });

    it('viewerIsAuthor is false when viewer email does not match', () => {
      const userSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
      userSpy.getEmail.and.returnValue('someone-else@example.com');
      expect(component.viewerIsAuthor).toBe(false);
    });

    it('menuDelete calls deleteShare and emits the deleted shareId on success', () => {
      const userSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
      userSpy.getEmail.and.returnValue('dom@example.com'); // matches share.email
      shareFeed.deleteShare.and.returnValue(of(undefined as unknown as void));
      spyOn(window, 'confirm').and.returnValue(true);
      const emitted: string[] = [];
      component.deleted.subscribe((id) => emitted.push(id));

      component.menuDelete();

      expect(window.confirm).toHaveBeenCalled();
      expect(shareFeed.deleteShare).toHaveBeenCalledWith(
        'share-1',
        baseShare.sharedAt,
      );
      expect(emitted).toEqual(['share-1']);
      expect(toast.showPositiveToast).toHaveBeenCalledWith('Share deleted');
    });

    it('menuDelete bails when the confirm dialog is cancelled', () => {
      const userSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
      userSpy.getEmail.and.returnValue('dom@example.com');
      spyOn(window, 'confirm').and.returnValue(false);
      component.menuDelete();
      expect(shareFeed.deleteShare).not.toHaveBeenCalled();
    });

    it('menuDelete is a no-op when the viewer is not the share author', () => {
      const userSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
      userSpy.getEmail.and.returnValue('not-the-author@example.com');
      spyOn(window, 'confirm');
      component.menuDelete();
      expect(window.confirm).not.toHaveBeenCalled();
      expect(shareFeed.deleteShare).not.toHaveBeenCalled();
    });

    it('menuDelete shows a negative toast and does NOT emit on error', () => {
      const userSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
      userSpy.getEmail.and.returnValue('dom@example.com');
      shareFeed.deleteShare.and.returnValue(throwError(() => new Error('boom')));
      spyOn(window, 'confirm').and.returnValue(true);
      const emitted: string[] = [];
      component.deleted.subscribe((id) => emitted.push(id));

      component.menuDelete();

      expect(emitted.length).toBe(0);
      expect(toast.showNegativeToast).toHaveBeenCalledWith('Could not delete share');
    });
  });
});
