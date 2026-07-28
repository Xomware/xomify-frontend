import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// ============================================
// Types — match the WS-Backend favorites contract
// (docs/features/xomify-favorites-home-admin/PLAN.md, WS-Backend section).
// "My Favorites" is user-CURATED (hand-ranked), distinct from the
// Spotify-derived "Music Taste" (TopItemsService).
//
// NOTE: endpoint PATHS below reflect the backend's actual shipped routes —
// its API Gateway module forbids path params, so every id (`listId`) is a
// query/body param, never part of the path. This differs from the original
// PLAN.md sketch (`/favorites/list/{listId}`); confirmed with the backend
// implementer mid-build.
// ============================================

export type FavoriteCategory = 'songs' | 'albums' | 'artists';

export interface FavoriteItem {
  rank: number;
  spotifyId: string;
  name: string;
  artist: string;
  imageUrl?: string;
}

export interface FavoritesOverall {
  songs: FavoriteItem[];
  albums: FavoriteItem[];
  artists: FavoriteItem[];
}

export interface FavoritesList {
  listId: string;
  category: FavoriteCategory;
  genreLabel: string;
  items: FavoriteItem[];
}

export interface FavoritesResponse {
  year: number;
  overall: FavoritesOverall;
  lists: FavoritesList[];
}

/** A single rank-change event, as logged by `PUT /favorites/list-set`
 * every time an item's rank changes (add = `fromRank: null`, remove is not
 * logged as a history event). */
export interface FavoritesHistoryEvent {
  ts: string;
  spotifyId: string;
  fromRank: number | null;
  toRank: number;
}

export interface FavoritesHistoryResponse {
  listId: string;
  events: FavoritesHistoryEvent[];
}

/** Mirrors Spotify's own top-items time-range vocabulary (see `TopItemsService`). */
export type FavoritesRecommendationRange = 'short_term' | 'medium_term' | 'long_term';

export interface FavoritesRecommendation {
  spotifyId: string;
  name: string;
  artist: string;
  imageUrl?: string;
  score?: number;
}

export interface FavoritesRecommendationsResponse {
  recommendations: FavoritesRecommendation[];
}

const MAX_RANK = 5;

function emptyOverall(): FavoritesOverall {
  return { songs: [], albums: [], artists: [] };
}

/**
 * Thin API client for `/favorites/*` on xomify's own backend (JWT attached
 * by the global AuthInterceptor — see `interceptors/auth.interceptor.ts`'s
 * `isXomifyApiRequest`).
 *
 * The three "Overall" buckets (songs/albums/artists) are implicit/auto on
 * the backend — `list-set` auto-creates them the first time they're written,
 * keyed by the deterministic id `overall:{year}:{category}` (see
 * {@link overallListId}). That id is also what this service passes to
 * `list-set`/`list-history`/`recommendations` for the Overall sections, so
 * they behave exactly like a real user-created list from the frontend's
 * perspective.
 */
@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly baseUrl = `${environment.xomifyApiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  /** Deterministic id for an "Overall" bucket — matches the backend's own auto-create scheme for implicit lists. */
  overallListId(year: number, category: FavoriteCategory): string {
    return `overall:${year}:${category}`;
  }

  /**
   * `GET /favorites/get?year=YYYY`. A 404 (no favorites saved for this year
   * yet — expected for a brand-new year, or while the backend endpoint is
   * still unmerged) resolves to an empty envelope rather than erroring, so
   * the page can render its empty state instead of an error banner. Any
   * OTHER status propagates so the caller can show a real error + retry.
   */
  getFavorites(year: number): Observable<FavoritesResponse> {
    return this.http
      .get<FavoritesResponse>(`${this.baseUrl}/get`, { params: { year: year.toString() } })
      .pipe(
        map((resp) => ({
          year: resp?.year ?? year,
          overall: resp?.overall ?? emptyOverall(),
          lists: resp?.lists ?? [],
        })),
        catchError((err) => {
          if (err?.status === 404) {
            return of<FavoritesResponse>({ year, overall: emptyOverall(), lists: [] });
          }
          throw err;
        }),
      );
  }

  /** `POST /favorites/list-create` — creates a new user-defined genre list (Overall lists are implicit; never created here). */
  createList(
    year: number,
    category: FavoriteCategory,
    genreLabel: string,
  ): Observable<FavoritesList> {
    return this.http.post<FavoritesList>(`${this.baseUrl}/list-create`, {
      year,
      category,
      genreLabel,
    });
  }

  /** `PUT /favorites/list-set` — sets the full ranked item set (max 5, ranks 1..N) for `listId` in `year`. Server appends a rank-history event per changed rank; auto-creates the implicit Overall list on first write. */
  updateListItems(
    year: number,
    listId: string,
    items: FavoriteItem[],
  ): Observable<FavoritesList> {
    const normalized = items.slice(0, MAX_RANK).map((item, i) => ({ ...item, rank: i + 1 }));
    return this.http.put<FavoritesList>(`${this.baseUrl}/list-set`, {
      year,
      listId,
      items: normalized,
    });
  }

  /** `GET /favorites/list-history?listId=` — movement events (ascending) for the rank-history/timeline UI. Non-fatal on error (timeline just shows "no history yet"). */
  getListHistory(listId: string): Observable<FavoritesHistoryEvent[]> {
    return this.http
      .get<FavoritesHistoryResponse>(`${this.baseUrl}/list-history`, { params: { listId } })
      .pipe(
        map((resp) => resp?.events ?? []),
        catchError(() => of<FavoritesHistoryEvent[]>([])),
      );
  }

  /**
   * `GET /favorites/recommendations?category=&listId=&year=&range=` —
   * suggestions from listening history over the given time period,
   * excluding items already on the list. `range` mirrors Spotify's own
   * short_term/medium_term/long_term time-range vocabulary (already used by
   * `TopItemsService`) — defaults to `short_term` (~4 weeks) so callers that
   * don't care about the period keep the previous behavior. Non-fatal on
   * error (strip just stays empty).
   */
  getRecommendations(
    year: number,
    category: FavoriteCategory,
    listId: string,
    range: FavoritesRecommendationRange = 'short_term',
  ): Observable<FavoritesRecommendation[]> {
    return this.http
      .get<FavoritesRecommendationsResponse>(`${this.baseUrl}/recommendations`, {
        params: { category, listId, year: year.toString(), range },
      })
      .pipe(
        map((resp) => resp?.recommendations ?? []),
        catchError(() => of<FavoritesRecommendation[]>([])),
      );
  }

  /** `DELETE /favorites/list-delete?listId=&year=` — removes a user-created genre list. (Overall buckets can't be deleted — callers should never pass an `overallListId()` here.) */
  deleteList(year: number, listId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/list-delete`, {
      params: { listId, year: year.toString() },
    });
  }

  readonly maxRank = MAX_RANK;
}
