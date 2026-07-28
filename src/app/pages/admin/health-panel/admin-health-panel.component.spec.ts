import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminHealthPanelComponent } from './admin-health-panel.component';
import { AdminStateIconComponent } from '../components/admin-state-icon/admin-state-icon.component';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminHealthSummary } from '../models/admin-portal.model';

describe('AdminHealthPanelComponent', () => {
  let fixture: ComponentFixture<AdminHealthPanelComponent>;
  let component: AdminHealthPanelComponent;
  let adminSpy: jasmine.SpyObj<AdminPortalService>;

  const summary: AdminHealthSummary = {
    windowHours: 24,
    totalCalls: 5,
    errorCount: 1,
    byRoute: [{ path: '/me/get', count: 5, errors: 1, p50ms: 40 }],
    recentErrors: [{ ts: '2026-07-28T00:00:00Z', path: '/me/get', status: 500, email: 'a@b.com', error: 'boom' }],
  };

  beforeEach(async () => {
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['health']);
    adminSpy.health.and.returnValue(of(summary));

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [AdminHealthPanelComponent, AdminStateIconComponent],
      providers: [{ provide: AdminPortalService, useValue: adminSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminHealthPanelComponent);
    component = fixture.componentInstance;
  });

  it('loads health on init and renders summary cards', () => {
    fixture.detectChanges();
    expect(adminSpy.health).toHaveBeenCalledWith(24);
    expect(component.state).toBe('loaded');
    expect(component.summary).toEqual(summary);
  });

  it('re-fetches with the new window when a segmented button is selected', () => {
    fixture.detectChanges();
    component.setWindow(72);
    expect(adminSpy.health).toHaveBeenCalledWith(72);
    expect(component.windowHours).toBe(72);
  });

  it('does not re-fetch if the same window is selected again', () => {
    fixture.detectChanges();
    adminSpy.health.calls.reset();
    component.setWindow(24);
    expect(adminSpy.health).not.toHaveBeenCalled();
  });

  it('treats a 404 as "not live yet" rather than a hard error', () => {
    adminSpy.health.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    expect(component.state).toBe('not-live');
  });

  it('treats a non-404 failure as an error state', () => {
    adminSpy.health.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.detectChanges();
    expect(component.state).toBe('error');
  });

  it('computes the error rate percentage', () => {
    fixture.detectChanges();
    expect(component.errorRatePct).toBe('20.0%');
  });

  it('returns 0% error rate when there are no calls', () => {
    adminSpy.health.and.returnValue(of({ ...summary, totalCalls: 0, errorCount: 0 }));
    fixture.detectChanges();
    expect(component.errorRatePct).toBe('0%');
  });
});
