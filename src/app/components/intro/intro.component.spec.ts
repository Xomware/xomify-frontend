import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { INTRO_LENGTH, IntroComponent } from './intro.component';

describe('IntroComponent', () => {
  let fixture: ComponentFixture<IntroComponent>;
  let done: number;
  const html = document.documentElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(IntroComponent);
    done = 0;
    fixture.componentInstance.done.subscribe(() => done++);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    delete html.dataset['intro'];
    document.querySelectorAll('.hero-logo').forEach((el) => el.remove());
  });

  it('takes over from the poster once it has rendered', () => {
    expect(html.dataset['intro']).toBe('playing');
  });

  it('ends when Skip is pressed', () => {
    const skip: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(skip.textContent?.trim()).toBe('Skip');
    expect(skip.getAttribute('aria-label')).toBe('Skip intro');

    skip.click();

    expect(done).toBe(1);
  });

  it('ends on its own after the scene has played', fakeAsync(() => {
    fixture.destroy();
    fixture = TestBed.createComponent(IntroComponent);
    fixture.componentInstance.done.subscribe(() => done++);
    fixture.detectChanges();

    tick(INTRO_LENGTH - 1);
    expect(done).toBe(0);
    tick(1);
    expect(done).toBe(1);
  }));

  it('flies the logo onto the landing hero logo', fakeAsync(() => {
    fixture.destroy();
    const hero = document.createElement('img');
    hero.className = 'hero-logo';
    hero.style.cssText = 'position:fixed;left:100px;top:40px;width:200px;height:96px';
    document.body.appendChild(hero);
    fixture = TestBed.createComponent(IntroComponent);
    fixture.detectChanges();

    tick(INTRO_LENGTH - 500);
    fixture.detectChanges();

    const logo: HTMLElement = fixture.nativeElement.querySelector('.logo');
    expect(logo.style.getPropertyValue('--ho')).toBe('1');
    expect(Number(logo.style.getPropertyValue('--hs'))).toBeGreaterThan(0);
    tick(500);
  }));

  it('fades the logo out in place when there is no hero logo to land on', fakeAsync(() => {
    fixture.destroy();
    fixture = TestBed.createComponent(IntroComponent);
    fixture.detectChanges();

    tick(INTRO_LENGTH - 500);
    fixture.detectChanges();

    const logo: HTMLElement = fixture.nativeElement.querySelector('.logo');
    expect(logo.style.getPropertyValue('--ho')).toBe('0');
    tick(500);
  }));
});
