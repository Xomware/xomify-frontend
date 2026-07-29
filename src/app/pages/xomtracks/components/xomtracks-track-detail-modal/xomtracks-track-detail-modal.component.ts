import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { XtShare } from '../../models/xomtracks-share.model';
import {
  xtDisplayTitle,
  xtIsMatched,
  xtOpenLabel,
  xtPlatformLabel,
  xtPrimaryUrl,
  xtSharerLabel,
} from '../../utils/xomtracks-track-display';

type XtEmbedKind = 'soundcloud' | null;

const MATCH_LABELS: Record<XtShare['matchStatus'], string> = {
  matched: 'Matched on Spotify',
  manual: 'Matched (manual)',
  unmatched: 'No Spotify match',
  pending: 'Matching…',
};

/**
 * Accessible detail modal for a single share. Shows the full metadata + any
 * cross-feed stats (how many times the track was shared, who else shared
 * it) and an outbound "Play on Spotify" link. Dialog is focus-trapped,
 * Esc- and backdrop-closable, and restores focus to the trigger on close.
 */
@Component({
  selector: 'app-xomtracks-track-detail-modal',
  templateUrl: './xomtracks-track-detail-modal.component.html',
  styleUrls: ['./xomtracks-track-detail-modal.component.scss'],
})
export class XomtracksTrackDetailModalComponent implements AfterViewInit {
  @Input({ required: true }) share!: XtShare;
  /** Total times this track appears across the (deduped) feed, incl. this one. */
  @Input() sharedTimes = 1;
  /** Distinct sharers of the same track other than this share's sharer. */
  @Input() otherSharers: string[] = [];
  /** Every underlying share of this track (newest-first) for the full
   * per-share breakdown. Its length equals the card's ×N. */
  @Input() occurrences: XtShare[] = [];

  /** The track group's key, for the whole-group rating control. */
  @Input() trackKey = '';

  @Output() closed = new EventEmitter<void>();

  /** Emitted with a 1..5 value when the caller sets a rating in the modal. */
  @Output() rate = new EventEmitter<number>();

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLElement>;

  artFailed = false;
  private previouslyFocused: HTMLElement | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => this.focusFirst());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.requestClose();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.requestClose();
  }

  /** Keep Tab focus inside the dialog while it's open. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusables = this.focusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  requestClose(): void {
    this.previouslyFocused?.focus?.();
    this.closed.emit();
  }

  onArtError(): void {
    this.artFailed = true;
  }

  private focusFirst(): void {
    const focusables = this.focusableElements();
    (focusables[0] ?? this.dialogRef?.nativeElement)?.focus?.();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialogRef?.nativeElement;
    if (!root) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }

  // ── Derived view data ─────────────────────────────────────────────
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

  get album(): string {
    return this.share.albumName?.trim() || '';
  }

  get sharer(): string {
    return xtSharerLabel(this.share);
  }

  get sharerInitial(): string {
    return (this.sharer[0] ?? '?').toUpperCase();
  }

  get directionLabel(): string {
    return this.share.direction === 'in' ? 'Shared with you' : 'Shared by you';
  }

  get matchStatusLabel(): string {
    return MATCH_LABELS[this.share.matchStatus] ?? this.share.matchStatus;
  }

  get isMatched(): boolean {
    return xtIsMatched(this.share);
  }

  /** Which inline iframe player, if any, we can embed for this share.
   * Spotify's own embed is intentionally NOT used here (or anywhere in the
   * app) — it runs Spotify's Web Playback SDK internally, which requires
   * Premium + a live Connect session and 404s on
   * social-connect/v2/sessions/current for everyone else, silently killing
   * playback. Matched (Spotify) tracks instead get the shared 30-second
   * preview player below (`app-play-button`). SoundCloud's embed has no
   * such requirement and plays fine, so it stays. */
  get embedKind(): XtEmbedKind {
    if (this.share.platform === 'soundcloud' && this.share.sourceUrl) return 'soundcloud';
    return null;
  }

  /** Sanitised iframe URL for the embeddable SoundCloud player. */
  get embedUrl(): SafeResourceUrl | null {
    if (this.embedKind !== 'soundcloud') return null;
    const src = encodeURIComponent(this.share.sourceUrl);
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://w.soundcloud.com/player/?url=${src}` +
        '&color=%23ff3750&auto_play=false&hide_related=true&show_comments=false&show_user=true',
    );
  }

  /** Stable id for the shared preview player — the real Spotify id when
   * matched (so it caches/dedupes against the same track elsewhere in the
   * app), else this share's own id. */
  get previewTrackId(): string {
    return this.share.resolvedSpotifyId || this.share.shareId;
  }

  /** Whether to show the shared 30s preview player at all — anything with
   * enough metadata to search on is worth trying, matched or not. */
  get showPreviewPlayer(): boolean {
    return !!(this.title || this.artist);
  }

  get dateLabel(): string {
    const ms = (this.share.messageDate ?? 0) * 1000;
    if (!ms) return 'Unknown date';
    return new Date(ms).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Best outbound link: Spotify when resolved, else the original share URL. */
  get primaryUrl(): string {
    return xtPrimaryUrl(this.share);
  }

  get primaryLinkLabel(): string {
    return xtOpenLabel(this.share);
  }

  get sharedTimesLabel(): string {
    return this.sharedTimes === 1 ? 'Shared once' : `Shared ${this.sharedTimes} times`;
  }

  get otherSharersLabel(): string {
    const names = this.otherSharers;
    if (names.length === 0) return '';
    if (names.length === 1) return `Also shared by ${names[0]}`;
    if (names.length === 2) return `Also shared by ${names[0]} and ${names[1]}`;
    return `Also shared by ${names[0]}, ${names[1]} +${names.length - 2} more`;
  }

  /** Whether to show the per-share breakdown (track shared more than once). */
  get showBreakdown(): boolean {
    return this.occurrences.length > 1;
  }

  occurrenceSharer(occ: XtShare): string {
    return xtSharerLabel(occ);
  }

  occurrenceInitial(occ: XtShare): string {
    return (this.occurrenceSharer(occ)[0] ?? '?').toUpperCase();
  }

  occurrenceDate(occ: XtShare): string {
    const ms = (occ.messageDate ?? 0) * 1000;
    if (!ms) return 'Unknown date';
    return new Date(ms).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  trackByShareId(_index: number, occ: XtShare): string {
    return occ.shareId;
  }
}
