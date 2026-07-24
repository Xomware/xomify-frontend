import { Component, EventEmitter, Input, Output } from '@angular/core';
import { XtShare } from '../../models/xomtracks-share.model';
import {
  xtDisplayTitle,
  xtOpenLabel,
  xtPlatformLabel,
  xtPrimaryUrl,
  xtRelativeDate,
} from '../../utils/xomtracks-track-display';

/**
 * Presentational card for a single share. Renders cover art + metadata,
 * opens the detail modal when its trigger is activated, and surfaces a
 * uniform "open in platform" icon-button in a fixed corner of the cover art
 * — same spot on every card, matched or not — so a card is never a dead end.
 */
@Component({
  selector: 'app-xomtracks-share-card',
  templateUrl: './xomtracks-share-card.component.html',
  styleUrls: ['./xomtracks-share-card.component.scss'],
})
export class XomtracksShareCardComponent {
  @Input({ required: true }) share!: XtShare;

  /** Number of underlying shares of this track (for the ×N badge). 1 = no badge. */
  @Input() shareCount = 1;

  /** Grouped sharer summary ("Tori, Jack +1") for shared-with-me; when set it
   * replaces the single-sharer name. Empty falls back to the one sharer. */
  @Input() sharerSummary = '';

  /** The track group's key, for the whole-group rating control. */
  @Input() trackKey = '';

  /** The caller's "heard" state for this track (drives the toggle + dim). */
  @Input() heard = false;

  /** Emitted when the card's trigger is activated so the feed opens the modal. */
  @Output() open = new EventEmitter<XtShare>();

  /** Emitted with a 1..5 value when the caller sets a rating from the card. */
  @Output() rate = new EventEmitter<number>();

  /** Emitted when the caller toggles the heard state from the card. */
  @Output() toggleHeard = new EventEmitter<void>();

  /** Toggled true when the <img> fails, so the template swaps to the
   * fallback cover without leaving a broken image. */
  artFailed = false;

  activate(): void {
    this.open.emit(this.share);
  }

  get platformLabel(): string {
    return xtPlatformLabel(this.share.platform);
  }

  get hasArt(): boolean {
    return !!this.share.albumArtUrl && !this.artFailed;
  }

  get title(): string {
    return xtDisplayTitle(this.share);
  }

  get artist(): string {
    return this.share.trackArtist?.trim() || '';
  }

  get openUrl(): string {
    return xtPrimaryUrl(this.share);
  }

  get openLinkLabel(): string {
    return xtOpenLabel(this.share);
  }

  /** Guards the corner open-button against a share with no derivable URL at
   * all (no Spotify id AND no source URL) rather than rendering a dead link. */
  get hasOpenTarget(): boolean {
    return !!this.openUrl?.trim();
  }

  get sharer(): string {
    const name = this.share.sharerName?.trim();
    const handle = this.share.sharerHandle?.trim();
    if (this.share.direction === 'out') return 'You';
    return name || handle || 'Unknown';
  }

  /** Displayed sharer: the grouped summary when present, else the one sharer. */
  get sharerDisplay(): string {
    return this.sharerSummary.trim() || this.sharer;
  }

  get sharerInitial(): string {
    return (this.sharerDisplay[0] ?? '?').toUpperCase();
  }

  /** Show the ×N badge only when the track was shared more than once. */
  get showCount(): boolean {
    return this.shareCount > 1;
  }

  get statusChip(): { label: string; kind: string } | null {
    switch (this.share.matchStatus) {
      case 'matched':
      case 'manual':
        return null; // matched is the happy path — no chip needed
      case 'unmatched':
        return { label: 'Not on Spotify', kind: 'unmatched' };
      case 'pending':
        return { label: 'Matching…', kind: 'pending' };
      default:
        return null;
    }
  }

  get dateLabel(): string {
    return xtRelativeDate(this.share.messageDate);
  }

  onArtError(): void {
    this.artFailed = true;
  }
}
