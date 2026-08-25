import { inject, NgModule } from '@angular/core';
import { CanMatchFn, RouterModule, Routes, UrlSegment } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { AdminGuard } from './guards/admin.guard';

import { HomeComponent } from './pages/home/home.component';
import { CallbackComponent } from './components/callback/callback.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { TopSongsComponent } from './pages/top-songs/top-songs.component';
import { TopArtistsComponent } from './pages/top-artists/top-artists.component';
import { TopGenresComponent } from './pages/top-genres/top-genres.component';
import { ArtistProfileComponent } from './pages/artist-profile/artist-profile.component';
import { FollowingComponent } from './pages/following/following.component';
import { QueueBuilderComponent } from './pages/queue-builder/queue-builder.component';
import { AlbumDetailComponent } from './pages/album-detail/album-detail.component';
import { PlaylistDetailComponent } from './pages/playlist-detail/playlist-detail.component';
import { MyPlaylistsComponent } from './pages/my-playlists/my-playlists.component';
import { WrappedComponent } from './pages/wrapped/wrapped.component';
import { ReleaseRadarComponent } from './pages/release-radar/release-radar.component';
import { RatingsComponent } from './pages/ratings/ratings.component';
import { SearchComponent } from './pages/search/search.component';
import { ShareDeeplinkComponent } from './pages/share-deeplink/share-deeplink.component';

/**
 * `canMatch`, not `canActivate` — the difference is the whole point. A failing
 * `canActivate` blocks navigation; a failing `canMatch` makes the router move
 * on to the NEXT route config. That is what lets `/` resolve to two completely
 * different things depending on auth, without either one knowing about the
 * other.
 */
const isAuthenticated: CanMatchFn = () => inject(AuthService).isLoggedIn();

/**
 * The landing route is `path: ''` with `loadChildren`, which matches by PREFIX
 * — left unqualified it would shadow `/callback`, `/my-profile` and everything
 * else below it, and Angular fetches the lazy chunk BEFORE discovering no child
 * route matches. Checking the segment count keeps the chunk to the one URL that
 * actually renders it.
 */
const isSignedOutRoot: CanMatchFn = (_route, segments: UrlSegment[]) =>
  segments.length === 0 && !inject(AuthService).isLoggedIn();

const routes: Routes = [
  // Signed IN: the dashboard.
  {
    path: '',
    pathMatch: 'full',
    component: HomeComponent,
    canMatch: [isAuthenticated],
  },
  // Signed OUT: the landing page, lazily fetched. Keeping GSAP out of the
  // initial bundle for authed users is the reason this is a route split rather
  // than an *ngIf inside HomeComponent.
  {
    path: '',
    canMatch: [isSignedOutRoot],
    loadChildren: () =>
      import('./pages/landing/landing.module').then((m) => m.LandingModule),
  },
  { path: 'callback', component: CallbackComponent },
  {
    path: 'my-profile',
    component: MyProfileComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'top-songs',
    component: TopSongsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'top-artists',
    component: TopArtistsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'top-genres',
    component: TopGenresComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'artist-profile/:id',
    component: ArtistProfileComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'wrapped',
    component: WrappedComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'release-radar',
    component: ReleaseRadarComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'following',
    component: FollowingComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'album/:id',
    component: AlbumDetailComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'playlist/:id',
    component: PlaylistDetailComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'my-playlists',
    component: MyPlaylistsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'playlist-builder',
    component: QueueBuilderComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'ratings',
    component: RatingsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'search',
    component: SearchComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'share',
    component: ShareDeeplinkComponent,
    canActivate: [AuthGuard],
  },
  // Lazy-loaded feature modules
  {
    path: 'shares',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./pages/xomtracks/xomtracks.module').then((m) => m.XomtracksModule),
  },
  // My Favorites — user-curated best-of lists (WS-D, distinct from the
  // Spotify-derived Music Taste pages above).
  {
    path: 'favorites',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./pages/favorites/favorites.module').then((m) => m.FavoritesModule),
  },
  // Legacy route — the Shares feature used to live at `/xomtracks`. Keep a
  // redirect so old links/bookmarks (incl. `/xomtracks/admin`) still land.
  { path: 'xomtracks', redirectTo: 'shares', pathMatch: 'prefix' },
  // xomify-level Admin Portal (WS-B) — Broadcasts authoring + a link out to
  // the Shares Admin Portal. AuthGuard proves the caller is logged in;
  // AdminGuard additionally proves they're the admin (client-side
  // ADMIN_EMAIL check against the xomify JWT) before the chunk even loads.
  {
    path: 'admin',
    canActivate: [AuthGuard, AdminGuard],
    loadChildren: () =>
      import('./pages/admin/admin.module').then((m) => m.AdminModule),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./pages/social/social.module').then((m) => m.SocialModule),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./pages/analytics/analytics.module').then(
        (m) => m.AnalyticsModule
      ),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./pages/discovery/discovery.module').then(
        (m) => m.DiscoveryModule
      ),
  },
  // Catch-all redirect
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
