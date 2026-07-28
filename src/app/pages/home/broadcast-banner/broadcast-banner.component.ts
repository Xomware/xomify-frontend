import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Broadcast } from 'src/app/services/broadcasts.service';

const DISMISSED_KEY = 'xomify_dismissed_broadcasts';

/**
 * Dismissible "app update" cards, driven entirely by `@Input broadcasts`
 * (Home owns the fetch — see HomeComponent). Dismissals persist in
 * localStorage (survives across sessions, unlike the recently-played
 * sessionStorage cache) keyed by broadcast id, so a re-shown broadcast with
 * a new id still surfaces even if an old one was dismissed.
 */
@Component({
  selector: 'app-home-broadcast-banner',
  templateUrl: './broadcast-banner.component.html',
  styleUrls: ['./broadcast-banner.component.scss'],
})
export class BroadcastBannerComponent implements OnChanges {
  @Input() broadcasts: Broadcast[] = [];

  visibleBroadcasts: Broadcast[] = [];

  private dismissedIds = new Set<string>();

  constructor() {
    this.dismissedIds = this.loadDismissed();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['broadcasts']) {
      this.recomputeVisible();
    }
  }

  dismiss(broadcast: Broadcast): void {
    this.dismissedIds.add(broadcast.id);
    this.saveDismissed();
    this.recomputeVisible();
  }

  trackById(_index: number, broadcast: Broadcast): string {
    return broadcast.id;
  }

  private recomputeVisible(): void {
    this.visibleBroadcasts = (this.broadcasts || []).filter(
      (b) => !this.dismissedIds.has(b.id),
    );
  }

  private loadDismissed(): Set<string> {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  private saveDismissed(): void {
    try {
      localStorage.setItem(
        DISMISSED_KEY,
        JSON.stringify(Array.from(this.dismissedIds)),
      );
    } catch {
      // Storage unavailable (private mode, quota) -- dismissal just won't
      // persist across reloads. Non-critical.
    }
  }
}
