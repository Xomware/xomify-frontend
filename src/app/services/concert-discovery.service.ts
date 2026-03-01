import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ArtistService } from './artist.service';
import { environment } from 'src/environments/environment';

// ─── Ticketmaster API Response Types ────────────────────
export interface TicketmasterVenue {
  name: string;
  city: { name: string };
  state?: { stateCode: string };
  country: { countryCode: string };
}

export interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  dates: {
    start: {
      localDate: string;   // "2026-04-15"
      localTime?: string;  // "19:30:00"
    };
    status: { code: string };
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
  images?: { url: string; width: number; height: number }[];
}

export interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalElements: number;
  };
}

// ─── App-level types ─────────────────────────────────────
export interface ConcertEvent {
  id: string;
  eventName: string;
  artistName: string;
  artistImage: string;
  artistId: string;
  venue: string;
  city: string;
  date: string;       // ISO date string
  time?: string;
  ticketUrl: string;
  notifyMe: boolean;  // from localStorage
}

export interface ArtistConcerts {
  artist: any;         // Spotify artist object
  events: ConcertEvent[];
  hasShows: boolean;
}

// ─── Mock Data ───────────────────────────────────────────
const MOCK_EVENTS: Record<string, TicketmasterResponse> = {
  default: {
    _embedded: {
      events: [
        {
          id: 'evt-001',
          name: 'Summer Sounds Festival 2026',
          url: 'https://www.ticketmaster.com/event/evt-001',
          dates: { start: { localDate: '2026-04-15', localTime: '19:30:00' }, status: { code: 'onsale' } },
          _embedded: { venues: [{ name: 'Madison Square Garden', city: { name: 'New York' }, state: { stateCode: 'NY' }, country: { countryCode: 'US' } }] },
          images: [{ url: '', width: 640, height: 360 }],
        },
        {
          id: 'evt-002',
          name: 'World Tour 2026',
          url: 'https://www.ticketmaster.com/event/evt-002',
          dates: { start: { localDate: '2026-05-20', localTime: '20:00:00' }, status: { code: 'onsale' } },
          _embedded: { venues: [{ name: 'The Forum', city: { name: 'Los Angeles' }, state: { stateCode: 'CA' }, country: { countryCode: 'US' } }] },
          images: [{ url: '', width: 640, height: 360 }],
        },
        {
          id: 'evt-003',
          name: 'Intimate Acoustic Night',
          url: 'https://www.ticketmaster.com/event/evt-003',
          dates: { start: { localDate: '2026-06-10', localTime: '21:00:00' }, status: { code: 'onsale' } },
          _embedded: { venues: [{ name: 'Red Rocks Amphitheatre', city: { name: 'Morrison' }, state: { stateCode: 'CO' }, country: { countryCode: 'US' } }] },
          images: [{ url: '', width: 640, height: 360 }],
        },
        {
          id: 'evt-004',
          name: 'Arena Tour 2026',
          url: 'https://www.ticketmaster.com/event/evt-004',
          dates: { start: { localDate: '2026-07-22', localTime: '19:00:00' }, status: { code: 'onsale' } },
          _embedded: { venues: [{ name: 'United Center', city: { name: 'Chicago' }, state: { stateCode: 'IL' }, country: { countryCode: 'US' } }] },
          images: [{ url: '', width: 640, height: 360 }],
        },
        {
          id: 'evt-005',
          name: 'Fall Festival Headline',
          url: 'https://www.ticketmaster.com/event/evt-005',
          dates: { start: { localDate: '2026-09-05', localTime: '18:00:00' }, status: { code: 'onsale' } },
          _embedded: { venues: [{ name: 'Gorge Amphitheatre', city: { name: 'George' }, state: { stateCode: 'WA' }, country: { countryCode: 'US' } }] },
          images: [{ url: '', width: 640, height: 360 }],
        },
      ],
    },
    page: { totalElements: 5 },
  },
};

const STORAGE_KEY = 'xomify_concert_notifications';

@Injectable({
  providedIn: 'root',
})
export class ConcertDiscoveryService {
  private ticketmasterBaseUrl = 'https://app.ticketmaster.com/discovery/v2/events.json';
  private useMock = true; // flip to false when real API key is available

  constructor(
    private http: HttpClient,
    private artistService: ArtistService
  ) {
    // Use mock unless a real key is configured
    const apiKey = (environment as any).ticketmasterApiKey;
    if (apiKey && apiKey !== '' && apiKey !== 'MOCK') {
      this.useMock = false;
    }
  }

  // ─── Main: get concerts for user's top artists ─────────
  getConcertsForTopArtists(): Observable<ArtistConcerts[]> {
    return this.artistService.getTopArtists('medium_term', 10).pipe(
      map((response: any) => {
        const artists = response?.items || response || [];
        return artists.slice(0, 10);
      }),
      map((artists: any[]) => {
        // For mock mode, distribute events across artists deterministically
        return this.assignMockEvents(artists);
      })
    );
  }

  private assignMockEvents(artists: any[]): ArtistConcerts[] {
    const allEvents = MOCK_EVENTS['default']._embedded?.events || [];
    const notifications = this.getNotifications();

    return artists.map((artist, idx) => {
      // Give ~60% of artists some shows (deterministic by index)
      const hasShows = idx % 3 !== 2; // indices 0,1,3,4,6,7,9 get shows
      const artistEvents: ConcertEvent[] = [];

      if (hasShows) {
        // Each artist with shows gets 1-2 events
        const startIdx = idx % allEvents.length;
        const count = idx % 2 === 0 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const tmEvent = allEvents[(startIdx + i) % allEvents.length];
          const venue = tmEvent._embedded?.venues?.[0];
          const eventId = `${artist.id}-${tmEvent.id}`;
          artistEvents.push({
            id: eventId,
            eventName: `${artist.name} — ${tmEvent.name}`,
            artistName: artist.name,
            artistImage: artist.images?.[0]?.url || '',
            artistId: artist.id,
            venue: venue?.name || 'TBA',
            city: venue ? `${venue.city.name}, ${venue.state?.stateCode || venue.country.countryCode}` : 'TBA',
            date: tmEvent.dates.start.localDate,
            time: tmEvent.dates.start.localTime,
            ticketUrl: tmEvent.url,
            notifyMe: !!notifications[eventId],
          });
        }
      }

      return {
        artist,
        events: artistEvents,
        hasShows: artistEvents.length > 0,
      };
    });
  }

  // ─── Notifications (localStorage) ──────────────────────
  getNotifications(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  toggleNotification(eventId: string): boolean {
    const notifs = this.getNotifications();
    notifs[eventId] = !notifs[eventId];
    if (!notifs[eventId]) delete notifs[eventId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
    return !!notifs[eventId];
  }

  // ─── Date filtering ────────────────────────────────────
  filterByDateRange(concerts: ArtistConcerts[], days: number): ArtistConcerts[] {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return concerts.map((ac) => ({
      ...ac,
      events: ac.events.filter((e) => {
        const d = new Date(e.date);
        return d >= now && d <= cutoff;
      }),
      hasShows: ac.events.some((e) => {
        const d = new Date(e.date);
        return d >= now && d <= cutoff;
      }),
    }));
  }

  // ─── Formatting helpers ────────────────────────────────
  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatTime(timeStr?: string): string {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
}
