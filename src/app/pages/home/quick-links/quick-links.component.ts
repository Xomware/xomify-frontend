import { Component, Input } from '@angular/core';

export interface QuickLink {
  label: string;
  description: string;
  route: string[];
  icon: 'shares' | 'music-taste' | 'favorites' | 'playlists';
  /** When false, the tile renders as disabled with a "Coming soon" badge instead of navigating. */
  available: boolean;
}

/**
 * Static quick-navigation tiles into the app's main surfaces. Presentational
 * only — `available` per link lets Home degrade the Favorites tile until
 * WS-D (My Favorites) ships without hard-coding that knowledge here.
 */
@Component({
  selector: 'app-home-quick-links',
  templateUrl: './quick-links.component.html',
  styleUrls: ['./quick-links.component.scss'],
})
export class QuickLinksComponent {
  @Input() favoritesAvailable = false;

  get links(): QuickLink[] {
    return [
      {
        label: 'Shares',
        description: 'See what friends are sharing',
        route: ['/shares'],
        icon: 'shares',
        available: true,
      },
      {
        label: 'Music Taste',
        description: 'Your top songs, artists & genres',
        route: ['/top-songs'],
        icon: 'music-taste',
        available: true,
      },
      {
        label: 'My Favorites',
        description: 'Your curated all-time top lists',
        route: ['/favorites'],
        icon: 'favorites',
        available: this.favoritesAvailable,
      },
      {
        label: 'Playlists',
        description: 'Browse and manage your playlists',
        route: ['/my-playlists'],
        icon: 'playlists',
        available: true,
      },
    ];
  }
}
