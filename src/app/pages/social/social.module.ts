import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SharedModule } from '../../shared/shared.module';

import { FriendsComponent } from '../friends/friends.component';
import { FriendProfileComponent } from '../friend-profile/friend-profile.component';
import { GroupsComponent } from '../groups/groups.component';
import { GroupDetailComponent } from '../group-detail/group-detail.component';
import { CompareComponent } from '../compare/compare.component';
import { FeedComponent } from '../feed/feed.component';
import { AddSongModalComponent } from '../../components/add-song-modal/add-song-modal.component';
import { AddMemberModalComponent } from '../../components/add-member-modal/add-member-modal.component';
import { ShareCardComponent } from '../../components/share-card/share-card.component';
import { TruncatePipe } from '../../pipes/truncate.pipe';

const routes: Routes = [
  { path: 'feed', component: FeedComponent },
  { path: 'friends', component: FriendsComponent },
  { path: 'friend/:email', component: FriendProfileComponent },
  { path: 'groups', component: GroupsComponent },
  { path: 'group/:id', component: GroupDetailComponent },
  { path: 'compare', component: CompareComponent },
];

@NgModule({
  declarations: [
    FeedComponent,
    FriendsComponent,
    FriendProfileComponent,
    GroupsComponent,
    GroupDetailComponent,
    CompareComponent,
    AddSongModalComponent,
    AddMemberModalComponent,
    ShareCardComponent,
    TruncatePipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class SocialModule {}
