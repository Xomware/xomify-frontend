import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { XtDirection } from '../../models/xomtracks-share.model';
import {
  XtMePlaylistsResponse,
  XtPlaylistEntry,
  xtHasOwnPlaylist,
  xtSpotifyEmbedUrl,
} from '../../models/xomtracks-playlists.model';
import { XomtracksPlaylistsService } from '../../services/xomtracks-playlists.service';

type XtPlaylistScope = 'baseline' | 'own';
type XtPanelLoadState = 'loading' | 'loaded' | 'error';

interface XtPlaylistCardView {
  scope: XtPlaylistScope;
  /** Only shown when a direction has more than one card — hidden for the
   * common (baseline-only) case so it doesn't clutter every visitor's view. */
  label: 'Shared feed' | 'Your playlist';
  blurb: string;
  embedUrl: SafeResourceUrl;
  openUrl: string;
}

/**
 * The rolling playlists, tucked into a sticky slide-out. TWO vertical tabs —
 * one per rolling playlist direction ("Shared With Me" / "Shared By Me") —
 * are stacked on the right screen edge (stacked FAB pills on phones). Each
 * tab opens the SAME drawer component instance, but the drawer renders ONLY
 * that direction's playlist(s) — "Shared With Me" never shows the "Shared By
 * Me" embed and vice versa.
 *
 * Sourced from `GET /me/playlists` (`XomtracksPlaylistsService`) rather than
 * a hardcoded id — every signed-in caller always sees the app's `baseline`
 * (Dom's) rolling playlist for a direction; if the caller has ALSO opted in
 * and run their own extractor, their `own` playlist (once the cron has built
 * it) renders as a second, clearly labeled card in the same drawer. The
 * common case (no `own` yet) renders exactly one card, same as before.
 *
 * Accessible: the panel is a focus-trapped `role="dialog"` (aria-modal),
 * opened from a button with `aria-expanded`/`aria-controls`. Esc and
 * backdrop close it; focus moves into the panel on open and returns to the
 * trigger that opened it on close.
 */
@Component({
  selector: 'app-xomtracks-playlists-panel',
  templateUrl: './xomtracks-playlists-panel.component.html',
  styleUrls: ['./xomtracks-playlists-panel.component.scss'],
})
export class XomtracksPlaylistsPanelComponent implements OnInit {
  open = false;
  state: XtPanelLoadState = 'loading';

  /** Which direction's tab was used to open the drawer — the drawer renders
   * ONLY this direction's card(s). Null when closed. */
  requestedDirection: XtDirection | null = null;

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  private data: XtMePlaylistsResponse | null = null;
  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private playlistsService: XomtracksPlaylistsService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.playlistsService.get().subscribe({
      next: (res) => {
        this.data = res;
        this.state = 'loaded';
      },
      error: () => {
        this.data = null;
        this.state = 'error';
      },
    });
  }

  retry(): void {
    this.load();
  }

  /** Opens the drawer showing ONLY one direction's card(s) — the handler for
   * both edge tabs ("Shared With Me" passes 'in', "Shared By Me" passes
   * 'out'). If the drawer is already open on the other direction, this swaps
   * its content rather than opening a second drawer. */
  openFor(direction: XtDirection): void {
    this.requestedDirection = direction;
    if (this.open) {
      queueMicrotask(() => this.focusFirst());
      return;
    }
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.open = true;
    queueMicrotask(() => this.focusFirst());
  }

  /** The drawer's title for the currently requested direction — sourced
   * straight from the backend's `name` (identical text for `own`/`baseline`
   * on a direction; only the underlying playlist id differs). */
  get requestedTitle(): string {
    const direction = this.requestedDirection;
    if (!direction || !this.data) return '';
    return (this.data.baseline[direction] ?? this.data.own[direction])?.name ?? '';
  }

  /** True when the requested direction has neither a baseline nor an own
   * playlist yet (e.g. baseline SSM param unreadable) — a rare, honest empty
   * state rather than a blank drawer. */
  get requestedEmpty(): boolean {
    return this.state === 'loaded' && this.requestedCards.length === 0;
  }

  /** One or two cards for the currently requested direction: always the
   * baseline (shared feed) card when present, PLUS the caller's own card
   * only when it's a real, different playlist (they've opted in and their
   * extractor has run at least once). */
  get requestedCards(): XtPlaylistCardView[] {
    const direction = this.requestedDirection;
    if (!direction || !this.data) return [];

    const cards: XtPlaylistCardView[] = [];
    const baseline = this.data.baseline[direction];
    const hasOwn = xtHasOwnPlaylist(this.data, direction);

    if (baseline) {
      cards.push(this.toCard(baseline, 'baseline', direction, hasOwn));
    }
    if (hasOwn) {
      const own = this.data.own[direction] as XtPlaylistEntry;
      cards.push(this.toCard(own, 'own', direction, hasOwn));
    }
    return cards;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.requestedDirection = null;
    this.previouslyFocused?.focus?.();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.open) return;
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

  /** Focuses the drawer's first focusable control. */
  private focusFirst(): void {
    const focusables = this.focusableElements();
    (focusables[0] ?? this.panelRef?.nativeElement)?.focus?.();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.panelRef?.nativeElement;
    if (!root) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }

  private toCard(
    entry: XtPlaylistEntry,
    scope: XtPlaylistScope,
    direction: XtDirection,
    multiple: boolean,
  ): XtPlaylistCardView {
    return {
      scope,
      label: scope === 'own' ? 'Your playlist' : 'Shared feed',
      blurb: this.blurbFor(scope, direction, multiple),
      // Embed URLs point only at open.spotify.com — trusted, so we bypass
      // Angular's resource-url guard to let them load in the iframe.
      embedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(xtSpotifyEmbedUrl(entry.playlistId)),
      openUrl: entry.url,
    };
  }

  private blurbFor(scope: XtPlaylistScope, direction: XtDirection, multiple: boolean): string {
    const feed = multiple ? 'the shared feed' : 'your way';
    if (direction === 'in') {
      return scope === 'own'
        ? 'What your own extractor has picked up over the past month.'
        : multiple
          ? "What's landed in the shared feed over the past month."
          : `Everything sent ${feed} over the past month.`;
    }
    return scope === 'own'
      ? "What you've shared out, tracked by your own extractor."
      : multiple
        ? "What's gone out in the shared feed over the past month."
        : 'Everything you shared out over the past month.';
  }
}
