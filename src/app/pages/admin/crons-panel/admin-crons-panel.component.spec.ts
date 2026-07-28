import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminCronsPanelComponent } from './admin-crons-panel.component';
import { AdminStateIconComponent } from '../components/admin-state-icon/admin-state-icon.component';
import { AdminPortalService } from '../services/admin-portal.service';
import { AdminCron } from '../models/admin-portal.model';

describe('AdminCronsPanelComponent', () => {
  let fixture: ComponentFixture<AdminCronsPanelComponent>;
  let component: AdminCronsPanelComponent;
  let adminSpy: jasmine.SpyObj<AdminPortalService>;

  const crons: AdminCron[] = [
    {
      cronName: 'wrapped-refresh',
      lastRun: {
        startedAt: '2026-07-28T00:00:00Z',
        finishedAt: '2026-07-28T00:00:03Z',
        status: 'ok',
        error: null,
        itemsProcessed: 42,
      },
      recentRuns: [],
    },
  ];

  beforeEach(async () => {
    adminSpy = jasmine.createSpyObj('AdminPortalService', ['crons']);
    adminSpy.crons.and.returnValue(of(crons));

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [AdminCronsPanelComponent, AdminStateIconComponent],
      providers: [{ provide: AdminPortalService, useValue: adminSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCronsPanelComponent);
    component = fixture.componentInstance;
  });

  it('loads crons on init', () => {
    fixture.detectChanges();
    expect(component.state).toBe('loaded');
    expect(component.crons).toEqual(crons);
  });

  it('treats a 404 as "not live yet"', () => {
    adminSpy.crons.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    expect(component.state).toBe('not-live');
  });

  it('treats a non-404 failure as an error state', () => {
    adminSpy.crons.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.detectChanges();
    expect(component.state).toBe('error');
  });

  it('classifies status strings', () => {
    expect(component.statusClass('ok')).toBe('ok');
    expect(component.statusClass('error')).toBe('error');
    expect(component.statusClass('weird')).toBe('unknown');
    expect(component.statusClass(null)).toBe('unknown');
  });

  it('formats a sub-second duration', () => {
    const run = { startedAt: '2026-07-28T00:00:00.000Z', finishedAt: '2026-07-28T00:00:00.500Z', status: 'ok', error: null, itemsProcessed: 1 };
    expect(component.duration(run)).toBe('500ms');
  });

  it('formats a multi-minute duration', () => {
    const run = { startedAt: '2026-07-28T00:00:00Z', finishedAt: '2026-07-28T00:01:12Z', status: 'ok', error: null, itemsProcessed: 1 };
    expect(component.duration(run)).toBe('1m 12s');
  });

  it('reports "In progress" when finishedAt is missing', () => {
    const run = { startedAt: '2026-07-28T00:00:00Z', finishedAt: null, status: 'ok', error: null, itemsProcessed: null };
    expect(component.duration(run)).toBe('In progress');
  });
});
