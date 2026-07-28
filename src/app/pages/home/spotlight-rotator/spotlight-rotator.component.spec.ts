import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';

import { SpotlightRotatorComponent, SpotlightSlide } from './spotlight-rotator.component';
import { ReducedMotionService } from 'src/app/services/reduced-motion.service';

function mkSlides(count: number): SpotlightSlide[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    kind: 'recent' as const,
    eyebrow: 'Eyebrow',
    title: `Slide ${i}`,
  }));
}

describe('SpotlightRotatorComponent', () => {
  let component: SpotlightRotatorComponent;
  let fixture: ComponentFixture<SpotlightRotatorComponent>;
  let reducedMotion: { prefersReducedMotion: jasmine.Spy };

  function setup(prefersReduced: boolean) {
    reducedMotion = { prefersReducedMotion: jasmine.createSpy().and.returnValue(prefersReduced) };
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [SpotlightRotatorComponent],
      providers: [{ provide: ReducedMotionService, useValue: reducedMotion }],
    });
    fixture = TestBed.createComponent(SpotlightRotatorComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    fixture?.destroy();
  });

  it('auto-advances through slides on a timer', fakeAsync(() => {
    setup(false);
    component.slides = mkSlides(3);
    component.ngOnChanges({ slides: {} as any });

    expect(component.activeIndex).toBe(0);
    tick(8_000);
    expect(component.activeIndex).toBe(1);
    tick(8_000);
    expect(component.activeIndex).toBe(2);
    tick(8_000);
    expect(component.activeIndex).toBe(0);

    component.ngOnDestroy();
  }));

  it('does not auto-advance while paused', fakeAsync(() => {
    setup(false);
    component.slides = mkSlides(3);
    component.ngOnChanges({ slides: {} as any });

    component.paused = true;
    tick(8_000);
    expect(component.activeIndex).toBe(0);

    component.ngOnDestroy();
  }));

  it('never starts a timer when prefers-reduced-motion is set', fakeAsync(() => {
    setup(true);
    component.slides = mkSlides(3);
    component.ngOnChanges({ slides: {} as any });

    tick(30_000);
    expect(component.activeIndex).toBe(0);

    component.ngOnDestroy();
  }));

  it('manual next()/previous() wrap around', () => {
    setup(true);
    component.slides = mkSlides(3);
    component.ngOnChanges({ slides: {} as any });

    component.previous();
    expect(component.activeIndex).toBe(2);

    component.next();
    component.next();
    expect(component.activeIndex).toBe(1);
  });

  it('resets to index 0 when the active slide disappears from a new slide list', () => {
    setup(true);
    component.slides = mkSlides(3);
    component.ngOnChanges({ slides: {} as any });
    component.goTo(2);

    component.slides = mkSlides(1);
    component.ngOnChanges({ slides: {} as any });

    expect(component.activeIndex).toBe(0);
  });

  it('navigates via the router when a linked card is activated', () => {
    setup(true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    const slide: SpotlightSlide = {
      id: 's1',
      kind: 'top',
      eyebrow: 'Top pick',
      title: 'Song',
      link: ['/top-songs'],
    };
    component.slides = [slide];
    component.ngOnChanges({ slides: {} as any });

    component.onCardActivate(slide);
    expect(router.navigate).toHaveBeenCalledWith(['/top-songs'], {});
  });
});
