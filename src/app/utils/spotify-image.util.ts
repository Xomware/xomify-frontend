/** Shape of a single entry in a Spotify `images` array. `width`/`height` are
 * optional here because some of our lean response types omit them even
 * though the live Spotify payload always includes them.
 */
export interface SpotifyImageLike {
  url: string;
  width?: number;
  height?: number;
}

/**
 * Pick the best Spotify album/artist/playlist image for a given on-screen
 * size, instead of blindly grabbing the first or last entry in `images`.
 *
 * Spotify returns `images` **largest-first** (typically ~640 / 300 / 64px).
 * Picking `images[images.length - 1]` (or a hardcoded small index) grabs the
 * 64px thumbnail, which looks blurry once it's upscaled into anything bigger
 * than a small avatar.
 *
 * This returns the smallest image whose width still covers `minPx` (so we
 * don't pull the full 640px asset for a 40px avatar), falling back to the
 * largest available image if nothing is big enough. When `width` metadata
 * is missing from the payload shape, it falls back to `images[0]` — safe
 * because Spotify's documented ordering guarantees that's never the small
 * thumbnail.
 *
 * @param images Spotify's `images` array (largest-first).
 * @param minPx Minimum rendered px the image needs to cover. Defaults to
 *   100, which covers most card/thumbnail sizes. Callers displaying a
 *   larger card should pass the card's pixel size (accounting for retina
 *   displays where useful) so a high-enough-res image is chosen.
 */
export function pickAlbumImage(
  images: SpotifyImageLike[] | null | undefined,
  minPx = 100,
): string {
  if (!images || images.length === 0) return '';
  if (images.length === 1) return images[0]?.url ?? '';

  const withWidth = images.filter(
    (img): img is SpotifyImageLike & { width: number } =>
      typeof img.width === 'number' && img.width > 0,
  );

  if (withWidth.length === 0) {
    // No width metadata on this shape — Spotify documents `images` as
    // largest-first, so the first entry is always safe here.
    return images[0]?.url ?? '';
  }

  const sortedAscending = [...withWidth].sort((a, b) => a.width - b.width);
  const smallestBigEnough = sortedAscending.find((img) => img.width >= minPx);
  return (smallestBigEnough ?? sortedAscending[sortedAscending.length - 1]).url;
}
