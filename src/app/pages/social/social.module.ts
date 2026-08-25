import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

import { FriendsComponent } from '../friends/friends.component';
import { FriendProfileComponent } from '../friend-profile/friend-profile.component';
import { InvitesComponent } from '../invites/invites.component';
import { NotificationSettingsComponent } from '../notification-settings/notification-settings.component';
import { LikesComponent } from '../likes/likes.component';
import { ShareDetailComponent } from '../share-detail/share-detail.component';
import { ShareCardComponent } from '../../components/share-card/share-card.component';
import { ReactionsBarComponent } from '../../components/reactions-bar/reactions-bar.component';
import { CommentThreadComponent } from '../../components/comment-thread/comment-thread.component';
import { FriendsRatedListComponent } from '../../components/friends-rated-list/friends-rated-list.component';
import { FriendsQueuedListComponent } from '../../components/friends-queued-list/friends-queued-list.component';
import { NotificationsInboxComponent } from '../notifications-inbox/notifications-inbox.component';
import { TruncatePipe } from '../../pipes/truncate.pipe';

// NOTE: the old "feed" (post/browse track shares among Xomify friends) and
// "groups" (shared song queues) features were removed here — the Xomtracks
// feature (`pages/xomtracks`) replaces this space. `ShareCardComponent` and
// `ShareFeedService` are KEPT: both still back `share-detail` below and the
// Posts tab on `my-profile`. See docs/features/xomtracks-xomify-merge/PLAN.md.
const routes: Routes = [
  { path: 'friends', component: FriendsComponent },
  { path: 'friend/:email', component: FriendProfileComponent },
  { path: 'invites', component: InvitesComponent },
  // The inbox. Web's ONLY notification surface — the browser has no APNs
  // registration, so nothing reaches a user here except by their opening it.
  { path: 'notifications', component: NotificationsInboxComponent },
  // Device-token register/unregister. A developer utility, not a preferences
  // screen: per-kind opt-ins live on the DEVICE-TOKEN row and the browser has
  // no device token to attach them to.
  {
    path: 'settings/notifications',
    component: NotificationSettingsComponent,
  },
  { path: 'likes', component: LikesComponent },
  { path: 'likes/:email', component: LikesComponent },
  // Share-detail page (xomify-backend/lambdas/shares_detail). Mirrors iOS
  // FeedView.swift:124-126,145-151 navigation to ShareDetailView.
  { path: 'share/:shareId', component: ShareDetailComponent },
];

@NgModule({
  declarations: [
    FriendsComponent,
    FriendProfileComponent,
    InvitesComponent,
    NotificationSettingsComponent,
    NotificationsInboxComponent,
    LikesComponent,
    ShareDetailComponent,
    ShareCardComponent,
    ReactionsBarComponent,
    CommentThreadComponent,
    FriendsRatedListComponent,
    FriendsQueuedListComponent,
    TruncatePipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class SocialModule {}
