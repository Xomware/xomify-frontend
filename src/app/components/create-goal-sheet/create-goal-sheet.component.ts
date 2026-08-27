import { Component, EventEmitter, Output } from '@angular/core';
import { GoalsService, GoalMetric } from 'src/app/services/goals.service';

@Component({
  selector: 'app-create-goal-sheet',
  templateUrl: './create-goal-sheet.component.html',
  styleUrls: ['./create-goal-sheet.component.scss'],
})
export class CreateGoalSheetComponent {
  @Output() closed = new EventEmitter<boolean>(); // true = goal added

  metrics: { value: GoalMetric; label: string }[] = [
    { value: 'minutes_listened', label: 'Minutes Listened' },
    { value: 'new_artists', label: 'New Artists Discovered' },
    { value: 'genres_explored', label: 'Genres Explored' },
    { value: 'songs_from_top_artist', label: 'Songs from Top Artist' },
    { value: 'unique_tracks', label: 'Unique Tracks' },
  ];

  selectedMetric: GoalMetric = 'minutes_listened';
  target = 60;
  saving = false;
  error = '';

  constructor(private goalsService: GoalsService) {}

  get preview(): string {
    return this.goalsService.getMetricLabel(this.selectedMetric, this.target);
  }

  get icon(): string {
    return this.goalsService.getMetricIcon(this.selectedMetric);
  }

  addGoal(): void {
    if (this.saving) return;
    this.saving = true;
    this.error = '';

    this.goalsService
      .addGoal(
        this.selectedMetric,
        this.target,
        this.goalsService.getMetricLabel(this.selectedMetric, this.target),
        this.icon
      )
      .subscribe({
        // Only close on success. Closing optimistically would show the sheet
        // dismissing while the goal quietly failed to save.
        next: () => this.closed.emit(true),
        error: (err) => {
          console.error('[Goals] Add failed:', err);
          this.error = 'Could not save that goal. Try again.';
          this.saving = false;
        },
      });
  }

  close(): void {
    this.closed.emit(false);
  }
}
