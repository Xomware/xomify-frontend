import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUsersPanelComponent } from './admin-users-panel.component';
import { AdminStateIconComponent } from '../components/admin-state-icon/admin-state-icon.component';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminUser, AdminViewAs } from '../models/admin-portal.model';

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
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['usersList', 'userVisits', 'viewAs']);
    adminSpy.usersList.and.returnValue(of(users));
    adminSpy.userVisits.and.returnValue(of([{ ts: '2026-07-28T00:00:00Z', path: '/home' }]));

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [AdminUsersPanelComponent, AdminStateIconComponent],
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

  it('does not load view-as until explicitly requested', () => {
    fixture.detectChanges();
    component.toggleRow(users[0]);
    expect(adminSpy.viewAs).not.toHaveBeenCalled();
    expect(component.viewAsState).toBe('idle');
  });

  it('loadViewAs fetches the read-only snapshot and shows the note', () => {
    const snapshot: AdminViewAs = {
      email: 'a@b.com',
      profile: { displayName: 'A' },
      optIns: { wrapped: true },
      recentVisits: [],
      favorites: null,
      activeBroadcasts: [],
      note: "Spotify-derived surfaces aren't impersonated.",
    };
    adminSpy.viewAs.and.returnValue(of(snapshot));

    fixture.detectChanges();
    component.toggleRow(users[0]);
    component.loadViewAs('a@b.com');

    expect(component.viewAsState).toBe('loaded');
    expect(component.viewAsData?.note).toBe(snapshot.note);
  });

  it('viewAsOptInEntries handles a null optIns gracefully', () => {
    expect(component.viewAsOptInEntries(null)).toEqual([]);
  });

  it('hasContent distinguishes empty from populated values', () => {
    expect(component.hasContent(null)).toBe(false);
    expect(component.hasContent([])).toBe(false);
    expect(component.hasContent({})).toBe(false);
    expect(component.hasContent([1])).toBe(true);
    expect(component.hasContent({ a: 1 })).toBe(true);
  });
});
