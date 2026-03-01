import { Component, OnInit } from '@angular/core';
import { take, switchMap } from 'rxjs/operators';
import {
  MoodRecommendationsService,
  MoodPreset,
  RecommendedTrack,
  MOOD_PRESETS,
} from 'src/app/services/mood-recommendations.service';
import { PlaylistService } from 'src/app/services/playlist.service';
import { UserService } from 'src/app/services/user.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-mood-recommendations',
  templateUrl: './mood-recommendations.component.html',
  styleUrls: ['./mood-recommendations.component.scss'],
})
export class MoodRecommendationsComponent implements OnInit {
  loading = false;
  savingPlaylist = false;
  error = '';

  moodPresets: MoodPreset[] = MOOD_PRESETS;
  selectedMood: MoodPreset | null = null;
  tracks: RecommendedTrack[] = [];

  constructor(
    private moodService: MoodRecommendationsService,
    private playlistService: PlaylistService,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {}

  selectMood(mood: MoodPreset): void {
    this.selectedMood = mood;
    this.tracks = [];
    this.error = '';
  }

  getRecommendations(): void {
    if (!this.selectedMood) return;
    this.loading = true;
    this.error = '';
    this.tracks = [];

    const mood = this.selectedMood;

    this.moodService
      .getUserTopTrackIds()
      .pipe(
        take(1),
        switchMap((ids) => {
          const seedIds = ids.length > 0 ? ids : [];
          if (seedIds.length === 0) {
            // Use genre seeds fallback if no top tracks
            return this.moodService.getRecommendations(mood, ['4uLU6hMCjMI75M1A2tKUQC']); // generic fallback
          }
          return this.moodService.getRecommendations(mood, seedIds);
        })
      )
      .subscribe({
        next: (result) => {
          this.tracks = result;
          this.loading = false;
          if (result.length === 0) {
            this.error = 'No recommendations found for this mood. Try another!';
          }
        },
        error: (err) => {
          console.error('Error fetching recommendations:', err);
          this.error = 'Failed to get recommendations. Please try again.';
          this.loading = false;
        },
      });
  }

  saveAsPlaylist(): void {
    if (!this.selectedMood || this.tracks.length === 0) return;
    this.savingPlaylist = true;

    const userId = this.userService.getUserId();
    if (!userId) {
      this.toastService.showNegativeToast('Could not get user ID');
      this.savingPlaylist = false;
      return;
    }

    const uris = this.tracks.map((t) => t.uri);
    const name = `${this.selectedMood.emoji} ${this.selectedMood.name} Vibes — Xomify`;
    const description = `${this.selectedMood.description} — Created with Xomify Mood Picks`;

    this.playlistService
      .createPlaylistWithTracks(userId, name, description, uris)
      .pipe(take(1))
      .subscribe({
        next: (playlist) => {
          this.savingPlaylist = false;
          this.toastService.showPositiveToast(`Playlist "${name}" saved!`);
        },
        error: (err) => {
          console.error('Error saving playlist:', err);
          this.savingPlaylist = false;
          this.toastService.showNegativeToast('Failed to save playlist');
        },
      });
  }

  openSpotify(url: string, event: Event): void {
    event.stopPropagation();
    window.open(url, '_blank');
  }

  getAlbumArt(track: RecommendedTrack): string {
    const images = track.album?.images;
    if (images && images.length > 0) {
      return images[0].url;
    }
    return 'assets/img/placeholder.png';
  }

  getArtistNames(track: RecommendedTrack): string {
    return (track.artists || []).map((a) => a.name).join(', ');
  }

  getDuration(track: RecommendedTrack): string {
    return this.moodService.formatDuration(track.duration_ms);
  }
}
