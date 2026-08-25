import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { PlaylistService } from 'src/app/services/playlist.service';
import { SongService } from 'src/app/services/song.service';
import { UserService } from 'src/app/services/user.service';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { ToastService } from 'src/app/services/toast.service';
import {
  LinkEntry,
  XOMIFY_DOCS,
  XOMIFY_REPOS,
  XOMWARE_APPS,
  XOMWARE_URL,
  XomwareApp,
} from 'src/app/data/xomware-apps.data';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit, OnDestroy {
  /**
   * `compact` is the in-app footer — credit line, the route-dependent action
   * button, and a single source link. Unchanged behaviour, and the default so
   * every existing usage keeps working untouched.
   *
   * `full` is the landing page's three-column footer.
   */
  @Input() variant: 'full' | 'compact' = 'compact';

  showDynamicButton = false;
  footerButtonText = '';
  githubRepoUrl = 'https://github.com/Xomware/xomify-frontend';

  readonly xomwareUrl = XOMWARE_URL;
  readonly xomwareApps: readonly XomwareApp[] = XOMWARE_APPS;
  readonly repos: readonly LinkEntry[] = XOMIFY_REPOS;
  readonly docs: readonly LinkEntry[] = XOMIFY_DOCS;
  readonly year = new Date().getFullYear();
  userId = '';
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private songService: SongService,
    private playlistService: PlaylistService,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.userId = this.userService.getUserId();
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const url = this.router.url;

      if (url.includes('/artist')) {
        this.showDynamicButton = true;
        this.footerButtonText = 'Go Back';
      } else if (url.includes('/top-songs')) {
        this.showDynamicButton = true;
        this.footerButtonText = 'Download Playlist';
      } else {
        this.showDynamicButton = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  handleDynamicButtonClick(): void {
    const url = this.router.url;

    if (url.includes('/artist')) {
      this.router.navigate(['/top-artists']);
    } else if (url.includes('/top-songs')) {
      const currentTerm = this.songService.getCurrentTerm();
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      let currentTopSongs: { uri: string }[] = [];
      let playlistName = '';
      const playlistDesc = 'Top songs created by https://xomify.xomware.com';

      if (currentTerm === 'short_term') {
        currentTopSongs = this.songService.getShortTermTopTracks();
        playlistName = `Last Month Top Songs: ${formattedDate}`;
      } else if (currentTerm === 'medium_term') {
        currentTopSongs = this.songService.getMedTermTopTracks();
        playlistName = `Last 6 Months Top Songs: ${formattedDate}`;
      } else {
        currentTopSongs = this.songService.getLongTermTopTracks();
        playlistName = `Last Year Top Songs: ${formattedDate}`;
      }

      const currentTopSongsUriList: string[] = currentTopSongs.map(
        (track) => track.uri
      );
      this.userId = this.userService.getUserId();
      this.playlistService
        .createPlaylist(this.userId, playlistName, playlistDesc)
        .pipe(take(1))
        .subscribe({
          next: (playlist: { id: string }) => {
            this.playlistService
              .addPlaylistSongs(playlist, currentTopSongsUriList)
              .pipe(take(1))
              .subscribe({
                next: () => {
                  this.playlistService
                    .uploadXomifyLogo(playlist.id)
                    .pipe(take(1))
                    .subscribe({
                      error: (err: unknown) => {
                        console.error('Error uploading image:', err);
                        this.toastService.showNegativeToast(
                          'Error uploading playlist image'
                        );
                      },
                    });
                },
                error: (err: unknown) => {
                  console.error('Error Adding Items to Playlist', err);
                  this.toastService.showNegativeToast(
                    'Error adding songs to playlist'
                  );
                },
                complete: () => {
                  this.toastService.showPositiveToast(
                    'Playlist successfully added to your Spotify account!'
                  );
                },
              });
          },
          error: (err: unknown) => {
            console.error('Error Creating Playlist', err);
            this.toastService.showNegativeToast('Error creating playlist');
          },
        });
    }
  }

  openGitHubRepo(): void {
    window.open(this.githubRepoUrl, '_blank');
  }
}
