import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminOverviewPanelComponent } from './admin-overview-panel.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { AxTimestampPipe } from '../pipes/ax-timestamp.pipe';
import { AdminPortalService } from '../services/admin-portal.service';
import {
  AdminCron,
  AdminHealthSummary,
  AdminNotification,
  AdminUser,
} from '../models/admin-portal.model';

describe('AdminOverviewPanelComponent', () => {
  let fixture: ComponentFixture<AdminOverviewPanelComponent>;
  let component: AdminOverviewPanelComponent;
  let adminSpy: jasmine.SpyObj<AdminPortalService>;

  const health: AdminHealthSummary = {
    windowHours: 24,
    totalCalls: 10,
    errorCount: 2,
    byRoute: [],
    recentErrors: [{ ts: '2026-07-28T00:00:00Z', path: '/me/get', status: 500, email: 'a@b.com', error: 'boom' }],
  };

  const users: AdminUser[] = [
    {
      email: 'a@b.com',
      displayName: 'A',
      lastSeen: '2026-07-27T00:00:00Z',
      optIns: { wrapped: true, releaseRadar: false, likesPublic: false, favoritesReminder: true },
      spotifyConnected: true,
    },
    {
      email: 'c@d.com',
      displayName: 'C',
      lastSeen: '2026-07-28T00:00:00Z',
      optIns: { wrapped: false, releaseRadar: true, likesPublic: true, favoritesReminder: false },
      spotifyConnected: false,
    },
  ];

  const crons: AdminCron[] = [
    { cronName: 'ok-job', lastRun: { startedAt: '2026-07-28T00:00:00Z', finishedAt: '2026-07-28T00:00:01Z', status: 'ok', error: null, itemsProcessed: 1 }, recentRuns: [] },
    { cronName: 'bad-job', lastRun: { startedAt: '2026-07-28T00:00:00Z', finishedAt: '2026-07-28T00:00:01Z', status: 'failed', error: 'nope', itemsProcessed: null }, recentRuns: [] },
  ];

  const notifications: AdminNotification[] = [
    { ts: '2026-07-28T00:00:00Z', channel: 'email', toEmail: 'a@b.com', subject: 'Hi', bodyPreview: '', status: 'sent', error: null },
    { ts: '2026-07-28T00:00:00Z', channel: 'email', toEmail: 'b@c.com', subject: 'Hi', bodyPreview: '', status: 'failed', error: 'bounce' },
  ];

  beforeEach(async () => {
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['health', 'usersList', 'crons', 'notifications']);
    adminSpy.health.and.returnValue(of(health));
    adminSpy.usersList.and.returnValue(of(users));
    adminSpy.crons.and.returnValue(of(crons));
    adminSpy.notifications.and.returnValue(of(notifications));

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [AdminOverviewPanelComponent, IconComponent, AxTimestampPipe],
      providers: [{ provide: AdminPortalService, useValue: adminSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOverviewPanelComponent);
    component = fixture.componentInstance;
  });

  it('loads all four signals independently on init', () => {
    fixture.detectChanges();
    expect(adminSpy.health).toHaveBeenCalledWith(24);
    expect(adminSpy.usersList).toHaveBeenCalled();
    expect(adminSpy.crons).toHaveBeenCalled();
    expect(adminSpy.notifications).toHaveBeenCalledWith(25);
    expect(component.healthState).toBe('loaded');
    expect(component.usersState).toBe('loaded');
    expect(component.cronsState).toBe('loaded');
    expect(component.notificationsState).toBe('loaded');
  });

  it('one endpoint 404ing does not block the others from loading', () => {
    adminSpy.health.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    expect(component.healthState).toBe('not-live');
    expect(component.usersState).toBe('loaded');
    expect(component.cronsState).toBe('loaded');
    expect(component.notificationsState).toBe('loaded');
  });

  it('one endpoint erroring does not block the others from loading', () => {
    adminSpy.crons.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.detectChanges();
    expect(component.cronsState).toBe('error');
    expect(component.healthState).toBe('loaded');
  });

  it('computes the health error rate', () => {
    fixture.detectChanges();
    expect(component.errorRatePct).toBe('20.0%');
  });

  it('caps top errors at 5', () => {
    const manyErrors = Array.from({ length: 8 }, (_, i) => ({
      ts: '2026-07-28T00:00:00Z',
      path: `/route/${i}`,
      status: 500,
      email: null,
      error: null,
    }));
    adminSpy.health.and.returnValue(of({ ...health, recentErrors: manyErrors }));
    fixture.detectChanges();
    expect(component.topErrors.length).toBe(5);
  });

  it('sorts recent users by lastSeen descending, capped at 5', () => {
    fixture.detectChanges();
    expect(component.recentUsers[0].email).toBe('c@d.com');
  });

  it('identifies failed crons', () => {
    fixture.detectChanges();
    expect(component.failedCrons.length).toBe(1);
    expect(component.failedCrons[0].cronName).toBe('bad-job');
  });

  it('identifies failed notifications', () => {
    fixture.detectChanges();
    expect(component.failedNotifications.length).toBe(1);
  });

  it('go() emits jumpToTab with the target tab', () => {
    const spy = jasmine.createSpy('jumpToTab');
    component.jumpToTab.subscribe(spy);
    component.go('users');
    expect(spy).toHaveBeenCalledWith('users');
  });

  it('retryHealth() re-fetches health', () => {
    fixture.detectChanges();
    adminSpy.health.calls.reset();
    component.retryHealth();
    expect(adminSpy.health).toHaveBeenCalled();
  });
});
