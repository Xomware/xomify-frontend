import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import {
  SHARE_REACTIONS,
  SHARE_REACTION_EMOJI,
  SHARE_REACTION_LABEL,
  ShareReaction,
} from 'src/app/services/share-feed.service';

/**
 * Shared reactions row used on both the feed `app-share-card` and the
 * `share-detail` page. Renders one pill per reaction the post has at least
 * one of (active when the viewer has reacted), then a smiley button that
 * pops a horizontal emoji picker.
 *
 * Mirrors `Xomify-iOS/Views/Feed/ReactionsBar.swift` — purely presentational,
 * the owning view emits a single toggle event and reapplies state.
 */
@Component({
  selector: 'app-reactions-bar',
  templateUrl: './reactions-bar.component.html',
  styleUrls: ['./reactions-bar.component.scss'],
})
export class ReactionsBarComponent {
  @Input() counts: Partial<Record<ShareReaction, number>> = {};
  @Input() viewerReactions: ShareReaction[] = [];
  /** Slugs currently being toggled — used to disable individual pills. */
  @Input() inFlight: ReadonlySet<ShareReaction> = new Set<ShareReaction>();
  /** Optional compact density for the feed card row. */
  @Input() compact = false;

  @Output() toggle = new EventEmitter<ShareReaction>();

  pickerOpen = false;

  readonly allReactions: ReadonlyArray<ShareReaction> = SHARE_REACTIONS;

  // Close the popover on any document click that didn't originate inside the
  // bar (template stops propagation on its own clicks).
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.pickerOpen) {
      this.pickerOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pickerOpen) {
      this.pickerOpen = false;
    }
  }

  // ============================================
  // Render helpers
  // ============================================

  /**
   * Reactions to render as pills — only those with count > 0. Stable order
   * matches `SHARE_REACTIONS` so pills don't reshuffle as counts change.
   */
  get activeReactions(): ShareReaction[] {
    return this.allReactions.filter((r) => (this.counts[r] ?? 0) > 0);
  }

  emojiFor(reaction: ShareReaction): string {
    return SHARE_REACTION_EMOJI[reaction];
  }

  labelFor(reaction: ShareReaction): string {
    return SHARE_REACTION_LABEL[reaction];
  }

  countFor(reaction: ShareReaction): number {
    return this.counts[reaction] ?? 0;
  }

  isViewerActive(reaction: ShareReaction): boolean {
    return this.viewerReactions.includes(reaction);
  }

  isInFlight(reaction: ShareReaction): boolean {
    return this.inFlight.has(reaction);
  }

  trackByReaction(_index: number, reaction: ShareReaction): string {
    return reaction;
  }

  // ============================================
  // Actions
  // ============================================

  onPillClick(event: Event, reaction: ShareReaction): void {
    event.stopPropagation();
    if (this.isInFlight(reaction)) return;
    this.toggle.emit(reaction);
  }

  togglePicker(event: Event): void {
    event.stopPropagation();
    this.pickerOpen = !this.pickerOpen;
  }

  onPickerSelect(event: Event, reaction: ShareReaction): void {
    event.stopPropagation();
    this.pickerOpen = false;
    if (this.isInFlight(reaction)) return;
    this.toggle.emit(reaction);
  }

  ariaValue(reaction: ShareReaction): string {
    const active = this.isViewerActive(reaction);
    const count = this.countFor(reaction);
    return active ? `On, ${count}` : `Off, ${count}`;
  }
}
