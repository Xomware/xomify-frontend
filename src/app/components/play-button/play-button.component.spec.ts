import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { PlayButtonComponent } from './play-button.component';
import { PreviewPlayerService } from 'src/app/services/preview-player.service';

describe('PlayButtonComponent', () => {
  let component: PlayButtonComponent;
  let fixture: ComponentFixture<PlayButtonComponent>;
  let previewPlayer: jasmine.SpyObj<PreviewPlayerService>;
  let currentTrackId$: Subject<string | null>;
  let isPlaying$: Subject<boolean>;
  let isLoading$: Subject<boolean>;
  let unavailable$: Subject<string>;

  beforeEach(async () => {
    currentTrackId$ = new Subject<string | null>();
    isPlaying$ = new Subject<boolean>();
    isLoading$ = new Subject<boolean>();
    unavailable$ = new Subject<string>();

    const spy = jasmine.createSpyObj(
      'PreviewPlayerService',
      ['toggle', 'isKnownUnavailable'],
      {
        currentTrackId$: currentTrackId$.asObservable(),
        isPlaying$: isPlaying$.asObservable(),
        isLoading$: isLoading$.asObservable(),
        unavailable$: unavailable$.asObservable(),
        currentTrackId: null,
        isCurrentlyPlaying: false,
      },
    );
    spy.isKnownUnavailable.and.returnValue(false);

    await TestBed.configureTestingModule({
      declarations: [PlayButtonComponent],
      providers: [{ provide: PreviewPlayerService, useValue: spy }],
    }).compileComponents();

    previewPlayer = TestBed.inject(PreviewPlayerService) as jasmine.SpyObj<PreviewPlayerService>;

    fixture = TestBed.createComponent(PlayButtonComponent);
    component = fixture.componentInstance;
    component.trackId = 't1';
    component.title = 'Track One';
    component.artist = 'Artist One';
    fixture.detectChanges();
  });

  it('renders a play button by default', () => {
    const btn = fixture.nativeElement.querySelector('.play-button');
    expect(btn).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.play-button-unavailable')).toBeFalsy();
  });

  it('toggles playback via PreviewPlayerService on click', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.play-button');
    btn.click();

    expect(previewPlayer.toggle).toHaveBeenCalledWith({
      id: 't1',
      title: 'Track One',
      artist: 'Artist One',
      previewUrl: undefined,
    });
  });

  it('emits playClicked with the track id', () => {
    let emitted: string | undefined;
    component.playClicked.subscribe((id) => (emitted = id));

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.play-button');
    btn.click();

    expect(emitted).toBe('t1');
  });

  it('reflects playing state only when this track is the current one', () => {
    Object.defineProperty(previewPlayer, 'isCurrentlyPlaying', { value: true });
    currentTrackId$.next('t1');
    fixture.detectChanges();

    expect(component.isPlaying).toBe(true);
    expect(fixture.nativeElement.querySelector('.play-button.playing')).toBeTruthy();
  });

  it('does not show playing when a different track is current', () => {
    Object.defineProperty(previewPlayer, 'isCurrentlyPlaying', { value: true });
    currentTrackId$.next('other-track');
    fixture.detectChanges();

    expect(component.isPlaying).toBe(false);
  });

  it('shows a loading spinner while resolving/buffering this track', () => {
    Object.defineProperty(previewPlayer, 'currentTrackId', { value: 't1' });
    isLoading$.next(true);
    fixture.detectChanges();

    expect(component.isLoading).toBe(true);
    expect(fixture.nativeElement.querySelector('.spinner')).toBeTruthy();
  });

  it('swaps to an "open in Spotify" link when the preview is unavailable', () => {
    unavailable$.next('t1');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.play-button')).toBeFalsy();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '.play-button-unavailable',
    );
    expect(link).toBeTruthy();
    expect(link.href).toContain('open.spotify.com/track/t1');
  });

  it('ignores unavailable events for other tracks', () => {
    unavailable$.next('some-other-track');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.play-button-unavailable')).toBeFalsy();
  });

  it('uses a custom spotifyUrl for the unavailable fallback link when provided', () => {
    component.spotifyUrl = 'https://open.spotify.com/track/custom';
    unavailable$.next('t1');
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '.play-button-unavailable',
    );
    expect(link.href).toBe('https://open.spotify.com/track/custom');
  });

  it('starts unavailable immediately when the service already knows this track has no preview', () => {
    previewPlayer.isKnownUnavailable.and.returnValue(true);

    const f2 = TestBed.createComponent(PlayButtonComponent);
    f2.componentInstance.trackId = 'known-bad';
    f2.componentInstance.title = 'x';
    f2.componentInstance.artist = 'y';
    f2.detectChanges();

    expect(f2.nativeElement.querySelector('.play-button-unavailable')).toBeTruthy();
  });
});
