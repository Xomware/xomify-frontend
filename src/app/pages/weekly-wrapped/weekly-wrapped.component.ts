import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { take, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { WeeklyWrappedService, WeeklySnapshot } from 'src/app/services/weekly-wrapped.service';
import { ToastService } from 'src/app/services/toast.service';

declare const html2canvas: any;

@Component({
  selector: 'app-weekly-wrapped',
  templateUrl: './weekly-wrapped.component.html',
  styleUrls: ['./weekly-wrapped.component.scss'],
  animations: [
    trigger('cardReveal', [
      transition(':enter', [
        query('.reveal-item', [
          style({ opacity: 0, transform: 'translateY(24px)' }),
          stagger(150, [
            animate('500ms cubic-bezier(0.35, 0, 0.25, 1)',
              style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class WeeklyWrappedComponent implements OnInit {
  @ViewChild('wrappedCard') wrappedCard!: ElementRef;

  loading = true;
  error = '';
  exporting = false;

  currentSnapshot: WeeklySnapshot | null = null;
  pastWeeks: WeeklySnapshot[] = [];
  minutesDelta: { delta: number; percent: number } | null = null;

  constructor(
    private weeklyService: WeeklyWrappedService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    this.weeklyService.buildCurrentWeekSnapshot().pipe(
      take(1),
      catchError((err) => {
        console.error('Error building weekly snapshot:', err);
        return of(null);
      })
    ).subscribe({
      next: (snapshot) => {
        if (snapshot) {
          this.currentSnapshot = snapshot;

          // Auto-save if first visit this week
          if (this.weeklyService.shouldAutoSave()) {
            this.weeklyService.saveSnapshot(snapshot);
          }

          this.minutesDelta = this.weeklyService.getMinutesDelta(snapshot);
        }

        // Load history
        const history = this.weeklyService.getHistory();
        this.pastWeeks = history
          .filter(s => s.weekKey !== this.currentSnapshot?.weekKey)
          .slice(0, 4);

        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load your weekly stats.';
        this.loading = false;
      }
    });
  }

  get isEmpty(): boolean {
    return !this.currentSnapshot || this.currentSnapshot.topSongs.length === 0;
  }

  async downloadAsImage(): Promise<void> {
    if (!this.wrappedCard?.nativeElement) return;
    this.exporting = true;

    try {
      // Dynamically import html2canvas -- optional dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvasModule: Record<string, unknown> = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js' as string);
      const html2canvasFn = (html2canvasModule['default'] || html2canvasModule) as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>;

      const canvas = await html2canvasFn(this.wrappedCard.nativeElement, {
        backgroundColor: null,
        scale: 2,
        width: 400,
        height: 700,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `xomify-weekly-${this.currentSnapshot?.weekKey || 'wrapped'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.toastService.showPositiveToast('Image downloaded! 📸');
    } catch (err) {
      console.error('Export error:', err);
      this.toastService.showNegativeToast('Failed to export image.');
    } finally {
      this.exporting = false;
    }
  }

  getDeltaLabel(): string {
    if (!this.minutesDelta) return '';
    const { delta, percent } = this.minutesDelta;
    const arrow = delta >= 0 ? '↑' : '↓';
    return `${arrow} ${Math.abs(percent)}% ${delta >= 0 ? 'more' : 'fewer'} minutes than last week`;
  }
}
