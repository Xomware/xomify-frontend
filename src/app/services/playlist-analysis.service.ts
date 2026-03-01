import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PlaylistService } from './playlist.service';

export interface AudioFeatures {
  id: string;
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
}

export interface TrackWithFeatures {
  id: string;
  name: string;
  artists: string;
  albumArt: string;
  spotifyUrl: string;
  features: AudioFeatures;
}

export interface PlaylistAnalysis {
  avgBpm: number;
  avgEnergy: number;
  avgDanceability: number;
  avgValence: number;
  avgAcousticness: number;
  tracks: TrackWithFeatures[];
}

@Injectable({
  providedIn: 'root',
})
export class PlaylistAnalysisService {
  private readonly spotifyBase = 'https://api.spotify.com/v1';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private playlistService: PlaylistService
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken()}`,
    });
  }

  getAudioFeatures(trackIds: string[]): Observable<AudioFeatures[]> {
    if (trackIds.length === 0) return of([]);

    // Batch into groups of 100
    const batches: string[][] = [];
    for (let i = 0; i < trackIds.length; i += 100) {
      batches.push(trackIds.slice(i, i + 100));
    }

    const requests = batches.map((batch) =>
      this.http
        .get<{ audio_features: AudioFeatures[] }>(
          `${this.spotifyBase}/audio-features?ids=${batch.join(',')}`,
          { headers: this.getHeaders() }
        )
        .pipe(
          map((res) => (res.audio_features || []).filter((f) => f !== null)),
          catchError(() => of([] as AudioFeatures[]))
        )
    );

    return forkJoin(requests).pipe(
      map((results) => results.flat())
    );
  }

  analyzePlaylist(playlistId: string): Observable<PlaylistAnalysis> {
    // Fetch all tracks from playlist
    return this.fetchAllPlaylistTracks(playlistId).pipe(
      switchMap((trackItems) => {
        const validTracks = trackItems.filter((t: any) => t.track && t.track.id);
        const trackIds = validTracks.map((t: any) => t.track.id);

        return this.getAudioFeatures(trackIds).pipe(
          map((features) => {
            const featureMap = new Map<string, AudioFeatures>();
            features.forEach((f) => featureMap.set(f.id, f));

            const tracks: TrackWithFeatures[] = [];
            let sumBpm = 0, sumEnergy = 0, sumDance = 0, sumValence = 0, sumAcoustic = 0;
            let count = 0;

            for (const item of validTracks) {
              const track = item.track;
              const feat = featureMap.get(track.id);
              if (!feat) continue;

              sumBpm += feat.tempo;
              sumEnergy += feat.energy;
              sumDance += feat.danceability;
              sumValence += feat.valence;
              sumAcoustic += feat.acousticness;
              count++;

              tracks.push({
                id: track.id,
                name: track.name,
                artists: (track.artists || []).map((a: any) => a.name).join(', '),
                albumArt: track.album?.images?.[0]?.url || '',
                spotifyUrl: track.external_urls?.spotify || '',
                features: feat,
              });
            }

            return {
              avgBpm: count > 0 ? Math.round(sumBpm / count) : 0,
              avgEnergy: count > 0 ? Math.round((sumEnergy / count) * 100) : 0,
              avgDanceability: count > 0 ? Math.round((sumDance / count) * 100) : 0,
              avgValence: count > 0 ? Math.round((sumValence / count) * 100) : 0,
              avgAcousticness: count > 0 ? Math.round((sumAcoustic / count) * 100) : 0,
              tracks,
            } as PlaylistAnalysis;
          })
        );
      })
    );
  }

  private fetchAllPlaylistTracks(playlistId: string): Observable<any[]> {
    return this.playlistService.getPlaylistTracks(playlistId, 50, 0).pipe(
      switchMap((res) => {
        const items = res.items || [];
        const total = res.total || 0;

        if (total <= 50) return of(items);

        const requests: Observable<any>[] = [of(res)];
        for (let offset = 50; offset < total; offset += 50) {
          requests.push(this.playlistService.getPlaylistTracks(playlistId, 50, offset));
        }

        return forkJoin(requests).pipe(
          map((responses) => responses.flatMap((r) => r.items || []))
        );
      }),
      catchError(() => of([]))
    );
  }
}
