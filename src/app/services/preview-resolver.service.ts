import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

/** Shape of the bits of the iTunes Search API response we actually read. */
interface ItunesSearchResponse {
  resultCount: number;
  results: Array<{ previewUrl?: string | null }>;
}

const SESSION_STORAGE_PREFIX = 'xomify:preview-fallback:';

/**
 * Resolves a 30-second preview audio URL for a track that has no usable
 * Spotify `preview_url` (Spotify has been dropping these), via the free,
 * CORS-enabled iTunes Search API. No auth required.
 *
 * Results (including confirmed misses) are cached both in-memory for the
 * life of the app and in `sessionStorage` so repeat visits to the same
 * track within a tab don't refetch. A `null` cache entry means "we already
 * asked iTunes and it has nothing" — as valid a result as a URL.
 */
@Injectable({
  providedIn: 'root',
})
export class PreviewResolverService {
  /** In-memory cache of in-flight/completed lookups, keyed by search term. */
  private readonly cache = new Map<string, Observable<string | null>>();

  constructor(private http: HttpClient) {}

  /**
   * Resolves a preview URL for `artist` + `title`, or `null` if none of the
   * fallback sources have one. Never throws — network/parse failures resolve
   * to `null` so callers can treat "no preview" uniformly.
   */
  resolve(title: string, artist: string): Observable<string | null> {
    const key = this.cacheKey(title, artist);
    if (!key) {
      return of(null);
    }

    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const fromSession = this.readSessionCache(key);
    if (fromSession !== undefined) {
      const result$ = of(fromSession);
      this.cache.set(key, result$);
      return result$;
    }

    const term = `${artist} ${title}`.trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term,
    )}&entity=song&limit=1`;

    const result$ = this.http.get<ItunesSearchResponse>(url).pipe(
      map((resp) => resp?.results?.[0]?.previewUrl || null),
      catchError(() => of(null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(key, result$);
    result$.subscribe((value) => this.writeSessionCache(key, value));
    return result$;
  }

  private cacheKey(title: string, artist: string): string | null {
    const t = title?.trim().toLowerCase() ?? '';
    const a = artist?.trim().toLowerCase() ?? '';
    if (!t && !a) return null;
    return `${a}::${t}`;
  }

  private readSessionCache(key: string): string | null | undefined {
    try {
      const raw = window.sessionStorage?.getItem(SESSION_STORAGE_PREFIX + key);
      if (raw === null || raw === undefined) return undefined;
      return raw === '' ? null : raw;
    } catch {
      // sessionStorage unavailable (private mode, SSR, etc.) — just skip caching.
      return undefined;
    }
  }

  private writeSessionCache(key: string, value: string | null): void {
    try {
      window.sessionStorage?.setItem(SESSION_STORAGE_PREFIX + key, value ?? '');
    } catch {
      // Ignore quota/availability errors — in-memory cache still works.
    }
  }
}
