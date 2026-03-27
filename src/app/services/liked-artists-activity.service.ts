import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { ArtistService } from './artist.service';
import { UserService } from './user.service';

// ============================================
// Activity Models
// ============================================

export type ActivityType = 'album' | 'single' | 'appears_on';

export interface ArtistActivity {
  artistId: string;
  artistName: string;
  artistImage: string | null;
  activities: Activity[];
  lastActivityDate: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  releaseDate: string;
  imageUrl: string | null;
  uri: string;
  spotifyUrl: string;
  artistId: string;
  artistName: string;
  albumId: string;
  totalTracks: number;
}

export interface ActivityTimeline {
  activities: TimelineEntry[];
  stats: TimelineStats;
  generatedAt: string;
}

export interface TimelineEntry {
  date: string;
  dayName: string;
  activities: Activity[];
  count: number;
}

export interface TimelineStats {
  totalActivities: number;
  totalArtists: number;
  albumCount: number;
  singleCount: number;
  appearsOnCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// ============================================
// Service
// ============================================

@Injectable({
  providedIn: 'root',
})
export class LikedArtistsActivityService {
  private readonly cacheKey = 'xomify_liked_artists_activity';
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes
  private readonly daysToCheck = 30; // Check last 30 days of activity

  constructor(
    private artistService: ArtistService,
    private userService: UserService
  ) {}

  /**
   * Load activity timeline for all followed artists
   * Fetches recent releases from each artist and builds a reverse-chronological timeline
   */
  loadActivityTimeline(): Observable<ActivityTimeline> {
    // Check cache first
    const cached = this.getCache();
    if (cached) {
      return of(cached);
    }

    // Get all followed artists
    return this.userService.getAllFollowedArtists().pipe(
      catchError((err) => {
        console.error('[LikedArtistsActivity] Error fetching followed artists:', err);
        return of([]);
      }),
      map((artists) => {
        if (!artists || artists.length === 0) {
          return [];
        }

        // Fetch recent releases for each artist in parallel
        const artistActivityRequests = artists.map((artist) =>
          this.fetchArtistRecentActivity(artist).pipe(
            catchError((err) => {
              console.error(
                `[LikedArtistsActivity] Error fetching activity for ${artist.name}:`,
                err
              );
              return of(null);
            })
          )
        );

        return artistActivityRequests;
      }),
      // Use forkJoin to wait for all requests (but we need to switch to another observable)
      catchError(() => of([])),
      map((requests) => {
        if (!requests || requests.length === 0) {
          return {
            activities: [],
            stats: this.createEmptyStats(),
            generatedAt: new Date().toISOString(),
          };
        }

        // We need to handle the observable properly - return a special marker
        return requests;
      })
    ).pipe(
      // Switch observable handling - we need a different approach
      switchMap((requests: any) => {
        if (!Array.isArray(requests) || requests.length === 0) {
          return of({
            activities: [],
            stats: this.createEmptyStats(),
            generatedAt: new Date().toISOString(),
          });
        }

        // Use forkJoin to wait for all activities to be fetched
        return forkJoin(requests).pipe(
          map((allActivities: (ArtistActivity | null)[]) => {
            return this.buildTimeline(allActivities.filter((a) => a !== null) as ArtistActivity[]);
          })
        );
      }),
      tap((timeline) => {
        this.setCache(timeline);
      })
    );
  }

  /**
   * Fetch recent activity (releases) for a single artist
   */
  private fetchArtistRecentActivity(
    artist: any
  ): Observable<ArtistActivity> {
    return this.artistService
      .getArtistRecentReleases(artist.id, 10)
      .pipe(
        map((response) => {
          const activities = this.parseActivities(
            response.items || [],
            artist.id,
            artist.name
          );

          return {
            artistId: artist.id,
            artistName: artist.name,
            artistImage: artist.images?.[0]?.url || null,
            activities: activities,
            lastActivityDate: activities.length > 0 ? activities[0].releaseDate : '',
          };
        })
      );
  }

  /**
   * Parse album/single releases into Activity objects
   */
  private parseActivities(
    releases: any[],
    artistId: string,
    artistName: string
  ): Activity[] {
    const activities: Activity[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - this.daysToCheck * 24 * 60 * 60 * 1000);

    for (const release of releases) {
      const releaseDate = new Date(release.release_date);

      // Only include recent releases (last 30 days)
      if (releaseDate >= thirtyDaysAgo) {
        activities.push({
          id: release.id,
          type: this.determineActivityType(release),
          title: release.name,
          releaseDate: release.release_date,
          imageUrl: release.images?.[0]?.url || null,
          uri: release.uri,
          spotifyUrl: this.buildSpotifyUrl(release.uri),
          artistId: artistId,
          artistName: artistName,
          albumId: release.id,
          totalTracks: release.total_tracks || 0,
        });
      }
    }

    // Sort by release date descending (newest first)
    return activities.sort((a, b) => {
      return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
    });
  }

