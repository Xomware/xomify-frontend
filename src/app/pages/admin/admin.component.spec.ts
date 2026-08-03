import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AdminComponent } from './admin.component';

describe('AdminComponent', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let component: AdminComponent;
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AdminComponent],
      // Shallow shell test — child panels (health/users/crons/notifications/
      // broadcasts) each have their own spec; here we only exercise tab
      // selection, deep-linking, and keyboard nav.
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap$ },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to the Overview tab when there is no ?tab= param', () => {
    expect(component.activeTab).toBe('overview');
  });

  it('drives the active tab from ?tab=', () => {
    queryParamMap$.next(convertToParamMap({ tab: 'crons' }));
    expect(component.activeTab).toBe('crons');
  });

  it('falls back to Overview for an unknown ?tab= value', () => {
    queryParamMap$.next(convertToParamMap({ tab: 'not-a-real-tab' }));
    expect(component.activeTab).toBe('overview');
  });

  it('setTab updates the URL, omitting the param for the default (Overview) tab', () => {
    component.setTab('users');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { tab: 'users' } }));

    component.setTab('overview');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: {} }));
  });

  it('setTab is a no-op if the tab is already active', () => {
    (router.navigate as jasmine.Spy).calls.reset();
    component.setTab('overview');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ArrowRight advances to the next tab and wraps at the end', () => {
    const lastIndex = component.tabs.length - 1;
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    spyOn(event, 'preventDefault');
    component.onTabKeydown(event, lastIndex);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.activeTab).toBe(component.tabs[0].value);
  });

  it('ArrowLeft moves to the previous tab and wraps at the start', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    component.onTabKeydown(event, 0);
    expect(component.activeTab).toBe(component.tabs[component.tabs.length - 1].value);
  });

  it('Home/End jump to the first/last tab', () => {
    component.onTabKeydown(new KeyboardEvent('keydown', { key: 'End' }), 0);
    expect(component.activeTab).toBe(component.tabs[component.tabs.length - 1].value);

    component.onTabKeydown(new KeyboardEvent('keydown', { key: 'Home' }), component.tabs.length - 1);
    expect(component.activeTab).toBe(component.tabs[0].value);
  });

  it('ignores unrelated keys', () => {
    component.setTab('users');
    const event = new KeyboardEvent('keydown', { key: 'a' });
    component.onTabKeydown(event, 1);
    expect(component.activeTab).toBe('users');
  });

  it('viewAs sets the preset email and jumps to the View As tab', () => {
    component.viewAs('someone@example.com');
    expect(component.viewAsPresetEmail).toBe('someone@example.com');
    expect(component.activeTab).toBe('viewas');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { tab: 'viewas' } }));
  });

  it('viewAs updates the preset email even if already on the View As tab', () => {
    component.viewAs('first@example.com');
    (router.navigate as jasmine.Spy).calls.reset();

    component.viewAs('second@example.com');
    expect(component.viewAsPresetEmail).toBe('second@example.com');
    expect(component.activeTab).toBe('viewas');
    // setTab no-ops (already on 'viewas'), so no re-navigation happens —
    // the child panel still re-loads because the @Input binding changes.
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
