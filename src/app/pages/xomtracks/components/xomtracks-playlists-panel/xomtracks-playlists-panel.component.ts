import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
 * The rolling playlists, tucked into a sticky slide-out. A vertical tab
 * pinned to the right screen edge (a bottom-right FAB on phones) toggles the
 * panel. Surfaces Xomtracks' live, rolling Spotify playlists via the
 * official embed iframe — cover + tracklist + play button, saveable/likeable
 * natively on Spotify. A plain "Open in Spotify" link is provided per
 * playlist as a no-iframe fallback.
 *
 * Accessible: the panel is a focus-trapped `role="dialog"` (aria-modal),
 * opened from a button with `aria-expanded`/`aria-controls`. Esc and
 * backdrop close it; focus moves into the panel on open and returns to the
 * trigger on close.
 */
@Component({
  selector: 'app-xomtracks-playlists-panel',
  templateUrl: './xomtracks-playlists-panel.component.html',
  styleUrls: ['./xomtracks-playlists-panel.component.scss'],
})
export class XomtracksPlaylistsPanelComponent {
  open = false;

  readonly playlists: XtPlaylistView[];

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

  toggle(): void {
    this.open ? this.close() : this.openPanel();
  }

  openPanel(): void {
    if (this.open) return;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.open = true;
    queueMicrotask(() => this.focusFirst());
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
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
