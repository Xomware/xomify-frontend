import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { XtMePlaylistsResponse } from '../models/xomtracks-playlists.model';
import { unwrapEnvelope } from './xomtracks-envelope';

interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * Reads the caller's rolling playlist ids. Maps to xomtracks-backend's
 * `me_playlists` handler (`GET /me/playlists`). Authed — the caller's xomify
 * JWT is attached by `AuthInterceptor`. Replaces the old hardcoded
 * `XT_ROLLING_PLAYLISTS` config, which only ever worked for Dom's own ids.
 *
 * Not cached: `own` starts null and only appears once a caller opts in and
 * their extractor's first rolling-cron run builds it, so a fresh fetch on
 * each panel open is cheap and keeps that transition honest without needing
 * an explicit cache-bust hook.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksPlaylistsService {
  private readonly url = `${environment.xomtracksApiUrl}/me/playlists`;

  constructor(private http: HttpClient) {}

  /** GET /me/playlists — the caller's own + baseline rolling playlist pairs. */
  get(): Observable<XtMePlaylistsResponse> {
    return this.http
      .get<XtApiEnvelope<XtMePlaylistsResponse>>(this.url)
      .pipe(map((res) => unwrapEnvelope(res)));
  }
}
