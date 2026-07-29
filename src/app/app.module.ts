import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { SharedModule } from './shared/shared.module';

// Shell components (always loaded)
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/toast/toast.component';
import { CallbackComponent } from './components/callback/callback.component';
import { AmbientBackgroundComponent } from './components/ambient-background/ambient-background.component';

// Eagerly-loaded pages (core navigation)
import { HomeComponent } from './pages/home/home.component';
import { BroadcastBannerComponent } from './pages/home/broadcast-banner/broadcast-banner.component';
import { ActiveListeningComponent } from './pages/home/active-listening/active-listening.component';
import { TopItemsRotatorComponent } from './pages/home/top-items-rotator/top-items-rotator.component';
import { SpotlightRotatorComponent } from './pages/home/spotlight-rotator/spotlight-rotator.component';
import { QuickLinksComponent } from './pages/home/quick-links/quick-links.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { TopSongsComponent } from './pages/top-songs/top-songs.component';
import { TopArtistsComponent } from './pages/top-artists/top-artists.component';
import { TopGenresComponent } from './pages/top-genres/top-genres.component';
import { ArtistProfileComponent } from './pages/artist-profile/artist-profile.component';
import { AlbumDetailComponent } from './pages/album-detail/album-detail.component';
import { PlaylistDetailComponent } from './pages/playlist-detail/playlist-detail.component';
import { MyPlaylistsComponent } from './pages/my-playlists/my-playlists.component';
import { FollowingComponent } from './pages/following/following.component';
import { QueueBuilderComponent } from './pages/queue-builder/queue-builder.component';
import { WrappedComponent } from './pages/wrapped/wrapped.component';
import { ReleaseRadarComponent } from './pages/release-radar/release-radar.component';
import { RatingsComponent } from './pages/ratings/ratings.component';
import { SearchComponent } from './pages/search/search.component';
import { ShareDeeplinkComponent } from './pages/share-deeplink/share-deeplink.component';

import { AuthService } from './services/auth.service';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    ToolbarComponent,
    FooterComponent,
    ToastComponent,
    CallbackComponent,
    AmbientBackgroundComponent,
    HomeComponent,
    BroadcastBannerComponent,
    ActiveListeningComponent,
    TopItemsRotatorComponent,
    SpotlightRotatorComponent,
    QuickLinksComponent,
    MyProfileComponent,
    TopSongsComponent,
    TopArtistsComponent,
    TopGenresComponent,
    ArtistProfileComponent,
    AlbumDetailComponent,
    PlaylistDetailComponent,
    MyPlaylistsComponent,
    FollowingComponent,
    QueueBuilderComponent,
    WrappedComponent,
    ReleaseRadarComponent,
    RatingsComponent,
    SearchComponent,
    ShareDeeplinkComponent,
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    DragDropModule,
    BrowserAnimationsModule,
    SharedModule,
  ],
  providers: [
    AuthService,
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    // Block app bootstrap until the per-user Xomify JWT is in localStorage.
    // Without this, components that fire API calls in their constructors race
    // with the async mint and 401 because the helper can no longer fall back
    // to a query/body `email` (sub-feature 1j). The factory is a no-op when
    // the user isn't logged in via Spotify or already has a valid JWT.
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => {
        if (!auth.isLoggedIn()) {
          return Promise.resolve();
        }
        return firstValueFrom(auth.ensureXomifyJwt()).catch(() => null);
      },
      deps: [AuthService],
      multi: true,
    },
  ],
})
export class AppModule {}
