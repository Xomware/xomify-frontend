import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { Friend } from 'src/app/services/friends.service';

/**
 * "Me / Friends" switch plus the friend chooser, shared by Wrapped, Release
 * Radar and Music Taste.
 *
 * Mirrors `Xomify-iOS/Views/Shared/FriendScopePicker.swift`. Those screens
 * differ in what they render, not in whose data they show, so the switch is
 * one component rather than three.
 *
 * Standalone so it can be imported by the existing NgModules without moving
 * anything into a shared module.
 */
@Component({
  selector: 'app-friend-scope-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './friend-scope-picker.component.html',
  styleUrls: ['./friend-scope-picker.component.scss'],
})
export class FriendScopePickerComponent {
  @Input() showingFriends = false;
  @Input() friends: Friend[] = [];
  @Input() selectedEmail: string | null = null;

  @Output() showingFriendsChange = new EventEmitter<boolean>();
  @Output() selectedEmailChange = new EventEmitter<string>();

  selectScope(showingFriends: boolean): void {
    if (this.showingFriends === showingFriends) return;
    this.showingFriends = showingFriends;
    this.showingFriendsChange.emit(showingFriends);
  }

  selectFriend(friend: Friend): void {
    const email = friend.friendEmail ?? friend.email;
    if (!email || email === this.selectedEmail) return;
    this.selectedEmail = email;
    this.selectedEmailChange.emit(email);
  }

  displayName(friend: Friend): string {
    return friend.displayName || friend.friendEmail || friend.email || 'Friend';
  }

  emailOf(friend: Friend): string {
    return friend.friendEmail ?? friend.email ?? '';
  }
}
