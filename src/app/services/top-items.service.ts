import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// ============================================
// Types — shapes match the deployed backend
// handler `lambdas/user_top_items/handler.py`.
//
// The server caches one response per user per UTC day, so this
// endpoint is safe to call eagerly on page load.
// ============================================

export type TopItemsTimeRange = 'short_term' | 'medium_term' | 'long_term';

/** Spotify track payload — lean shape that covers what the Music Taste pages render. */
export interface TopItemsTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string }[];
    release_date: string;
  };
  duration_ms: number;
  popularity: number;
  explicit: boolean;
  preview_url: string | null;
  external_urls: { spotify: string };
}

/** Spotify artist payload — lean shape that covers what the Music Taste pages render. */
export interface TopItemsArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  popularity: number;
  external_urls: { spotify: string };
}

/** Genres are returned per-time-range as `{ genreName: weight }` aggregated server-side. */
export type TopItemsGenres = Record<string, number>;

/**
 * Top-albums payload (WS-Backend addition) — a simplified, already-flattened
 * shape (NOT the raw Spotify album object tracks/artists use).
 */
export interface TopItemsAlbum {
  spotifyId: string;
  name: string;
  artist: string;
  imageUrl: string;
  trackCount: number;
}

export interface TopItemsByTimeRange<T> {
  short_term: T | null;
  medium_term: T | null;
  long_term: T | null;
}

export interface TopItemsData {
  tracks: TopItemsByTimeRange<TopItemsTrack[]>;
  artists: TopItemsByTimeRange<TopItemsArtist[]>;
  genres: TopItemsByTimeRange<TopItemsGenres>;
  /**
   * Albums dimension — added by a sibling backend PR (WS-Backend, see
   * `docs/features/xomify-favorites-home-admin/PLAN.md`). Optional because
   * a backend deployed before that PR lands omits the key entirely; every
   * consumer must treat `undefined` the same as "no albums available" and
   * degrade gracefully (e.g. hide an Albums tab) rather than erroring.
   */
  albums?: TopItemsByTimeRange<TopItemsAlbum[]>;
  meta?: {
    /** Time ranges that failed upstream at Spotify on this fetch. Empty/omitted on full success. */
    failed_ranges?: TopItemsTimeRange[];
  };
}

export interface TopItemsErrorBody {
  code: string;
  message: string;
}

export interface TopItemsResponse {
  data: TopItemsData;
  error: TopItemsErrorBody | null;
  meta: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class TopItemsService {
  private readonly apiUrl = `${environment.xomifyApiUrl}/user/top-items`;

  constructor(private http: HttpClient) {}

  /**
   * Fetch the signed-in user's top tracks, artists, and genres across all
   * three Spotify time ranges in a single round-trip.
   *
   * The server caches one response per user per UTC day, so callers can fire
   * this on page mount without worrying about Spotify rate limits.
   *
   * Auth is provided by the global JWT interceptor — no header needed here.
   *
   * The backend's `success_response` returns the body raw (no `{ data, error,
   * meta }` envelope). Wrap the raw payload into the envelope shape here so
   * existing callers' `response.data.tracks` access pattern keeps working
   * without forcing a refactor across all Music Taste pages.
   */
  getTopItems(): Observable<TopItemsResponse> {
    return this.http.get<unknown>(this.apiUrl).pipe(
      map((raw) => {
        if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
          return raw as TopItemsResponse;
        }
        return {
          data: raw as TopItemsData,
          error: null,
          meta: {},
        };
      }),
    );
  }
}