  /**
   * Determine the type of activity (album, single, or appears_on)
   */
  private determineActivityType(release: any): ActivityType {
    const albumType = release.album_type || release.type || 'album';

    if (albumType === 'album') {
      return 'album';
    } else if (albumType === 'single') {
      return 'single';
    } else {
      return 'appears_on';
    }
  }

  /**
   * Build Spotify URL from URI
   */
  private buildSpotifyUrl(uri: string): string {
    const parts = uri.split(':');
    if (parts.length === 3) {
      return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
    }
    return '';
  }

  /**
   * Build the timeline from all artist activities
   */
  private buildTimeline(artistActivities: ArtistActivity[]): ActivityTimeline {
    const allActivities: Activity[] = [];
    let albumCount = 0;
    let singleCount = 0;
    let appearsOnCount = 0;

    // Flatten all activities from all artists
    for (const artistActivity of artistActivities) {
      for (const activity of artistActivity.activities) {
        allActivities.push(activity);
        if (activity.type === 'album') albumCount++;
        else if (activity.type === 'single') singleCount++;
        else appearsOnCount++;
      }
    }

    // Sort by release date (newest first)
    allActivities.sort((a, b) => {
      return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
    });

    // Group by date
    const timelineMap = new Map<string, Activity[]>();
    for (const activity of allActivities) {
      const date = activity.releaseDate;
      if (!timelineMap.has(date)) {
        timelineMap.set(date, []);
      }
      timelineMap.get(date)!.push(activity);
    }

    // Build timeline entries sorted by date (newest first)
    const timeline: TimelineEntry[] = [];
    const sortedDates = Array.from(timelineMap.keys()).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    for (const date of sortedDates) {
      const activities = timelineMap.get(date) || [];
      timeline.push({
        date: date,
        dayName: this.formatDateWithDay(date),
        activities: activities,
        count: activities.length,
      });
    }

    const stats: TimelineStats = {
      totalActivities: allActivities.length,
      totalArtists: artistActivities.length,
      albumCount,
      singleCount,
      appearsOnCount,
      dateRange: {
        start: allActivities.length > 0 ? allActivities[allActivities.length - 1].releaseDate : '',
        end: allActivities.length > 0 ? allActivities[0].releaseDate : '',
      },
    };

    return {
      activities: timeline,
      stats,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Format date with day name (e.g., "Mon, Feb 24, 2025")
   */
  private formatDateWithDay(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Force refresh timeline by clearing cache
   */
  forceRefresh(): Observable<ActivityTimeline> {
    this.clearCache();
    return this.loadActivityTimeline();
  }

  // ============================================
  // Cache Management
  // ============================================

  private getCache(): ActivityTimeline | null {
    try {
      const cached = sessionStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      if (now - data.timestamp > this.cacheTTL) {
        sessionStorage.removeItem(this.cacheKey);
        return null;
      }

      return data.response;
    } catch {
      return null;
    }
  }

  private setCache(timeline: ActivityTimeline): void {
    const data = {
      response: timeline,
      timestamp: Date.now(),
    };
    try {
      sessionStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch {
      console.warn('[LikedArtistsActivity] Failed to cache timeline');
    }
  }

  private clearCache(): void {
    sessionStorage.removeItem(this.cacheKey);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private createEmptyStats(): TimelineStats {
    return {
      totalActivities: 0,
      totalArtists: 0,
      albumCount: 0,
      singleCount: 0,
      appearsOnCount: 0,
      dateRange: {
        start: '',
        end: '',
      },
    };
  }

  /**
   * Get activity badge color based on type
   */
  getActivityColor(type: ActivityType): string {
    switch (type) {
      case 'album':
        return '#1DB954'; // Spotify green
      case 'single':
        return '#1ed760'; // Light green
      case 'appears_on':
        return '#1e88e5'; // Blue
      default:
        return '#888888'; // Gray
    }
  }

  /**
   * Get activity badge label based on type
   */
  getActivityLabel(type: ActivityType): string {
    switch (type) {
      case 'album':
        return 'Album';
      case 'single':
        return 'Single';
      case 'appears_on':
        return 'Feature';
      default:
        return 'Release';
    }
  }
}
