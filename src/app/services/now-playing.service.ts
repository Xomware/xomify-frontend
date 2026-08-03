import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/** A single now-playing item, flattened from Spotify's `currently-playing`
 * payload into just what the Home widget renders. */
export interface NowPlayingTrack {
  id: string;
  name: string;
  artists: string;
  albumId: string | null;
  albumArt: string;
  /** Spotify external URL for the "open in Spotify" affordance. */
  url: string;
}

export interface NowPlayingState {
  isPlaying: boolean;
  track: NowPlayingTrack | null;
  progressMs: number;
  durationMs: number;
}

/** `.now-playing-art` renders at ~96px — needs at least the 300px Spotify
 * image, or the 64px thumbnail shows up visibly blurry. */
const ART_MIN_PX = 200;

/**
 * `GET /me/player/currently-playing` — the caller's LIVE playback state, for
 * Home's live "Now playing" widget. Unlike recently-played this is
 * deliberately NOT cached: the whole point is to stay in lockstep with what's
 * actually playing right now (recently-played, cached even briefly, made
 * xomify visibly trail xomware's server-side now-playing).
 *
 * Auth and impersonation are handled entirely by `AuthInterceptor` — this is
 * a direct `api.spotify.com` call, so it automatically carries the caller's
 * (or, while impersonating, the target's) Spotify access token.
 *
 * Spotify returns `204 No Content` when nothing is playing / no active
 * device, and a non-track `item` (an ad, or `null` during a private session)
 * — both map to `isPlaying:false, track:null` so the widget can hide.
 */
@Injectable({ providedIn: 'root' })
export class NowPlayingService {
  private readonly url =
    'https://api.spotify.com/v1/me/player/currently-playing';

  constructor(private http: HttpClient) {}

  getNowPlaying(): Observable<NowPlayingState | null> {
    return this.http
      .get(this.url, { observe: 'response' })
      .pipe(
        map((res: HttpResponse<unknown>) => this.mapResponse(res)),
        catchError((err) => {
          // Degrade, never break the dashboard — a transient Spotify error
          // (or a 403 for an impersonated user who didn't grant playback
          // scope) just means "no live state to show right now".
          console.warn('[NowPlaying] currently-playing fetch failed:', err);
          return of(null);
        }),
      );
  }

  private mapResponse(res: HttpResponse<unknown>): NowPlayingState | null {
    // 204 = nothing playing / no active device (empty body).
    if (res.status === 204 || res.body == null) {
      return null;
    }

    const body = res.body as SpotifyCurrentlyPlaying;
    const item = body.item;
    // `item` is null during a private session, and an ad has `type: 'ad'`
    // with no usable track fields — treat both as "nothing to show".
    if (!item || !item.name) {
      return null;
    }

    const images = item.album?.images ?? item.images ?? [];
    const artists =
      (item.artists ?? []).map((a) => a.name).filter(Boolean).join(', ') ||
      // Podcast episodes have no `artists` — fall back to the show name.
      item.show?.name ||
      '';

    return {
      isPlaying: !!body.is_playing,
      progressMs: body.progress_ms ?? 0,
      durationMs: item.duration_ms ?? 0,
      track: {
        id: item.id ?? '',
        name: item.name,
        artists,
        albumId: item.album?.id ?? null,
        albumArt: pickImage(images, ART_MIN_PX),
        url: item.external_urls?.spotify ?? '',
      },
    };
  }
}

// ── Minimal shapes for the slice of the Spotify payload we read ──────────
interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}
interface SpotifyCurrentlyPlaying {
  is_playing?: boolean;
  progress_ms?: number | null;
  item?: {
    id?: string;
    name?: string;
    duration_ms?: number;
    artists?: { name: string }[];
    album?: { id?: string; images?: SpotifyImage[] };
    images?: SpotifyImage[];
    show?: { name?: string };
    external_urls?: { spotify?: string };
  } | null;
}

/** Smallest image at least `minPx` wide (Spotify lists largest-first), else
 * the largest available. Mirrors `pickAlbumImage` but tolerates the episode
 * image shape too. */
function pickImage(images: SpotifyImage[], minPx: number): string {
  if (!images.length) return '';
  const ascending = [...images].sort(
    (a, b) => (a.width ?? 0) - (b.width ?? 0),
  );
  const big = ascending.find((img) => (img.width ?? 0) >= minPx);
  return (big ?? ascending[ascending.length - 1]).url;
}
