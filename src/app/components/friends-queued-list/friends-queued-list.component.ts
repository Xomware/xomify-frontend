import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { ShareInteractionEntry } from 'src/app/services/share-feed.service';

/**
 * Drilldown modal opened from the "friends queued" stat tile on the share
 * detail page. Read-only list of every friend who queued the share.
 *
 * Mirrors `Xomify-iOS/Views/Feed/FriendsQueuedListView.swift`.
 */
@Component({
  selector: 'app-friends-queued-list',
  templateUrl: './friends-queued-list.component.html',
  styleUrls: ['./friends-queued-list.component.scss'],
})
export class FriendsQueuedListComponent {
  @Input() trackName = '';
  @Input() listeners: ShareInteractionEntry[] = [];

  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  trackByEmail(_index: number, entry: ShareInteractionEntry): string {
    return entry.email;
  }

  authorOf(entry: ShareInteractionEntry): string {
    return entry.displayName && entry.displayName.trim().length > 0
      ? entry.displayName
      : entry.email;
  }

  initialOf(entry: ShareInteractionEntry): string {
    return this.authorOf(entry).charAt(0).toUpperCase() || '?';
  }

  get countLabel(): string {
    return this.listeners.length === 1
      ? '1 friend queued this'
      : `${this.listeners.length} friends queued this`;
  }
}
