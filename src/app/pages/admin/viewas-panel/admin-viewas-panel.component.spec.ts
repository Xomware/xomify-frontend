import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminViewasPanelComponent } from './admin-viewas-panel.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { AxTimestampPipe } from '../pipes/ax-timestamp.pipe';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminViewAs } from '../models/admin-portal.model';

describe('AdminViewasPanelComponent', () => {
  let fixture: ComponentFixture<AdminViewasPanelComponent>;
  let component: AdminViewasPanelComponent;
  let adminSpy: jasmine.SpyObj<AdminPortalService>;

  const snapshot: AdminViewAs = {
    email: 'someone@example.com',
    profile: { displayName: 'Someone', avatar: null, userId: 'u1', active: true, spotifyConnected: true, lastSeen: '2026-07-28T00:00:00Z' },
    optIns: { wrapped: true, releaseRadar: false, likesPublic: false, favoritesReminder: true },
    recentVisits: [{ ts: '2026-07-28T00:00:00Z', path: '/home' }],
    favorites: [{ title: 'Song A' }],
    activeBroadcasts: [],
    note: 'Spotify-derived surfaces are not impersonated.',
  };

  beforeEach(async () => {
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['viewAs']);
    adminSpy.viewAs.and.returnValue(of(snapshot));

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule],
      declarations: [AdminViewasPanelComponent, IconComponent, AxTimestampPipe],
      providers: [{ provide: AdminPortalService, useValue: adminSpy }],
      // The "Preview: Shares signup" section embeds `app-xomtracks-setup-card`
      // from a different feature module — irrelevant to this panel's own
      // load/error/empty behavior, so it's stubbed via the custom-elements
      // schema rather than pulled in with its own service dependencies.
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminViewasPanelComponent);
    component = fixture.componentInstance;
  });

  it('starts idle with no preset email', () => {
    fixture.detectChanges();
    expect(component.state).toBe('idle');
    expect(adminSpy.viewAs).not.toHaveBeenCalled();
  });

  it('auto-loads when a presetEmail is provided on mount', () => {
    component.presetEmail = 'someone@example.com';
    fixture.detectChanges();
    expect(adminSpy.viewAs).toHaveBeenCalledWith('someone@example.com');
    expect(component.state).toBe('loaded');
    expect(component.data).toEqual(snapshot);
  });

  it('re-loads when presetEmail changes after the first change', () => {
    fixture.detectChanges();
    component.presetEmail = 'second@example.com';
    component.ngOnChanges({
      presetEmail: {
        previousValue: null,
        currentValue: 'second@example.com',
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(adminSpy.viewAs).toHaveBeenCalledWith('second@example.com');
  });

  it('submit loads the typed email', () => {
    fixture.detectChanges();
    component.emailInput = 'typed@example.com';
    component.submit();
    expect(adminSpy.viewAs).toHaveBeenCalledWith('typed@example.com');
    expect(component.state).toBe('loaded');
  });

  it('submit is a no-op with a blank email', () => {
    fixture.detectChanges();
    component.emailInput = '   ';
    component.submit();
    expect(adminSpy.viewAs).not.toHaveBeenCalled();
  });

  it('treats a 404 as "not found"', () => {
    adminSpy.viewAs.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    component.emailInput = 'ghost@example.com';
    fixture.detectChanges();
    component.submit();
    expect(component.state).toBe('not-found');
    expect(component.data).toBeNull();
  });

  it('treats a non-404 failure as an error state', () => {
    adminSpy.viewAs.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.emailInput = 'someone@example.com';
    fixture.detectChanges();
    component.submit();
    expect(component.state).toBe('error');
  });

  it('exit resets back to idle', () => {
    component.presetEmail = 'someone@example.com';
    fixture.detectChanges();
    expect(component.state).toBe('loaded');
    component.exit();
    expect(component.state).toBe('idle');
    expect(component.viewingEmail).toBeNull();
    expect(component.data).toBeNull();
    expect(component.emailInput).toBe('');
  });

  it('onStepThroughAs emits the currently-viewed email once a snapshot has loaded', () => {
    component.presetEmail = 'someone@example.com';
    fixture.detectChanges();
    const emitted: string[] = [];
    component.stepThroughAs.subscribe((email) => emitted.push(email));

    component.onStepThroughAs();

    expect(emitted).toEqual(['someone@example.com']);
  });

  it('onStepThroughAs is a no-op with no snapshot loaded (never impersonates an unverified email)', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    component.stepThroughAs.subscribe((email) => emitted.push(email));

    component.onStepThroughAs();

    expect(emitted).toEqual([]);
  });

  it('toggleSignupPreview flips the preview visibility', () => {
    fixture.detectChanges();
    expect(component.showSignupPreview).toBe(false);
    component.toggleSignupPreview();
    expect(component.showSignupPreview).toBe(true);
    component.toggleSignupPreview();
    expect(component.showSignupPreview).toBe(false);
  });

  it('optInEntries maps known keys to labels and passes through unknown ones', () => {
    const entries = component.optInEntries({ wrapped: true, mystery: false } as unknown as AdminViewAs['optIns']);
    expect(entries).toContain({ key: 'wrapped', label: 'Wrapped', on: true });
    expect(entries).toContain({ key: 'mystery', label: 'mystery', on: false });
  });

  it('optInEntries returns an empty array for null', () => {
    expect(component.optInEntries(null)).toEqual([]);
  });

  it('hasContent distinguishes empty from populated values', () => {
    expect(component.hasContent(null)).toBe(false);
    expect(component.hasContent(undefined)).toBe(false);
    expect(component.hasContent([])).toBe(false);
    expect(component.hasContent([1])).toBe(true);
    expect(component.hasContent({})).toBe(false);
    expect(component.hasContent({ a: 1 })).toBe(true);
    expect(component.hasContent('x')).toBe(true);
  });

  it('prettyJson formats values and falls back for null/undefined', () => {
    expect(component.prettyJson(null)).toBe('—');
    expect(component.prettyJson({ a: 1 })).toContain('"a": 1');
  });
});
