import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-goal-progress-ring',
  template: `
    <svg [attr.width]="size" [attr.height]="size" class="progress-ring">
      <circle
        class="progress-ring__bg"
        [attr.cx]="half"
        [attr.cy]="half"
        [attr.r]="radius"
        fill="none"
        [attr.stroke-width]="strokeWidth"
      />
      <circle
        class="progress-ring__fill"
        [attr.cx]="half"
        [attr.cy]="half"
        [attr.r]="radius"
        fill="none"
        [attr.stroke-width]="strokeWidth"
        [attr.stroke-dasharray]="circumference"
        [attr.stroke-dashoffset]="dashOffset"
        [style.stroke]="complete ? '#22c55e' : '#00b4d8'"
        stroke-linecap="round"
      />
      <text
        *ngIf="!complete"
        [attr.x]="half"
        [attr.y]="half"
        text-anchor="middle"
        dominant-baseline="central"
        class="progress-ring__text"
      >
        {{ percentText }}
      </text>
      <polyline
        *ngIf="complete"
        [attr.points]="checkPoints"
        [attr.transform]="'rotate(90 ' + half + ' ' + half + ')'"
        fill="none"
        stroke="#22c55e"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [
    `
      .progress-ring {
        transform: rotate(-90deg);
        display: block;
      }
      .progress-ring__bg {
        stroke: rgba(255, 255, 255, 0.08);
      }
      .progress-ring__fill {
        transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
      }
      .progress-ring__text {
        fill: #fff;
        font-size: 14px;
        font-weight: 700;
        transform: rotate(90deg);
        transform-origin: center;
      }
    `,
  ],
})
export class GoalProgressRingComponent implements OnChanges {
  @Input() current = 0;
  @Input() target = 1;
  @Input() size = 80;
  @Input() strokeWidth = 6;

  radius = 0;
  half = 0;
  circumference = 0;
  dashOffset = 0;
  complete = false;
  percentText = '0%';
  /** Checkmark polyline, scaled to the ring — shown instead of an emoji
   * glyph once the goal is complete. */
  checkPoints = '';

  ngOnChanges(): void {
    this.half = this.size / 2;
    this.radius = this.half - this.strokeWidth;
    this.circumference = 2 * Math.PI * this.radius;
    const pct = Math.min(this.current / this.target, 1);
    this.dashOffset = this.circumference * (1 - pct);
    this.complete = this.current >= this.target;
    this.percentText = Math.round(pct * 100) + '%';

    const r = Math.max(this.radius, 8);
    const x1 = this.half - r * 0.4;
    const y1 = this.half;
    const x2 = this.half - r * 0.1;
    const y2 = this.half + r * 0.35;
    const x3 = this.half + r * 0.45;
    const y3 = this.half - r * 0.35;
    this.checkPoints = `${x1},${y1} ${x2},${y2} ${x3},${y3}`;
  }
}
