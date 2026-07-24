import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/** POST /heard/set echoes back the caller's new state for the track. */
export interface XtHeardState {
  trackKey: string;
  heard: boolean;
  heardAt: number | null;
}

/**
 * The caller's per-track "heard" flag. Keyed on the shared `trackKey`
 * (`utils/xomtracks-track-display.ts::xtTrackKey`) so every share of the same
 * song rolls into one state — the same key the ratings + ×N grouping use.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksHeardService {
  private readonly baseUrl = `${environment.xomtracksApiUrl}/heard`;

  constructor(private http: HttpClient) {}

  /** POST /heard/set — mark a track heard/unheard for the caller. */
  set(trackKey: string, heard: boolean): Observable<XtHeardState> {
    return this.http
      .post<XtApiEnvelope<XtHeardState>>(`${this.baseUrl}/set`, { trackKey, heard })
      .pipe(
        map((res) => {
          if (res.error) throw res.error;
          return res.data;
        })
      );
  }
}
