import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
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
import { RecentlyPlayedComponent } from './pages/recently-played/recently-played.component';
import { LikedArtistsPlaylistGeneratorComponent } from './pages/liked-artists-playlist-generator/liked-artists-playlist-generator.component';

import { AuthService } from './services/auth.service';

@NgModule({
  declarations: [
    AppComponent,
    ToolbarComponent,
    FooterComponent,
    ToastComponent,
    CallbackComponent,
    AmbientBackgroundComponent,
    HomeComponent,
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
    RecentlyPlayedComponent,
    LikedArtistsPlaylistGeneratorComponent,
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
  providers: [AuthService, provideHttpClient(withInterceptorsFromDi())],
})
export class AppModule {}
