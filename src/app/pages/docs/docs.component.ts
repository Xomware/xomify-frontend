import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import {
  LinkEntry,
  XOMIFY_DOCS,
  XOMIFY_IOS,
  XOMIFY_REPOS,
} from 'src/app/data/xomware-apps.data';

interface Step {
  readonly n: number;
  readonly title: string;
  readonly body: string;
}

interface Feature {
  readonly title: string;
  readonly body: string;
  readonly detail: string;
}

/**
 * Public documentation page.
 *
 * Absorbs the landing page's "How it works" explainer rather than duplicating
 * it. The landing journey already demonstrates the product; anyone who wants
 * the written version ends up here, and maintaining two prose explanations of
 * the same four steps guarantees they drift.
 */
@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsComponent {
  readonly iosApp = XOMIFY_IOS;
  readonly repos: readonly LinkEntry[] = XOMIFY_REPOS;
  readonly docs: readonly LinkEntry[] = XOMIFY_DOCS;

  readonly steps: readonly Step[] = [
    {
      n: 1,
      title: 'Connect Spotify',
      body:
        'One OAuth handshake. Xomify never sees your password — Spotify hands ' +
        'back a token scoped to reading your listening and managing playlists ' +
        'it creates.',
    },
    {
      n: 2,
      title: 'It snapshots what you play',
      body:
        'Your top tracks, artists and genres are recorded over time, so you get ' +
        'history rather than a single rolling number. This is what makes ' +
        'month-to-month comparison possible at all.',
    },
    {
      n: 3,
      title: 'Playlists appear on their own',
      body:
        'Wrapped is generated on the first of each month; Release Radar every ' +
        'Saturday. Both land directly in your Spotify account, and both are ' +
        'kept — nothing overwrites last month.',
    },
    {
      n: 4,
      title: 'Share and hear back',
      body:
        'Send a track to a friend and you find out whether they queued it, ' +
        'played it, and what they rated it. That second half is the part a ' +
        'group chat cannot give you.',
    },
  ];

  readonly features: readonly Feature[] = [
    {
      title: 'Music Taste',
      body: 'Top songs, artists and genres across every window from four weeks to all time.',
      detail: 'Ranks are kept as they change, so last month is still there to compare against.',
    },
    {
      title: 'Monthly Wrapped',
      body: 'A playlist of your month, generated on the 1st and pushed to Spotify.',
      detail: 'Every month is kept. Email and push when a new one lands.',
    },
    {
      title: 'Release Radar',
      body: 'Everything released this week by artists you already follow.',
      detail: 'Calendar and list views, queueable in place, with full week history.',
    },
    {
      title: 'Playlist Builder',
      body: 'Drag tracks into a queue from anywhere in the app, then push it to Spotify.',
      detail: 'Analysis reports tempo, energy, valence and artist concentration.',
    },
    {
      title: 'Shares',
      body: 'Send a song to a friend and get their reaction, rating and comments back.',
      detail: 'Notifications tell you the moment someone listens or rates.',
    },
    {
      title: 'Discovery',
      body: 'Mood-based picks, concerts from artists in your rotation, and music news.',
      detail: 'Plus every song you have ever liked, searchable.',
    },
  ];

  constructor(private authService: AuthService) {}

  login(): void {
    this.authService.login();
  }
}
