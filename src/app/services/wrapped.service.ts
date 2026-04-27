import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface MonthlyWrap {
  monthKey: string; // "YYYY-MM" format
  topSongIds: {
    short_term: string[];
    medium_term: string[];
    long_term: string[];
  };
  topArtistIds: {
    short_term: string[];
    medium_term: string[];
    long_term: string[];
  };
  topGenres: {
    short_term: { [genre: string]: number };
    medium_term: { [genre: string]: number };
    long_term: { [genre: string]: number };
  };
  createdAt: string;
}

export interface WrappedDataResponse {
  active: boolean;
  activeWrapped: boolean;
  activeReleaseRadar: boolean;
  wraps: MonthlyWrap[];
}

@Injectable({
  providedIn: 'root',
})
export class WrappedService {
  private xomifyApiUrl: string = environment.xomifyApiUrl;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  constructor(private http: HttpClient) {}

  /**
   * Get all wrapped data for a user including enrollment status and history.
   * Returns wraps sorted newest first.
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1h).
   */
  getUserWrappedData(_email: string): Observable<WrappedDataResponse> {
    const url = `${this.xomifyApiUrl}/wrapped/all`;
    return this.http
      .get<WrappedDataResponse>(url)
      .pipe(
        map((response) => {
          // Ensure wraps array exists
          if (!response.wraps) {
            response.wraps = [];
          }
          return response;
        }),
        catchError((error) => {
          console.error('Error fetching wrapped data:', error);
          return of({
            active: false,
            activeWrapped: false,
            activeReleaseRadar: false,
            wraps: [],
          });
        }),
      );
  }

  /**
   * Get wrapped data for a specific month.
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1h).
   */
  getWrappedMonth(
    _email: string,
    monthKey: string,
  ): Observable<MonthlyWrap | null> {
    const url = `${this.xomifyApiUrl}/wrapped/month?monthKey=${encodeURIComponent(monthKey)}`;
    return this.http.get<MonthlyWrap>(url).pipe(
      catchError((error) => {
        console.error(`Error fetching wrapped for ${monthKey}:`, error);
        return of(null);
      }),
    );
  }

  /**
   * Get all wrapped data for a specific year.
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1h).
   */
  getWrappedYear(_email: string, year: string): Observable<MonthlyWrap[]> {
    const url = `${this.xomifyApiUrl}/wrapped/year?year=${encodeURIComponent(year)}`;
    return this.http
      .get<MonthlyWrap[]>(url)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching wrapped for year ${year}:`, error);
          return of([]);
        }),
      );
  }

  /**
   * Opt user in or out of monthly wrapped.
   *
   * The `email` arg is retained for call-site compatibility but is no longer
   * forwarded — caller identity comes from the JWT context (1h). `userId` and
   * `refreshToken` are token-persistence fields and stay in the body.
   */
  optInOrOutUserForWrapped(
    _email: string,
    userId: string,
    refreshToken: string,
    optIn: boolean,
  ): Observable<any> {
    const url = `${this.xomifyApiUrl}/wrapped/all`;
    const body = {
      userId: userId,
      refreshToken: refreshToken,
      active: optIn,
    };
    return this.http.post(url, body);
  }
}
