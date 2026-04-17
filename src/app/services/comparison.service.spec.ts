import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComparisonService, ListeningSnapshot } from './comparison.service';

describe('ComparisonService', () => {
  let service: ComparisonService;

  const mockSnapshot: ListeningSnapshot = {
    username: 'TestUser',
    generatedAt: '2026-03-01T00:00:00.000Z',
    topArtists: [
      { name: 'Artist A', rank: 1 },
      { name: 'Artist B', rank: 2 },
      { name: 'Artist C', rank: 3 },
    ],
    topTracks: [
      { name: 'Track 1', artist: 'Artist A', rank: 1 },
      { name: 'Track 2', artist: 'Artist B', rank: 2 },
    ],
    topGenres: ['rock', 'pop', 'indie'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ComparisonService);
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should round-trip serialize and deserialize a snapshot', () => {
    const encoded = btoa(JSON.stringify(mockSnapshot));
    const decoded = service.decodeSnapshot(encoded);
    expect(decoded).toEqual(mockSnapshot);
  });

  it('should return 100% compatibility for identical artists', () => {
    const artists = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const score = service.calculateCompatibility(artists, artists);
    expect(score).toBe(100);
  });

  it('should return 0% compatibility for no overlapping artists', () => {
    const my = [{ name: 'A' }, { name: 'B' }];
    const friend = [{ name: 'C' }, { name: 'D' }];
    const score = service.calculateCompatibility(my, friend);
    expect(score).toBe(0);
  });

  it('should calculate partial overlap correctly', () => {
    const my = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const friend = [{ name: 'B' }, { name: 'C' }, { name: 'D' }];
    // intersection: B, C (2), union: A, B, C, D (4) => 50%
    const score = service.calculateCompatibility(my, friend);
    expect(score).toBe(50);
  });

  it('should store and load snapshot from localStorage', () => {
    const encoded = btoa(JSON.stringify(mockSnapshot));
    const uuid = 'test-uuid-123';
    localStorage.setItem(`xomify-snap-${uuid}`, encoded);
    const loaded = service.loadSnapshot(uuid);
    expect(loaded).toEqual(mockSnapshot);
  });

  it('should return null for invalid encoded data', () => {
    const result = service.decodeSnapshot('not-valid-base64!!!');
    expect(result).toBeNull();
  });

  it('should find shared items between two lists', () => {
    const my = ['Rock', 'Pop', 'Jazz'];
    const friend = ['pop', 'Jazz', 'Electronic'];
    const shared = service.getSharedItems(my, friend);
    expect(shared).toEqual(['Pop', 'Jazz']);
  });

  it('should return null when loading non-existent snapshot', () => {
    const result = service.loadSnapshot('nonexistent-uuid');
    expect(result).toBeNull();
  });
});
