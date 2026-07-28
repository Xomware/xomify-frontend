import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminNotificationsPanelComponent } from './admin-notifications-panel.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { AxTimestampPipe } from '../pipes/ax-timestamp.pipe';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminNotification } from '../models/admin-portal.model';

describe('AdminNotificationsPanelComponent', () => {
  let fixture: ComponentFixture<AdminNotificationsPanelComponent>;
  let component: AdminNotificationsPanelComponent;
  let adminSpy: jasmine.SpyObj<AdminPortalService>;

  const notifications: AdminNotification[] = [
    {
      ts: '2026-07-28T00:00:00Z',
      channel: 'email',
      toEmail: 'a@b.com',
      subject: 'Hi',
      bodyPreview: 'Hello there…',
      status: 'sent',
      error: null,
    },
  ];

  beforeEach(async () => {
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['notifications']);
    adminSpy.notifications.and.returnValue(of(notifications));

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [AdminNotificationsPanelComponent, IconComponent, AxTimestampPipe],
      providers: [{ provide: AdminPortalService, useValue: adminSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNotificationsPanelComponent);
    component = fixture.componentInstance;
  });

  it('loads notifications on init with the default limit', () => {
    fixture.detectChanges();
    expect(adminSpy.notifications).toHaveBeenCalledWith(50);
    expect(component.state).toBe('loaded');
  });

  it('re-fetches with the new limit when selected', () => {
    fixture.detectChanges();
    component.setLimit(100);
    expect(adminSpy.notifications).toHaveBeenCalledWith(100);
  });

  it('treats a 404 as "not live yet"', () => {
    adminSpy.notifications.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    expect(component.state).toBe('not-live');
  });

  it('classifies failed statuses', () => {
    expect(component.isFailed('failed')).toBe(true);
    expect(component.isFailed('bounced')).toBe(true);
    expect(component.isFailed('sent')).toBe(false);
    expect(component.isFailed(null)).toBe(false);
  });

  it('failedCount tallies failed notifications', () => {
    adminSpy.notifications.and.returnValue(
      of([...notifications, { ...notifications[0], status: 'bounced' }]),
    );
    fixture.detectChanges();
    expect(component.failedCount).toBe(1);
  });
});
