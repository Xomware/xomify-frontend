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
        [attr.x]="half"
        [attr.y]="half"
        text-anchor="middle"
        dominant-baseline="central"
        class="progress-ring__text"
        [class.complete]="complete"
      >
        {{ complete ? '✅' : percentText }}
      </text>
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
      .progress-ring__text.complete {
        font-size: 18px;
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

  ngOnChanges(): void {
    this.half = this.size / 2;
    this.radius = this.half - this.strokeWidth;
    this.circumference = 2 * Math.PI * this.radius;
    const pct = Math.min(this.current / this.target, 1);
    this.dashOffset = this.circumference * (1 - pct);
    this.complete = this.current >= this.target;
    this.percentText = Math.round(pct * 100) + '%';
  }
}
