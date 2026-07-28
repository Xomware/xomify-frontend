import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';

/** Minimum gap between logged visits — collapses rapid-fire `NavigationEnd`
 * bursts (e.g. a guard redirect chain landing on its final route) into a
 * single log call. */
const THROTTLE_MS = 400;

/**
 * Lightweight page-visit tracker backing the Admin Portal's Users→visits
 * view. Wired app-wide from `AppComponent` on every router `NavigationEnd`
 * — see `AppComponent.ngOnInit`. `POST {xomifyApiUrl}/visits/log {path}`,
 * best-effort (a failed log call is swallowed; telemetry must never surface
 * as a user-facing error or break navigation).
 *
 * - Deduped: identical consecutive paths (e.g. a redirect chain that
 *   resolves back to the same route) only log once.
 * - Throttled: `debounceTime` collapses rapid navigation bursts.
 * - Skips logged-out callers entirely — checked at emission time (after the
 *   debounce), not at call time, so a login that completes mid-debounce is
 *   still honored correctly.
 */
@Injectable({ providedIn: 'root' })
export class VisitTrackerService {
  private readonly path$ = new Subject<string>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {
    this.path$
      .pipe(
        distinctUntilChanged(),
        debounceTime(THROTTLE_MS),
        filter(() => this.authService.isLoggedIn()),
        switchMap((path) =>
          this.http.post(`${environment.xomifyApiUrl}/visits/log`, { path }).pipe(
            // Best-effort telemetry — never let a failed log call surface
            // anywhere or interrupt the stream for the next navigation.
            catchError(() => EMPTY),
          ),
        ),
      )
      .subscribe();
  }

  /** Call on every `NavigationEnd` with the resolved path (no query/hash). */
  log(path: string): void {
    this.path$.next(path);
  }
}
