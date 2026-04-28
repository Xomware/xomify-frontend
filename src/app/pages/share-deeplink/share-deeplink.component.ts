import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Deep-link landing page for `/share?trackId=<id>`.
 *
 * This route is the web equivalent of the iOS `xomify://share?trackId=` handler.
 * It is reached when a user opens a Spotify-to-Xomify share link on desktop
 * (e.g. after tapping "Copy Link" in Spotify Web and pasting it in a browser).
 *
 * Strategy: redirect to `/feed` with a `trackId` query param so `FeedComponent`
 * can open the composer pre-populated. The feed page reads the param on init
 * and triggers the composer if present.
 *
 * This is intentionally simple — no track resolution here. The share composer
 * already has a search flow; pre-populating the search query is enough.
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
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const trackId = this.route.snapshot.queryParamMap.get('trackId');
    if (trackId) {
      this.router.navigate(['/feed'], { queryParams: { shareTrackId: trackId } });
    } else {
      this.router.navigate(['/feed']);
    }
  }
}
