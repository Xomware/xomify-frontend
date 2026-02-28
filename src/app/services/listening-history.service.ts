import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface RecentlyPlayedItem {
  track: {
    id: string;
    name: string;
    uri: string;
    external_urls: { spotify: string };
    artists: { id: string; name: string }[];
    album: {
      id: string;
      name: string;
      images: { url: string; width: number; height: number }[];
    };
    duration_ms: number;
  };
  played_at: string;
}

export interface RecentlyPlayedResponse {
  items: RecentlyPlayedItem[];
  next: string | null;
  cursors?: { before: string; after: string };
  limit: number;
  href: string;
}

export interface PlaySession {
  date: Date;
  label: string;
  items: RecentlyPlayedItem[];
}

@Injectable({
  providedIn: 'root',
})
export class ListeningHistoryService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';
  private readonly cacheKey = 'xomify_recently_played';
  private readonly cacheTTL = 10 * 60 * 1000; // 10 minutes

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  getRecentlyPlayed(): Observable<RecentlyPlayedResponse> {
    const cached = this.getCache();
    if (cached) {
      return of(cached);
    }

    return this.http
      .get<RecentlyPlayedResponse>(
        `${this.spotifyBase}/me/player/recently-played?limit=50`,
        { headers: this.getHeaders() }
      )
      .pipe(
        tap((response) => {
          this.setCache(response);
        }),
        catchError((err) => {
          console.error('[ListeningHistory] Error fetching recently played:', err);
          throw err;
        })
      );
  }

  groupIntoSessions(items: RecentlyPlayedItem[]): PlaySession[] {
    if (!items || items.length === 0) return [];

    const sessions: PlaySession[] = [];
    let currentSession: RecentlyPlayedItem[] = [];
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

    // Items come newest-first from Spotify; sort oldest-first for grouping
    const sorted = [...items].sort(
      (a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];

      if (currentSession.length === 0) {
        currentSession.push(item);
      } else {
        const prev = currentSession[currentSession.length - 1];
        const gap =
          new Date(item.played_at).getTime() -
          new Date(prev.played_at).getTime();

        if (gap > SESSION_GAP_MS) {
          // New session
          const sessionDate = new Date(currentSession[0].played_at);
          sessions.push({
            date: sessionDate,
            label: this.formatSessionLabel(sessionDate),
            items: [...currentSession].reverse(), // newest first for display
          });
          currentSession = [item];
        } else {
          currentSession.push(item);
        }
      }
    }

    if (currentSession.length > 0) {
      const sessionDate = new Date(currentSession[0].played_at);
      sessions.push({
        date: sessionDate,
        label: this.formatSessionLabel(sessionDate),
        items: [...currentSession].reverse(),
      });
    }

    // Return sessions newest-first
    return sessions.reverse();
  }

  private formatSessionLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (sessionDay.getTime() === today.getTime()) {
      return `Today · Session starting at ${timeStr}`;
    } else if (sessionDay.getTime() === yesterday.getTime()) {
      return `Yesterday · Session starting at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return `${dateStr} · Session starting at ${timeStr}`;
    }
  }

  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  }

  clearCache(): void {
    sessionStorage.removeItem(this.cacheKey);
  }

  private getCache(): RecentlyPlayedResponse | null {
    try {
      const cached = sessionStorage.getItem(this.cacheKey);
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > this.cacheTTL) {
        sessionStorage.removeItem(this.cacheKey);
        return null;
      }
      return data.response;
    } catch {
      return null;
    }
  }

  private setCache(response: RecentlyPlayedResponse): void {
    sessionStorage.setItem(
      this.cacheKey,
      JSON.stringify({ response, timestamp: Date.now() })
    );
  }
}
