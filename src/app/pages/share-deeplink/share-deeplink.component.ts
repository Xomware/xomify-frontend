import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/** Spotify track ids are 22-char base62 (`[0-9A-Za-z]`) strings. */
const SPOTIFY_TRACK_ID_RE = /^[0-9A-Za-z]{22}$/;

/**
 * Deep-link landing page for `/share?trackId=<id>`.
 *
 * This route is the web equivalent of the iOS `xomify://share?trackId=` handler.
 * It is reached when a user opens a Spotify-to-Xomify share link on desktop
 * (e.g. after tapping "Copy Link" in Spotify Web and pasting it in a browser).
 *
 * Strategy: the old target — `/feed`, which opened the share composer
 * pre-populated with `trackId` — was removed along with the "feed" feature
 * (docs/features/xomtracks-xomify-merge/PLAN.md), so there is no in-app
 * composer to hand `trackId` to anymore. If a plausible `trackId` is present,
 * send the user straight to the track on open.spotify.com instead of
 * dropping it — that's still useful and isn't a dead end. Otherwise fall
 * back to `/my-profile`.
 */
@Component({
  selector: 'app-share-deeplink',
  template: `
    <div class="deeplink-loading">
      <p>Opening Xomify…</p>
    </div>
  `,
  styles: [`
    .deeplink-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0d0d1a;
      color: #fff;
      font-family: sans-serif;
    }
  `],
})
export class ShareDeeplinkComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const trackId = this.route.snapshot.queryParamMap.get('trackId');
    if (trackId && SPOTIFY_TRACK_ID_RE.test(trackId)) {
      window.location.href = `https://open.spotify.com/track/${trackId}`;
      return;
    }
    this.router.navigate(['/my-profile']);
  }
}
