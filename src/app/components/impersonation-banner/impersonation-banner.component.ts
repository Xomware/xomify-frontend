import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ImpersonationService } from '../../services/impersonation.service';

/**
 * Persistent, warning-colored bar rendered at the very top of the app shell
 * (above `app-toolbar` — see `app.component.html`) any time
 * `ImpersonationService.isImpersonating$` is true. Visible on every page,
 * survives navigation and refresh (the service persists the target to
 * localStorage).
 *
 * Its visibility drives `--impersonation-banner-h` on `.app-container`
 * (see `app.component.scss`), which both `app-toolbar` and `.content` read
 * to shift down and stay clear of the fixed toolbar — see those files for
 * the mechanism.
 *
 * Spotify-derived surfaces (top items, recently-played, playlists, the
 * greeting) DO reflect the target now — impersonation swaps in the target's
 * Spotify access token (see `ImpersonationService`). `spotifyTokenUnavailable$`
 * is only true when minting that token failed (e.g. the backend endpoint
 * isn't deployed yet, or the target has no stored Spotify refresh token);
 * in that case Spotify-derived surfaces silently fall back to the admin's
 * own data, so the banner calls that out explicitly rather than leaving it
 * silently wrong.
 */
@Component({
  selector: 'app-impersonation-banner',
  templateUrl: './impersonation-banner.component.html',
  styleUrls: ['./impersonation-banner.component.scss'],
})
export class ImpersonationBannerComponent {
  readonly impersonatedEmail$: Observable<string | null>;
  readonly spotifyTokenUnavailable$: Observable<boolean>;

  constructor(
    private impersonation: ImpersonationService,
    private router: Router,
  ) {
    this.impersonatedEmail$ = this.impersonation.impersonatedEmail$;
    this.spotifyTokenUnavailable$ = this.impersonation.spotifyTokenUnavailable$;
  }

  exit(): void {
    this.impersonation.exit();
    this.router.navigateByUrl('/admin');
  }
}
