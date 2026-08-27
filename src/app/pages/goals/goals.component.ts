import { Component, OnInit } from '@angular/core';
import { GoalsService, Goal, WeekHistoryEntry } from 'src/app/services/goals.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-goals',
  templateUrl: './goals.component.html',
  styleUrls: ['./goals.component.scss'],
})
export class GoalsComponent implements OnInit {
  goals: Goal[] = [];
  loading = true;
  error = '';
  streak = 0;
  history: WeekHistoryEntry[] = [];
  showCreateSheet = false;
  confettiGoalId: string | null = null;

  private previousCompleted = new Map<string, boolean>();

  constructor(
    private goalsService: GoalsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadGoals();
  }

  loadGoals(): void {
    this.loading = true;
    this.goalsService.getGoals().subscribe({
      next: (goals) => {
        // Check for newly completed goals
        for (const goal of goals) {
          const wasPrev = this.previousCompleted.get(goal.id);
          if (goal.completed && wasPrev === false) {
            this.triggerConfetti(goal.id);
          }
          this.previousCompleted.set(goal.id, goal.completed);
        }

        this.goals = goals;
        this.streak = this.goalsService.getWeeklyStreak();
        this.history = this.goalsService.getHistory().slice(0, 8);
        this.loading = false;

        // Record current week
        const metCount = goals.filter((g) => g.completed).length;
        this.goalsService
          .recordWeekCompletion(
            metCount === goals.length && goals.length > 0,
            metCount,
            goals.length
          )
          // Refresh the strip and streak from the same cache the record wrote.
          .subscribe(() => {
            this.streak = this.goalsService.getWeeklyStreak();
            this.history = this.goalsService.getHistory().slice(0, 8);
          });
      },
      error: (err) => {
        console.error('[Goals] Error:', err);
        this.error = 'Failed to load goals. Make sure you\'re logged in.';
        this.loading = false;
      },
    });
  }

  triggerConfetti(goalId: string): void {
    this.confettiGoalId = goalId;
    setTimeout(() => {
      this.confettiGoalId = null;
    }, 2000);
  }

  onSheetClosed(added: boolean): void {
    this.showCreateSheet = false;
    if (added) {
      this.loadGoals();
    }
  }

  removeGoal(id: string): void {
    this.goalsService.removeGoal(id).subscribe({
      next: () => this.loadGoals(),
      error: (err) => {
        console.error('[Goals] Remove failed:', err);
        this.toastService.showNegativeToast('Could not remove that goal. Try again.');
      },
    });
  }

  /** `weekStart` is a `YYYY-MM-DD` day, and `new Date('2026-08-24')` parses as
   * UTC midnight — which formats as the 23rd anywhere west of Greenwich. Build
   * the date from the parts so the label names the Monday it actually is. */
  formatWeekLabel(weekStart: string): string {
    const [year, month, day] = weekStart.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  get streakLabel(): string {
    if (this.streak === 0) return '';
    return `${this.streak}-week streak`;
  }
}
