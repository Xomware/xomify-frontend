import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

// Pages
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
import { FriendsComponent } from './pages/friends/friends.component';
import { FriendProfileComponent } from './pages/friend-profile/friend-profile.component';
import { RatingsComponent } from './pages/ratings/ratings.component';
import { GroupsComponent } from './pages/groups/groups.component';
import { GroupDetailComponent } from './pages/group-detail/group-detail.component';
import { LikedArtistsPlaylistGeneratorComponent } from './pages/liked-artists-playlist-generator/liked-artists-playlist-generator.component';
import { RecentlyPlayedComponent } from './pages/recently-played/recently-played.component';
import { NewReleasesComponent } from './pages/new-releases/new-releases.component';
import { ArtistDiscoveryComponent } from './pages/artist-discovery/artist-discovery.component';
import { PlaylistAnalysisComponent } from './pages/playlist-analysis/playlist-analysis.component';
import { MoodRecommendationsComponent } from './pages/mood-recommendations/mood-recommendations.component';
import { CollaborativePlaylistsComponent } from './pages/collaborative-playlists/collaborative-playlists.component';
import { ShareComponent } from './pages/share/share.component';
import { StreamingStatsComponent } from './pages/streaming-stats/streaming-stats.component';
import { ConcertDiscoveryComponent } from './pages/concert-discovery/concert-discovery.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
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
    path: 'friends',
    component: FriendsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'friend/:email',
    component: FriendProfileComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'ratings',
    component: RatingsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'groups',
    component: GroupsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'group/:id',
    component: GroupDetailComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'liked-artists-playlist',
    component: LikedArtistsPlaylistGeneratorComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'recently-played',
    component: RecentlyPlayedComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'new-releases',
    component: NewReleasesComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'discover-artists',
    component: ArtistDiscoveryComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'playlist-analysis',
    component: PlaylistAnalysisComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'mood-recommendations',
    component: MoodRecommendationsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'collaborative-playlists',
    component: CollaborativePlaylistsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'share',
    component: ShareComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'streaming-stats',
    component: StreamingStatsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'concerts',
    component: ConcertDiscoveryComponent,
    canActivate: [AuthGuard],
  },
  // Catch-all redirect
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
