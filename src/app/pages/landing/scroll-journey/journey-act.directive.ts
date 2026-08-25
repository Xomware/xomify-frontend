import { Directive, ElementRef, Input } from '@angular/core';

/**
 * Marks one section as an act in a `<app-scroll-journey>`.
 *
 * The label is what the progress rail shows. Labels MUST be distinct — the
 * reference implementation this journey is modelled on
 * (reeses-playoff-challenge) shipped two acts sharing a label and the rail
 * became a progress bar that could not tell you where you were.
 */
@Directive({
  selector: '[appJourneyAct]',
})
export class JourneyActDirective {
  @Input('appJourneyAct') label = '';

  constructor(public readonly host: ElementRef<HTMLElement>) {}
}
