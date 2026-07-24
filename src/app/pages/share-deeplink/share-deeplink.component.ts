import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Deep-link landing page for `/share?trackId=<id>`.
 *
 * This route is the web equivalent of the iOS `xomify://share?trackId=` handler.
 * It is reached when a user opens a Spotify-to-Xomify share link on desktop
 * (e.g. after tapping "Copy Link" in Spotify Web and pasting it in a browser).
 *
 * Strategy: redirect to `/my-profile`. The old target — `/feed`, which opened
 * the share composer pre-populated with `trackId` — was removed along with
 * the "feed" feature (docs/features/xomtracks-xomify-merge/PLAN.md); there is
 * no composer to hand `trackId` to anymore, so it's dropped and this just
 * lands the user somewhere sensible instead of a dead route.
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
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.navigate(['/my-profile']);
  }
}
