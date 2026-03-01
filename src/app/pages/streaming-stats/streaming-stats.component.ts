import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  StreamingStatsService,
  StreamingStats,
} from 'src/app/services/streaming-stats.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-streaming-stats',
  templateUrl: './streaming-stats.component.html',
  styleUrls: ['./streaming-stats.component.scss'],
})
export class StreamingStatsComponent implements OnInit {
  loading = true;
  error = '';
  stats: StreamingStats | null = null;

  readonly DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(
    private statsService: StreamingStatsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = '';

    this.statsService
      .getStreamingStats()
      .pipe(take(1))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading streaming stats:', err);
          this.error = 'Failed to load streaming stats. Please try again.';
          this.loading = false;
        },
      });
  }

  refresh(): void {
    this.loadStats();
  }

  getEstimatedHours(): string {
    if (!this.stats) return '0m';
    return this.statsService.formatEstimatedHours(this.stats.estimatedHoursMs);
  }

  // For the bar chart: normalize values 0-100
  getDayBarHeight(count: number): number {
    if (!this.stats) return 0;
    const max = Math.max(...this.stats.playsByDayOfWeek);
    if (max === 0) return 0;
    return Math.round((count / max) * 100);
  }

  // For the hour heatmap: intensity 0-4
  getHourIntensity(count: number): number {
    if (!this.stats) return 0;
    const max = Math.max(...this.stats.playsByHourOfDay);
    if (max === 0) return 0;
    const ratio = count / max;
    if (ratio === 0) return 0;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  getHourLabel(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  }

  getHoursArray(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
  }

  getDaysArray(): number[] {
    return Array.from({ length: 7 }, (_, i) => i);
  }
}
