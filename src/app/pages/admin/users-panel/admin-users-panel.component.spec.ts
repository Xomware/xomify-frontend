import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUsersPanelComponent } from './admin-users-panel.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { AxTimestampPipe } from '../pipes/ax-timestamp.pipe';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminUser } from '../models/admin-portal.model';

describe('AdminUsersPanelComponent', () => {
  let fixture: ComponentFixture<AdminUsersPanelComponent>;
  let component: AdminUsersPanelComponent;
  let adminSpy: jasmine.SpyObj<AdminPortalService>;

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

  beforeEach(async () => {
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['usersList', 'userVisits']);
    adminSpy.usersList.and.returnValue(of(users));
    adminSpy.userVisits.and.returnValue(of([{ ts: '2026-07-28T00:00:00Z', path: '/home' }]));

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [AdminUsersPanelComponent, IconComponent, AxTimestampPipe],
      providers: [{ provide: AdminPortalService, useValue: adminSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersPanelComponent);
    component = fixture.componentInstance;
  });

  it('loads users on init, defaulting to most-recently-seen first', () => {
    fixture.detectChanges();
    expect(component.state).toBe('loaded');
    expect(component.sortedUsers[0].email).toBe('c@d.com');
  });

  it('treats a 404 as "not live yet"', () => {
    adminSpy.usersList.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    expect(component.state).toBe('not-live');
  });

  it('toggling a row expands it and auto-loads its visits', () => {
    fixture.detectChanges();
    component.toggleRow(users[0]);
    expect(component.expandedEmail).toBe('a@b.com');
    expect(adminSpy.userVisits).toHaveBeenCalledWith('a@b.com');
    expect(component.visitsState).toBe('loaded');
    expect(component.visits.length).toBe(1);
  });

  it('toggling the same row again collapses it', () => {
    fixture.detectChanges();
    component.toggleRow(users[0]);
    component.toggleRow(users[0]);
    expect(component.expandedEmail).toBeNull();
  });

  it('onViewAs emits the user email for the parent shell to handle', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    component.viewAs.subscribe((email) => emitted.push(email));

    component.onViewAs(users[0]);

    expect(emitted).toEqual(['a@b.com']);
  });

  it('optInSummary counts how many opt-ins are on', () => {
    expect(component.optInSummary(users[0].optIns)).toBe('2/4');
    expect(component.optInSummary(users[1].optIns)).toBe('2/4');
    expect(
      component.optInSummary({ wrapped: true, releaseRadar: true, likesPublic: true, favoritesReminder: true }),
    ).toBe('4/4');
  });
});
