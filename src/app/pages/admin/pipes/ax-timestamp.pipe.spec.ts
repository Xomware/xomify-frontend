import { AxTimestampPipe } from './ax-timestamp.pipe';

describe('AxTimestampPipe', () => {
  let pipe: AxTimestampPipe;

  beforeEach(() => {
    pipe = new AxTimestampPipe();
  });

  it('returns an em dash for a missing value', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('returns the raw string for an unparseable value', () => {
    expect(pipe.transform('not-a-date')).toBe('not-a-date');
  });

  it('formats "full" as absolute + relative', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    const result = pipe.transform(iso, 'full');
    expect(result).toContain('·');
    expect(result).toContain('5m ago');
  });

  it('formats "absolute" without a relative suffix', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(pipe.transform(iso, 'absolute')).not.toContain('·');
  });

  it('formats "relative" buckets correctly', () => {
    expect(pipe.transform(new Date().toISOString(), 'relative')).toBe('just now');
    expect(pipe.transform(new Date(Date.now() - 90 * 60_000).toISOString(), 'relative')).toBe('1h ago');
    expect(pipe.transform(new Date(Date.now() - 25 * 3_600_000).toISOString(), 'relative')).toBe('1d ago');
    expect(pipe.transform(new Date(Date.now() - 40 * 24 * 3_600_000).toISOString(), 'relative')).toBe('1mo ago');
  });
});
