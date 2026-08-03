// spotify-image.util.spec.ts
//
// Coverage for the shared Spotify album-art selection helper:
//   - Never returns the smallest image for a card that needs a larger one.
//   - Picks the smallest image that still satisfies `minPx`, to avoid
//     over-fetching the full-size asset unnecessarily.
//   - Falls back sanely when width metadata or the array itself is missing.

import { pickAlbumImage } from './spotify-image.util';

describe('pickAlbumImage', () => {
  const large = { url: 'https://img/640', width: 640, height: 640 };
  const medium = { url: 'https://img/300', width: 300, height: 300 };
  const small = { url: 'https://img/64', width: 64, height: 64 };

  it('returns empty string for a missing or empty images array', () => {
    expect(pickAlbumImage(undefined)).toBe('');
    expect(pickAlbumImage(null)).toBe('');
    expect(pickAlbumImage([])).toBe('');
  });

  it('returns the only image when there is just one, regardless of size', () => {
    expect(pickAlbumImage([small])).toBe(small.url);
  });

  it('never returns the smallest image for a large card (the reported blur bug)', () => {
    // Spotify's real ordering is largest-first.
    const images = [large, medium, small];
    expect(pickAlbumImage(images, 260)).not.toBe(small.url);
    expect(pickAlbumImage(images, 260)).toBe(medium.url);
  });

  it('picks the smallest image that still covers minPx, to save bandwidth', () => {
    const images = [large, medium, small];
    expect(pickAlbumImage(images, 40)).toBe(small.url);
    expect(pickAlbumImage(images, 100)).toBe(medium.url);
    expect(pickAlbumImage(images, 500)).toBe(large.url);
  });

  it('falls back to the largest image when nothing is big enough', () => {
    const images = [medium, small];
    expect(pickAlbumImage(images, 1000)).toBe(medium.url);
  });

  it('works regardless of input ordering', () => {
    const images = [small, large, medium];
    expect(pickAlbumImage(images, 260)).toBe(medium.url);
  });

  it('falls back to images[0] when width metadata is missing (documented largest-first order)', () => {
    const images = [{ url: 'https://img/first' }, { url: 'https://img/second' }];
    expect(pickAlbumImage(images, 260)).toBe('https://img/first');
  });

  it('uses the default minPx of 100 when not provided', () => {
    const images = [large, medium, small];
    expect(pickAlbumImage(images)).toBe(medium.url);
  });
});
