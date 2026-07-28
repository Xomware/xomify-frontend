import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  MoodTimelineService,
  HourlyMood,
  MoodSummary,
  TimelineMode,
  MoodQuadrant,
} from 'src/app/services/mood-timeline.service';

@Component({
  selector: 'app-mood-timeline',
  templateUrl: './mood-timeline.component.html',
  styleUrls: ['./mood-timeline.component.scss'],
})
export class MoodTimelineComponent implements OnInit {
  loading = true;
  error = '';
  hourlyData: HourlyMood[] = [];
  summary: MoodSummary | null = null;
  activeMode: TimelineMode = 'today';
  hoveredHour: number | null = null;
  tooltipX = 0;
  tooltipY = 0;

  readonly modes: { label: string; value: TimelineMode }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Weekly Average', value: 'weekly' },
  ];

  readonly chartWidth = 720;
  readonly chartHeight = 280;
  readonly paddingLeft = 40;
  readonly paddingRight = 20;
  readonly paddingTop = 30;
  readonly paddingBottom = 40;

  readonly xLabels = [
    { hour: 0, label: '12am' },
    { hour: 3, label: '3am' },
    { hour: 6, label: '6am' },
    { hour: 9, label: '9am' },
    { hour: 12, label: '12pm' },
    { hour: 15, label: '3pm' },
    { hour: 18, label: '6pm' },
    { hour: 21, label: '9pm' },
  ];

  /** `app-icon` names — see `components/icon/icon.component.html`. */
  readonly moodIcons: Record<MoodQuadrant, string> = {
    Euphoric: 'sparkle',
    Intense: 'flame',
    Peaceful: 'leaf',
    Melancholy: 'droplet',
  };

  readonly moodColors: Record<MoodQuadrant, string> = {
    Euphoric: '#00b4d8',
    Intense: '#ef4444',
    Peaceful: '#22c55e',
    Melancholy: '#6366f1',
  };

  constructor(private moodService: MoodTimelineService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.moodService
      .getMoodTimeline(this.activeMode)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.hourlyData = data;
          this.summary = this.moodService.getSummary(data);
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load mood data. Please try again.';
          this.loading = false;
        },
      });
  }

  switchMode(mode: TimelineMode): void {
    this.activeMode = mode;
    this.loadData();
  }

  // SVG coordinate helpers
  getX(hour: number): number {
    const plotWidth = this.chartWidth - this.paddingLeft - this.paddingRight;
    return this.paddingLeft + (hour / 23) * plotWidth;
  }

  getY(value: number): number {
    const plotHeight = this.chartHeight - this.paddingTop - this.paddingBottom;
    return this.paddingTop + (1 - value) * plotHeight;
  }

  // Generate smooth cubic bezier path
  getPath(key: 'avgEnergy' | 'avgValence'): string {
    const points = this.hourlyData.map((d) => ({
      x: this.getX(d.hour),
      y: this.getY(d[key]),
    }));
    return this.smoothPath(points);
  }

  getAreaPath(key: 'avgEnergy' | 'avgValence'): string {
    const points = this.hourlyData.map((d) => ({
      x: this.getX(d.hour),
      y: this.getY(d[key]),
    }));
    const baseline = this.getY(0);
    const line = this.smoothPath(points);
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${line} L ${lastX},${baseline} L ${firstX},${baseline} Z`;
  }

  private smoothPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev.x + (curr.x - prev.x) / 3;
      const cpx2 = prev.x + (2 * (curr.x - prev.x)) / 3;
      d += ` C ${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
    }
    return d;
  }

  // Peak annotation positions
  getPeakEnergyPos(): { x: number; y: number } | null {
    if (!this.summary) return null;
    const d = this.hourlyData[this.summary.peakEnergyHour];
    if (!d) return null;
    return { x: this.getX(d.hour), y: this.getY(d.avgEnergy) };
  }

  getPeakValencePos(): { x: number; y: number } | null {
    if (!this.summary) return null;
    const d = this.hourlyData[this.summary.mostPositiveHour];
    if (!d) return null;
    return { x: this.getX(d.hour), y: this.getY(d.avgValence) };
  }

  // Column hover
  getColumnWidth(): number {
    return (this.chartWidth - this.paddingLeft - this.paddingRight) / 24;
  }

  getColumnX(hour: number): number {
    return this.paddingLeft + hour * this.getColumnWidth();
  }

  onHoverHour(hour: number, event: MouseEvent): void {
    this.hoveredHour = hour;
    this.tooltipX = event.offsetX;
    this.tooltipY = event.offsetY;
  }

  onLeaveHour(): void {
    this.hoveredHour = null;
  }

  getHoveredData(): HourlyMood | null {
    if (this.hoveredHour === null) return null;
    return this.hourlyData[this.hoveredHour] || null;
  }

  formatHour(hour: number): string {
    return this.moodService.formatHour(hour);
  }

  formatPercent(value: number): string {
    return Math.round(value * 100) + '%';
  }

  // Background gradient stops for day/night
  getBackgroundStops(): { offset: string; color: string }[] {
    return [
      { offset: '0%', color: '#0a1628' },    // midnight
      { offset: '20%', color: '#0f2847' },    // early morning
      { offset: '30%', color: '#1a3a5c' },    // dawn
      { offset: '45%', color: '#2d4a7a' },    // morning
      { offset: '55%', color: '#3d5a8a' },    // midday
      { offset: '65%', color: '#4a3a6a' },    // afternoon
      { offset: '80%', color: '#2a2050' },    // evening
      { offset: '100%', color: '#0a1628' },   // night
    ];
  }

  getSkeletonBars(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
  }

  getSkeletonHeight(i: number): number {
    return 20 + Math.sin(i * 0.5) * 40 + 40;
  }
}
