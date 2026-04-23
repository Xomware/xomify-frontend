import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  take,
} from 'rxjs/operators';
import { PlaylistService } from 'src/app/services/playlist.service';
import {
  CreateShareRequest,
  MoodTag,
  Share,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

interface SearchTrack {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id?: string;
    name?: string;
    images?: { url: string }[];
  };
  duration_ms?: number;
}

interface MoodOption {
  value: MoodTag;
  label: string;
}

const CAPTION_MAX = 140;
const GENRE_TAG_MAX = 3;

@Component({
  selector: 'app-share-composer',
  templateUrl: './share-composer.component.html',
  styleUrls: ['./share-composer.component.scss'],
})
export class ShareComposerComponent implements OnInit, OnDestroy {
  @Output() shared = new EventEmitter<Share>();
  @Output() closed = new EventEmitter<void>();

  private subscriptions: Subscription[] = [];
  private searchSubject = new Subject<string>();

  readonly captionMax = CAPTION_MAX;
  readonly genreTagMax = GENRE_TAG_MAX;
  readonly moodOptions: MoodOption[] = [
    { value: 'hype', label: 'Hype' },
    { value: 'chill', label: 'Chill' },
    { value: 'sad', label: 'Sad' },
    { value: 'party', label: 'Party' },
    { value: 'focus', label: 'Focus' },
    { value: 'discovery', label: 'Discovery' },
  ];

  // State
  currentEmail = '';
  searchQuery = '';
  searchResults: SearchTrack[] = [];
  searchLoading = false;
  selectedTrack: SearchTrack | null = null;

  caption = '';
  moodTag: MoodTag | '' = '';
  genreInput = '';
  genreTags: string[] = [];

  submitting = false;

  constructor(
    private playlistService: PlaylistService,
    private shareFeedService: ShareFeedService,
    private toastService: ToastService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.currentEmail = this.userService.getEmail();

    const searchSub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length < 2) {
            this.searchLoading = false;
            return [];
          }
          this.searchLoading = true;
          return this.playlistService.searchTracks(query, 10);
        }),
      )
      .subscribe({
        next: (response: { tracks?: { items?: SearchTrack[] } }) => {
          this.searchResults = response?.tracks?.items || [];
          this.searchLoading = false;
        },
        error: () => {
          this.searchResults = [];
          this.searchLoading = false;
        },
      });
    this.subscriptions.push(searchSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close();
    }
  }

  // ============================================
  // Search
  // ============================================

  onSearchInput(): void {
    if (this.selectedTrack && this.searchQuery !== this.selectedTrack.name) {
      this.selectedTrack = null;
    }
    this.searchSubject.next(this.searchQuery);
  }

  selectTrack(track: SearchTrack): void {
    this.selectedTrack = track;
    this.searchResults = [];
  }

  clearSelection(): void {
    this.selectedTrack = null;
    this.searchQuery = '';
    this.searchResults = [];
  }

  // ============================================
  // Caption / mood / genres
  // ============================================

  get captionRemaining(): number {
    return CAPTION_MAX - (this.caption?.length ?? 0);
  }

  addGenreTag(): void {
    const raw = this.genreInput.trim();
    if (!raw) return;
    if (this.genreTags.length >= GENRE_TAG_MAX) {
      this.toastService.showNegativeToast(
        `Max ${GENRE_TAG_MAX} genre tags`,
      );
      return;
    }
    const normalized = raw.toLowerCase();
    if (this.genreTags.includes(normalized)) {
      this.genreInput = '';
      return;
    }
    this.genreTags = [...this.genreTags, normalized];
    this.genreInput = '';
  }

  removeGenreTag(tag: string): void {
    this.genreTags = this.genreTags.filter((t) => t !== tag);
  }

  onGenreKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addGenreTag();
    }
  }

  // ============================================
  // Submit
  // ============================================

  get canSubmit(): boolean {
    if (this.submitting) return false;
    if (!this.selectedTrack) return false;
    if (!this.currentEmail) return false;
    if ((this.caption?.length ?? 0) > CAPTION_MAX) return false;
    return true;
  }

  submit(): void {
    if (!this.canSubmit || !this.selectedTrack) return;

    const track = this.selectedTrack;
    const albumArt = track.album?.images?.[0]?.url || '';
    const artistName = (track.artists || []).map((a) => a.name).join(', ');

    const request: CreateShareRequest = {
      trackId: track.id,
      trackUri: track.uri,
      trackName: track.name,
      artistName,
      albumName: track.album?.name || '',
      albumArtUrl: albumArt,
    };
    if (this.caption.trim()) {
      request.caption = this.caption.trim();
    }
    if (this.moodTag) {
      request.moodTag = this.moodTag;
    }
    if (this.genreTags.length > 0) {
      request.genreTags = this.genreTags;
    }

    this.submitting = true;

    this.shareFeedService
      .createShare(this.currentEmail, request)
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          this.submitting = false;
          const share: Share = {
            shareId: created.shareId,
            email: created.email || this.currentEmail,
            trackId: created.trackId || request.trackId,
            trackUri: created.trackUri || request.trackUri,
            trackName: created.trackName || request.trackName,
            artistName: created.artistName || request.artistName,
            albumName: created.albumName || request.albumName,
            albumArtUrl: created.albumArtUrl || request.albumArtUrl,
            caption: created.caption ?? request.caption,
            moodTag: (created.moodTag as MoodTag | undefined) ?? request.moodTag,
            genreTags: created.genreTags ?? request.genreTags,
            createdAt: created.createdAt || new Date().toISOString(),
            sharedAt: created.sharedAt || created.createdAt,
            queuedCount: 0,
            ratedCount: 0,
            viewerHasQueued: false,
            viewerRating: null,
            sharerRating: null,
          };
          this.shared.emit(share);
        },
        error: (err) => {
          console.error('Error creating share:', err);
          this.submitting = false;
          this.toastService.showNegativeToast('Could not share');
        },
      });
  }

  // ============================================
  // Display helpers
  // ============================================

  getAlbumArt(track: SearchTrack | null): string {
    return track?.album?.images?.[0]?.url || this.getDefaultArt();
  }

  getArtistNames(track: SearchTrack | null): string {
    return (track?.artists || []).map((a) => a.name).join(', ');
  }

  getDefaultArt(): string {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%239c0abf"%3E%3Cpath d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/%3E%3C/svg%3E';
  }
}
