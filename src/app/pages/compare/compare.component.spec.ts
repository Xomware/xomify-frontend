import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { CompareComponent } from './compare.component';
import { ComparisonService, ListeningSnapshot } from '../../services/comparison.service';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('CompareComponent', () => {
  let component: CompareComponent;
  let fixture: ComponentFixture<CompareComponent>;

  const mockSnapshot: ListeningSnapshot = {
    username: 'FriendUser',
    generatedAt: '2026-03-01T00:00:00.000Z',
    topArtists: [
      { name: 'Artist X', playCount: 90 },
      { name: 'Artist Y', playCount: 70 },
    ],
    topTracks: [
      { name: 'Song 1', artist: 'Artist X', playCount: 45 },
    ],
    topGenres: ['rock', 'electronic'],
    totalMinutes: 1200,
  };

  const encodedSnapshot = btoa(JSON.stringify(mockSnapshot));

  function createComponent(snapParam: string | null = null) {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        BrowserAnimationsModule,
      ],
      declarations: [CompareComponent, TruncatePipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'snap' ? snapParam : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompareComponent);
    component = fixture.componentInstance;
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should load friend snapshot from URL param', () => {
    createComponent(encodedSnapshot);
    fixture.detectChanges();
    expect(component.friendSnapshot).toBeTruthy();
    expect(component.friendSnapshot!.username).toBe('FriendUser');
  });

  it('should have null friend snapshot when no snap param', () => {
    createComponent(null);
    fixture.detectChanges();
    expect(component.friendSnapshot).toBeNull();
  });

  it('should calculate bar width correctly', () => {
    createComponent();
    expect(component.getBarWidth(50, 100)).toBe(50);
    expect(component.getBarWidth(100, 100)).toBe(100);
    expect(component.getBarWidth(0, 100)).toBe(0);
  });

  it('should return 0 bar width when max is 0', () => {
    createComponent();
    expect(component.getBarWidth(50, 0)).toBe(0);
  });

  it('should generate genre slices for donut chart', () => {
    createComponent();
    const slices = component.getGenreSlices(['rock', 'pop', 'jazz']);
    expect(slices.length).toBe(3);
    expect(slices[0].name).toBe('rock');
    expect(slices[0].offset).toBe(0);
  });

  it('should return empty slices for empty genres', () => {
    createComponent();
    expect(component.getGenreSlices([])).toEqual([]);
  });

  it('should generate share URL containing base64', () => {
    createComponent();
    const comparisonService = TestBed.inject(ComparisonService);
    spyOn(comparisonService, 'generateShareableSnapshot').and.returnValue(
      of({ uuid: 'test', encoded: 'dGVzdA==' })
    );
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    component.shareStats();
    expect(comparisonService.generateShareableSnapshot).toHaveBeenCalled();
  });
});
