import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { XtDirection } from '../../models/xomtracks-share.model';
import {
  XT_ROLLING_PLAYLISTS,
  XtRollingPlaylist,
  xtSpotifyEmbedUrl,
  xtSpotifyPlaylistUrl,
} from '../../config/xomtracks-playlists.config';

interface XtPlaylistView extends XtRollingPlaylist {
  embedUrl: SafeResourceUrl;
  openUrl: string;
}

/**
 * The rolling playlists, tucked into a sticky slide-out. TWO vertical tabs —
 * one per rolling playlist direction ("Shared With Me" / "Shared By Me") —
 * are stacked on the right screen edge (stacked FAB pills on phones). Each
 * tab opens the SAME drawer component instance, but the drawer renders ONLY
 * that direction's playlist — "Shared With Me" never shows the "Shared By
 * Me" embed and vice versa. Surfaces Xomtracks' live, rolling Spotify
 * playlist via the official embed iframe — cover + tracklist + play button,
 * saveable/likeable natively on Spotify. A plain "Open in Spotify" link is
 * provided as a no-iframe fallback.
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
export class XomtracksPlaylistsPanelComponent {
  open = false;

  readonly playlists: XtPlaylistView[];

  /** Which playlist's tab was used to open the drawer — the drawer renders
   * ONLY this direction's playlist. Null when closed. */
  requestedDirection: XtDirection | null = null;

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  private previouslyFocused: HTMLElement | null = null;

  constructor(sanitizer: DomSanitizer) {
    // Embed URLs point only at open.spotify.com — trusted, so we bypass
    // Angular's resource-url guard to let them load in the iframe.
    this.playlists = XT_ROLLING_PLAYLISTS.map((p) => ({
      ...p,
      embedUrl: sanitizer.bypassSecurityTrustResourceUrl(xtSpotifyEmbedUrl(p.id)),
      openUrl: xtSpotifyPlaylistUrl(p.id),
    }));
  }

  /** Opens the drawer showing ONLY one direction's playlist — the handler
   * for both edge tabs ("Shared With Me" passes 'in', "Shared By Me" passes
   * 'out'). If the drawer is already open on the other direction, this
   * swaps its content rather than opening a second drawer. */
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

  /** The single playlist to render for the currently requested direction,
   * or null when nothing's requested (drawer isn't open). */
  get requestedPlaylist(): XtPlaylistView | null {
    return this.playlists.find((p) => p.direction === this.requestedDirection) ?? null;
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

  /** Focuses the drawer's first focusable control (the panel itself only
   * ever renders the one requested playlist now, so there's nothing to
   * scroll to — just move focus in). */
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
}
