import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PreviewPlayerService, PreviewTrack } from './preview-player.service';
import { PreviewResolverService } from './preview-resolver.service';

describe('PreviewPlayerService', () => {
  let service: PreviewPlayerService;
  let resolver: jasmine.SpyObj<PreviewResolverService>;
  let playSpy: jasmine.Spy;
  let pauseSpy: jasmine.Spy;

  const trackA: PreviewTrack = {
    id: 'a1',
    title: 'Track A',
    artist: 'Artist A',
    previewUrl: 'https://spotify.example/a.mp3',
  };
  const trackB: PreviewTrack = {
    id: 'b1',
    title: 'Track B',
    artist: 'Artist B',
    previewUrl: null,
  };

  beforeEach(() => {
    const resolverSpy = jasmine.createSpyObj('PreviewResolverService', ['resolve']);
    TestBed.configureTestingModule({
      providers: [{ provide: PreviewResolverService, useValue: resolverSpy }],
    });
    service = TestBed.inject(PreviewPlayerService);
    resolver = TestBed.inject(PreviewResolverService) as jasmine.SpyObj<PreviewResolverService>;

    playSpy = spyOn(HTMLAudioElement.prototype, 'play').and.resolveTo();
    pauseSpy = spyOn(HTMLAudioElement.prototype, 'pause').and.stub();
  });

  it('plays a track with a Spotify preview_url directly, without calling the resolver', async () => {
    service.play(trackA);
    await Promise.resolve();
    await Promise.resolve();

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
    expect(service.currentTrackId).toBe('a1');
    expect(service.isCurrentlyPlaying).toBe(true);
  });

  it('falls back to the resolver when previewUrl is null, and plays the resolved URL', async () => {
    resolver.resolve.and.returnValue(of('https://itunes.example/b.m4a'));

    service.play(trackB);
    await Promise.resolve();
    await Promise.resolve();

    expect(resolver.resolve).toHaveBeenCalledWith('Track B', 'Artist B');
    expect(playSpy).toHaveBeenCalled();
    expect(service.currentTrackId).toBe('b1');
    expect(service.isCurrentlyPlaying).toBe(true);
  });

  it('marks the track unavailable and clears state when the resolver finds nothing', async () => {
    resolver.resolve.and.returnValue(of(null));
    let unavailableId: string | undefined;
    service.unavailable$.subscribe((id) => (unavailableId = id));

    service.play(trackB);
    await Promise.resolve();
    await Promise.resolve();

    expect(unavailableId).toBe('b1');
    expect(service.currentTrackId).toBeNull();
    expect(service.isCurrentlyPlaying).toBe(false);
    expect(service.isKnownUnavailable('b1')).toBe(true);
  });

  it('stops the previous track before playing a new one', async () => {
    service.play(trackA);
    await Promise.resolve();
    await Promise.resolve();

    resolver.resolve.and.returnValue(of('https://itunes.example/b.m4a'));
    service.play(trackB);
    await Promise.resolve();
    await Promise.resolve();

    expect(pauseSpy).toHaveBeenCalled();
    expect(service.currentTrackId).toBe('b1');
  });

  it('toggle() pauses a currently-playing track instead of restarting it', async () => {
    service.play(trackA);
    await Promise.resolve();
    await Promise.resolve();

    service.toggle(trackA);

    expect(pauseSpy).toHaveBeenCalled();
    expect(service.isCurrentlyPlaying).toBe(false);
    expect(service.currentTrackId).toBe('a1');
  });

  it('toggle() starts a different track fresh', async () => {
    service.play(trackA);
    await Promise.resolve();
    await Promise.resolve();

    resolver.resolve.and.returnValue(of('https://itunes.example/b.m4a'));
    service.toggle(trackB);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.currentTrackId).toBe('b1');
  });

  it('stop() clears all state', async () => {
    service.play(trackA);
    await Promise.resolve();
    await Promise.resolve();

    service.stop();

    expect(service.currentTrackId).toBeNull();
    expect(service.isCurrentlyPlaying).toBe(false);
  });
});
