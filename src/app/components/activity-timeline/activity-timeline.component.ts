import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  LikedArtistsActivityService,
  ActivityTimeline,
  Activity,
  TimelineEntry,
} from 'src/app/services/liked-artists-activity.service';
import { ToastService } from 'src/app/services/toast.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-activity-timeline',
  templateUrl: './activity-timeline.component.html',
  styleUrls: ['./activity-timeline.component.scss'],
})
export class ActivityTimelineComponent implements OnInit {
  // Data
  timeline: ActivityTimeline | null = null;
  filteredEntries: TimelineEntry[] = [];

  // State
  loading = true;
  error: string | null = null;
  refreshing = false;

  // Filters
  filterType: 'all' | 'album' | 'single' | 'appears_on' = 'all';
  searchQuery = '';

  // Expanded state
  expandedDates = new Set<string>();

  constructor(
    private router: Router,
    private activityService: LikedArtistsActivityService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadTimeline();
  }

  /**
   * Load the activity timeline
   */
  loadTimeline(forceRefresh = false): void {
    this.loading = true;
    this.error = null;

    const loadObservable = forceRefresh
      ? this.activityService.forceRefresh()
      : this.activityService.loadActivityTimeline();

    loadObservable.pipe(take(1)).subscribe({
      next: (timeline) => {
        this.timeline = timeline;
        this.applyFilters();
        this.loading = false;

        if (forceRefresh) {
          this.toastService.showPositiveToast('Activity timeline refreshed');
        }
      },
      error: (err) => {
        console.error('Error loading activity timeline:', err);
        this.error = 'Failed to load activity timeline. Please try again.';
        this.loading = false;
      },
    });
  }

  /**
   * Apply all active filters to the timeline
   */
  private applyFilters(): void {
    if (!this.timeline) {
      this.filteredEntries = [];
      return;
    }

    let filtered = [...this.timeline.activities];

    // Apply type filter
    if (this.filterType !== 'all') {
      filtered = filtered.map((entry) => ({
        ...entry,
        activities: entry.activities.filter((a) => a.type === this.filterType),
      }));
      filtered = filtered.filter((entry) => entry.activities.length > 0);
      filtered.forEach((entry) => {
        entry.count = entry.activities.length;
      });
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.map((entry) => ({
        ...entry,
        activities: entry.activities.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            a.artistName.toLowerCase().includes(query)
        ),
      }));
      filtered = filtered.filter((entry) => entry.activities.length > 0);
      filtered.forEach((entry) => {
        entry.count = entry.activities.length;
      });
    }

    this.filteredEntries = filtered;
  }

  /**
   * Set the activity type filter
   */
  setFilterType(type: 'all' | 'album' | 'single' | 'appears_on'): void {
    this.filterType = type;
    this.applyFilters();
  }

  /**
   * Handle search input
   */
  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  /**
   * Toggle expanded state for a date
   */
  toggleDate(date: string): void {
    if (this.expandedDates.has(date)) {
      this.expandedDates.delete(date);
    } else {
      this.expandedDates.add(date);
    }
  }

  /**
   * Check if a date is expanded
   */
  isDateExpanded(date: string): boolean {
    return this.expandedDates.has(date);
  }

  /**
   * Expand all dates
   */
  expandAll(): void {
    this.filteredEntries.forEach((entry) => {
      this.expandedDates.add(entry.date);
    });
  }

  /**
   * Collapse all dates
   */
  collapseAll(): void {
    this.expandedDates.clear();
  }

  /**
   * Refresh the timeline
   */
  refresh(): void {
    this.refreshing = true;
    this.loadTimeline(true);
    this.refreshing = false;
  }

  /**
   * Navigate to artist profile
   */
  goToArtist(artistId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/artist-profile', artistId]);
  }

  /**
   * Navigate to album detail
   */
  goToAlbum(albumId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/album', albumId]);
  }

  /**
   * Open activity in Spotify
   */
  openInSpotify(uri: string, event: Event): void {
    event.stopPropagation();
    const parts = uri.split(':');
    if (parts.length === 3) {
      const url = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
      window.open(url, '_blank');
    }
  }

  /**
   * Get activity label and color
   */
  getActivityLabel(type: string): string {
    return this.activityService.getActivityLabel(type as any);
  }

  getActivityColor(type: string): string {
    return this.activityService.getActivityColor(type as any);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Get relative time string (e.g., "2 weeks ago")
   */
  getRelativeTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      }
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } catch {
      return '';
    }
  }

  /**
   * Format number with K/M suffix
   */
  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Get total count by type
   */
  getCountByType(type: 'album' | 'single' | 'appears_on'): number {
    if (!this.timeline) return 0;
    if (this.filterType !== 'all') {
      return this.timeline.stats[`${type}Count`] as number;
    }
    return this.timeline.stats[`${type}Count`] as number;
  }
}
