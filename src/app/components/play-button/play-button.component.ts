import {
  Component,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  SimpleChanges,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  PreviewPlayerService,
  PreviewTrack,
} from 'src/app/services/preview-player.service';

/**
 * 30-second preview play/pause button, shared across every song surface in
 * the app. Backed by `PreviewPlayerService` (Spotify preview_url -> iTunes
 * fallback -> HTML5 Audio) instead of the Spotify Web Playback SDK, so it
 * works for free-tier users with no live Spotify device.
 *
 * States: idle -> loading (resolving/buffering) -> playing, or unavailable
 * (neither source has a preview) which swaps the button for a subtle
 * "Open in Spotify" link rather than leaving a dead control.
 */
@Component({
  selector: 'app-play-button',
  templateUrl: './play-button.component.html',
  styleUrls: ['./play-button.component.scss'],
})
export class PlayButtonComponent implements OnInit, OnChanges, OnDestroy {
  @Input() trackId!: string;
  /** Track title — required to resolve an iTunes fallback preview. */
  @Input() title = '';
  /** Primary artist name(s) — required to resolve an iTunes fallback preview. */
  @Input() artist = '';
  /** Spotify's own preview_url, when the caller already has it. */
  @Input() previewUrl?: string | null;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() variant: 'filled' | 'outline' | 'ghost' = 'filled';
  /** Deep link used both by the "unavailable" fallback and as a last resort. */
  @Input() spotifyUrl?: string;

  @Output() playClicked = new EventEmitter<string>();

  isPlaying = false;
  isLoading = false;
  isUnavailable = false;

  private subscriptions: Subscription[] = [];

  constructor(private previewPlayer: PreviewPlayerService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.previewPlayer.currentTrackId$.subscribe((currentId) => {
        this.isPlaying =
          currentId === this.trackId && this.previewPlayer.isCurrentlyPlaying;
      }),
      this.previewPlayer.isPlaying$.subscribe((playing) => {
        this.isPlaying = this.previewPlayer.currentTrackId === this.trackId && playing;
      }),
      this.previewPlayer.isLoading$.subscribe((loading) => {
        this.isLoading = this.previewPlayer.currentTrackId === this.trackId && loading;
      }),
      this.previewPlayer.unavailable$.subscribe((id) => {
        if (id === this.trackId) {
          this.isUnavailable = true;
        }
      }),
    );
    this.refreshKnownUnavailable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trackId'] && !changes['trackId'].firstChange) {
      this.refreshKnownUnavailable();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  togglePlay(event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    this.playClicked.emit(this.trackId);

    const track: PreviewTrack = {
      id: this.trackId,
      title: this.title,
      artist: this.artist,
      previewUrl: this.previewUrl,
    };
    this.previewPlayer.toggle(track);
  }

  get fallbackUrl(): string {
    return this.spotifyUrl || `https://open.spotify.com/track/${this.trackId}`;
  }

  private refreshKnownUnavailable(): void {
    this.isUnavailable = this.previewPlayer.isKnownUnavailable(this.trackId);
  }
}
