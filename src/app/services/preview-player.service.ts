import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { PreviewResolverService } from './preview-resolver.service';

/** The bits of a track needed to play (or resolve a fallback for) a preview. */
export interface PreviewTrack {
  id: string;
  title: string;
  artist: string;
  /** Spotify's own 30s preview_url, when present. Preferred over iTunes. */
  previewUrl?: string | null;
}

/**
 * Single shared 30-second preview player used on every song surface in the
 * app, in place of the Spotify Web Playback SDK (which requires Premium and
 * a live Spotify Connect session — see PlayerService's header comment for
 * why that path 404s and fails silently for most users).
 *
 * Source priority per track:
 *   1. Spotify's `preview_url`, played directly via HTML5 `Audio`.
 *   2. iTunes Search API fallback (free, no auth) via `PreviewResolverService`.
 *   3. Neither has one -> `unavailable$` fires so callers can degrade to an
 *      "Open in Spotify" link instead of a dead play button.
 *
 * Only one preview plays at a time: starting a new one stops whatever was
 * playing. All state is exposed as observables so any number of play
 * buttons across the app can reflect "is MY track the one currently
 * playing/loading" without owning any audio themselves.
 */
@Injectable({
  providedIn: 'root',
})
export class PreviewPlayerService {
  private readonly audio: HTMLAudioElement = new Audio();

  private readonly currentTrackIdSubject = new BehaviorSubject<string | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);
  /** Emits a track id the instant its preview resolution comes back empty. */
  private readonly unavailableSubject = new Subject<string>();

  currentTrackId$ = this.currentTrackIdSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  unavailable$ = this.unavailableSubject.asObservable();

  /** trackId -> resolved preview URL, or `null` when confirmed unavailable. */
  private readonly resolutionCache = new Map<string, string | null>();

  /** Monotonically increasing token so a stale async resolution can't clobber
   * state after the user has since started a different track. */
  private playToken = 0;

  constructor(private resolver: PreviewResolverService) {
    this.audio.addEventListener('ended', () => this.handleEnded());
    this.audio.addEventListener('error', () => this.handlePlaybackError());
  }

  get currentTrackId(): string | null {
    return this.currentTrackIdSubject.getValue();
  }

  get isCurrentlyPlaying(): boolean {
    return this.isPlayingSubject.getValue();
  }

  /** Synchronous check for a track we've already confirmed has no preview
   * anywhere, so a fresh button instance can render the "unavailable" state
   * immediately instead of flashing idle-then-unavailable. */
  isKnownUnavailable(trackId: string): boolean {
    return this.resolutionCache.has(trackId) && this.resolutionCache.get(trackId) === null;
  }

  /** Play/pause/resume the given track, mirroring standard "tap to toggle"
   * button semantics. Starting a different track stops whatever was playing. */
  toggle(track: PreviewTrack): void {
    if (this.currentTrackId === track.id) {
      if (this.isCurrentlyPlaying) {
        this.pause();
      } else {
        this.resume();
      }
      return;
    }
    this.play(track);
  }

  play(track: PreviewTrack): void {
    const token = ++this.playToken;
    this.audio.pause();
    this.currentTrackIdSubject.next(track.id);
    this.isPlayingSubject.next(false);
    this.isLoadingSubject.next(true);

    const cached = track.previewUrl
      ? track.previewUrl
      : this.resolutionCache.has(track.id)
        ? this.resolutionCache.get(track.id) ?? null
        : undefined;

    if (cached !== undefined) {
      this.startPlayback(track.id, cached, token);
      return;
    }

    this.resolver
      .resolve(track.title, track.artist)
      .pipe(take(1))
      .subscribe((url) => {
        this.resolutionCache.set(track.id, url);
        this.startPlayback(track.id, url, token);
      });
  }

  pause(): void {
    this.audio.pause();
    this.isPlayingSubject.next(false);
  }

  resume(): void {
    if (!this.currentTrackId) return;
    this.audio
      .play()
      .then(() => this.isPlayingSubject.next(true))
      .catch(() => this.handlePlaybackError());
  }

  /** Stops playback entirely and clears the "now playing" track. Safe to
   * call unconditionally (e.g. on route change / component destroy). */
  stop(): void {
    this.playToken++;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.currentTrackIdSubject.next(null);
    this.isPlayingSubject.next(false);
    this.isLoadingSubject.next(false);
  }

  private startPlayback(trackId: string, url: string | null, token: number): void {
    // A newer play() call superseded this one while we were resolving —
    // don't stomp on whatever the user started next.
    if (token !== this.playToken) return;

    if (!url) {
      this.isLoadingSubject.next(false);
      this.currentTrackIdSubject.next(null);
      this.unavailableSubject.next(trackId);
      return;
    }

    this.audio.src = url;
    this.audio
      .play()
      .then(() => {
        if (token !== this.playToken) return;
        this.isLoadingSubject.next(false);
        this.isPlayingSubject.next(true);
      })
      .catch(() => {
        if (token !== this.playToken) return;
        this.resolutionCache.set(trackId, null);
        this.isLoadingSubject.next(false);
        this.currentTrackIdSubject.next(null);
        this.unavailableSubject.next(trackId);
      });
  }

  private handleEnded(): void {
    this.isPlayingSubject.next(false);
    this.currentTrackIdSubject.next(null);
  }

  private handlePlaybackError(): void {
    const trackId = this.currentTrackId;
    this.isLoadingSubject.next(false);
    this.isPlayingSubject.next(false);
    this.currentTrackIdSubject.next(null);
    if (trackId) {
      this.resolutionCache.set(trackId, null);
      this.unavailableSubject.next(trackId);
    }
  }
}
