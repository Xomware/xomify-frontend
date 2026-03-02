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

  constructor(private goalsService: GoalsService) {}

  get preview(): string {
    return this.goalsService.getMetricLabel(this.selectedMetric, this.target);
  }

  get icon(): string {
    return this.goalsService.getMetricIcon(this.selectedMetric);
  }

  addGoal(): void {
    this.goalsService.addGoal(
      this.selectedMetric,
      this.target,
      this.goalsService.getMetricLabel(this.selectedMetric, this.target),
      this.icon
    );
    this.closed.emit(true);
  }

  close(): void {
    this.closed.emit(false);
  }
}
