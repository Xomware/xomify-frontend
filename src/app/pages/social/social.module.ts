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
import { CollaborativePlaylistsComponent } from '../collaborative-playlists/collaborative-playlists.component';
import { AddSongModalComponent } from '../../components/add-song-modal/add-song-modal.component';
import { AddMemberModalComponent } from '../../components/add-member-modal/add-member-modal.component';
import { TruncatePipe } from '../../pipes/truncate.pipe';

const routes: Routes = [
  { path: 'friends', component: FriendsComponent },
  { path: 'friend/:email', component: FriendProfileComponent },
  { path: 'groups', component: GroupsComponent },
  { path: 'group/:id', component: GroupDetailComponent },
  { path: 'compare', component: CompareComponent },
  { path: 'collaborative-playlists', component: CollaborativePlaylistsComponent },
];

@NgModule({
  declarations: [
    FriendsComponent,
    FriendProfileComponent,
    GroupsComponent,
    GroupDetailComponent,
    CompareComponent,
    CollaborativePlaylistsComponent,
    AddSongModalComponent,
    AddMemberModalComponent,
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
