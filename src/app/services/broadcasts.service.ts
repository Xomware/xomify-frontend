import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/**
 * App-update broadcast — contract owned by the sibling WS-B backend PR
 * (`docs/features/xomify-favorites-home-admin/PLAN.md`).
 */
export interface Broadcast {
  id: string;
  title: string;
  body: string;
  activeUntil?: string | null;
  createdAt?: string;
}

interface BroadcastsResponse {
  broadcasts: Broadcast[];
}

@Injectable({
  providedIn: 'root',
})
export class BroadcastsService {
  private readonly apiUrl = `${environment.xomifyApiUrl}/broadcasts/active`;

  constructor(private http: HttpClient) {}

  /**
   * Active app-update broadcasts for the Home banner/spotlight.
   *
   * Contract: `GET /broadcasts/active` -> `{ broadcasts: Broadcast[] }` (an
   * object wrapper, NOT a bare array). The endpoint is owned by a sibling PR
   * that may not be deployed yet, so a 404 (route doesn't exist) or an empty
   * array are both treated as "nothing to show" — degrade to `[]` rather
   * than surfacing an error banner on Home. Expired broadcasts
   * (`activeUntil` in the past) are filtered client-side as a safety net
   * even though the backend is expected to only return currently-active
   * ones.
   */
  getActiveBroadcasts(): Observable<Broadcast[]> {
    return this.http.get<BroadcastsResponse>(this.apiUrl).pipe(
      map((raw) => (Array.isArray(raw?.broadcasts) ? raw.broadcasts : [])),
      map((broadcasts) => broadcasts.filter((b) => this.isActive(b))),
      catchError(() => of([])),
    );
  }

  private isActive(broadcast: Broadcast): boolean {
    if (!broadcast.activeUntil) return true;
    const until = new Date(broadcast.activeUntil).getTime();
    return Number.isNaN(until) ? true : until > Date.now();
  }
}
