import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';

import { ReactionsBarComponent } from './reactions-bar.component';
import { ShareReaction } from '../../services/share-feed.service';

describe('ReactionsBarComponent', () => {
  let component: ReactionsBarComponent;
  let fixture: ComponentFixture<ReactionsBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [ReactionsBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactionsBarComponent);
    component = fixture.componentInstance;
  });

  function makeEvent(): Event {
    const e = new Event('click', { bubbles: true });
    spyOn(e, 'stopPropagation');
    return e;
  }

  it('only renders pills for reactions with count > 0, in canonical order', () => {
    component.counts = { heart: 2, fire: 5 };
    component.viewerReactions = ['fire'];
    fixture.detectChanges();

    // SHARE_REACTIONS order: fire, heart, laugh, mind_blown, sad, thumbs_up.
    expect(component.activeReactions).toEqual(['fire', 'heart']);
  });

  it('emits the reaction slug when a pill is clicked', () => {
    const emitted: ShareReaction[] = [];
    component.toggle.subscribe((r: ShareReaction) => emitted.push(r));

    component.counts = { fire: 1 };
    component.viewerReactions = [];
    component.onPillClick(makeEvent(), 'fire');

    expect(emitted).toEqual(['fire']);
  });

  it('does NOT emit when the reaction is in flight', () => {
    const emitted: ShareReaction[] = [];
    component.toggle.subscribe((r: ShareReaction) => emitted.push(r));

    component.inFlight = new Set<ShareReaction>(['fire']);
    component.onPillClick(makeEvent(), 'fire');

    expect(emitted).toEqual([]);
  });

  it('opens and closes the picker on toggle', () => {
    expect(component.pickerOpen).toBeFalse();
    component.togglePicker(makeEvent());
    expect(component.pickerOpen).toBeTrue();
    component.togglePicker(makeEvent());
    expect(component.pickerOpen).toBeFalse();
  });

  it('closes the picker after a picker selection and emits the slug', () => {
    const emitted: ShareReaction[] = [];
    component.toggle.subscribe((r: ShareReaction) => emitted.push(r));
    component.pickerOpen = true;

    component.onPickerSelect(makeEvent(), 'heart');

    expect(component.pickerOpen).toBeFalse();
    expect(emitted).toEqual(['heart']);
  });

  it('does NOT emit from the picker when the slug is in flight', () => {
    const emitted: ShareReaction[] = [];
    component.toggle.subscribe((r: ShareReaction) => emitted.push(r));
    component.inFlight = new Set<ShareReaction>(['heart']);
    component.pickerOpen = true;

    component.onPickerSelect(makeEvent(), 'heart');

    // Picker still closes, but we don't double-fire.
    expect(component.pickerOpen).toBeFalse();
    expect(emitted).toEqual([]);
  });

  it('reports viewer state correctly for active vs inactive reactions', () => {
    component.counts = { fire: 3, heart: 1 };
    component.viewerReactions = ['heart'];

    expect(component.isViewerActive('heart')).toBeTrue();
    expect(component.isViewerActive('fire')).toBeFalse();
    expect(component.countFor('fire')).toBe(3);
    expect(component.countFor('thumbs_up')).toBe(0);
  });

  it('escape key closes the picker', () => {
    component.pickerOpen = true;
    component.onEscape();
    expect(component.pickerOpen).toBeFalse();
  });

  it('document click closes the picker', () => {
    component.pickerOpen = true;
    component.onDocumentClick();
    expect(component.pickerOpen).toBeFalse();
  });
});
