/**
 * Canned data for the landing-page previews.
 *
 * WHY FIXTURES: the landing page is signed-out. There is no Spotify token and
 * no authed session, and every real feature component injects services that
 * assume both. Previews are purpose-built and fed from here.
 *
 * WHY NO IMAGE FILES: "album art" is a CSS gradient derived from `art`, not a
 * bitmap. Shipping real cover art on a public marketing page is a licensing
 * problem, and inventing fake covers as PNGs costs bundle weight for no gain.
 * The gradients read as art at preview size and cost nothing.
 *
 * Everything here is invented. No real user's listening data appears on a
 * public page.
 */

export interface PreviewTrack {
  readonly title: string;
  readonly artist: string;
  /** Two hex stops for the generated cover gradient. */
  readonly art: readonly [string, string];
}

export interface PreviewRankEntry extends PreviewTrack {
  /** Rank in each window, in the order RANK_WINDOWS declares them. */
  readonly ranks: readonly number[];
}

export const RANK_WINDOWS = ['4 weeks', '6 months', 'All time'] as const;

export const RANK_ENTRIES: readonly PreviewRankEntry[] = [
  { title: 'Midnight City',    artist: 'M83',            art: ['#7b22d4', '#c05cf0'], ranks: [1, 3, 2] },
  { title: 'Redbone',          artist: 'Childish Gambino', art: ['#b8452a', '#e8894f'], ranks: [2, 1, 1] },
  { title: 'Nightcall',        artist: 'Kavinsky',       art: ['#1a2a6c', '#4a7fd4'], ranks: [3, 5, 6] },
  { title: 'Time to Pretend',  artist: 'MGMT',           art: ['#0f7a52', '#2fd68e'], ranks: [4, 2, 3] },
  { title: 'Electric Feel',    artist: 'MGMT',           art: ['#9c0abf', '#e05fd6'], ranks: [5, 6, 4] },
  { title: 'Sunset Lover',     artist: 'Petit Biscuit',  art: ['#c2456b', '#f08fa8'], ranks: [6, 4, 5] },
];

export const WRAPPED_MONTHS = ['March', 'April', 'May'] as const;

export const WRAPPED_TRACKS: readonly PreviewTrack[] = [
  { title: 'Alright',        artist: 'Kendrick Lamar', art: ['#1d6b4f', '#3fd695'] },
  { title: 'Weak',           artist: 'AJR',            art: ['#5b2a8c', '#9f6fd6'] },
  { title: 'The Less I Know', artist: 'Tame Impala',   art: ['#c74a2c', '#f0a25f'] },
  { title: 'Instant Crush',  artist: 'Daft Punk',      art: ['#2a3f8c', '#6f8fd6'] },
  { title: 'Fluorescent',    artist: 'Arctic Monkeys', art: ['#8c2a4a', '#d65f8f'] },
];

export interface PreviewRelease {
  readonly day: number;
  readonly title: string;
  readonly artist: string;
  readonly kind: 'Album' | 'Single' | 'EP';
  readonly art: readonly [string, string];
}

/** A week of the Release Radar calendar — `day` is the column, 0-indexed. */
export const RADAR_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export const RADAR_RELEASES: readonly PreviewRelease[] = [
  { day: 0, title: 'Ultraviolet',   artist: 'Hana Vu',      kind: 'Single', art: ['#6b2ad6', '#a86ff0'] },
  { day: 2, title: 'Loom',          artist: 'Fontaines',    kind: 'Album',  art: ['#1d7a52', '#4fd695'] },
  { day: 2, title: 'Second Nature', artist: 'Ora',          kind: 'EP',     art: ['#c2456b', '#f08fa8'] },
  { day: 4, title: 'Slow Fiction',  artist: 'Cotswold',     kind: 'Single', art: ['#2a4f8c', '#6f9fd6'] },
  { day: 5, title: 'Halogen',       artist: 'Nite Jewel',   kind: 'Album',  art: ['#9c0abf', '#e05fd6'] },
];

export const BUILDER_QUEUE: readonly PreviewTrack[] = [
  { title: 'Sunflower',    artist: 'Rex Orange County', art: ['#c98a1f', '#f0cf6f'] },
  { title: 'Feels Like',   artist: 'Gracie Abrams',     art: ['#8c2a6b', '#d66fb0'] },
  { title: 'Motion',       artist: 'Khalid',            art: ['#1d5f7a', '#4fb0d6'] },
  { title: 'Nikes',        artist: 'Frank Ocean',       art: ['#7a3d1d', '#d69a4f'] },
];

export interface PreviewAnalysisBar {
  readonly label: string;
  /** 0-100. */
  readonly value: number;
}

export const BUILDER_ANALYSIS: readonly PreviewAnalysisBar[] = [
  { label: 'Energy', value: 72 },
  { label: 'Danceability', value: 64 },
  { label: 'Valence', value: 45 },
  { label: 'Acousticness', value: 28 },
];

export const SHARE_PREVIEW = {
  from: 'Sam',
  track: { title: 'Midnight City', artist: 'M83', art: ['#7b22d4', '#c05cf0'] as const },
  reactions: ['🔥', '🎧', '💜'],
  comment: { author: 'Dom', body: 'ok this is a certified drive-home song' },
  rating: 4,
} as const;

export interface PreviewTile {
  readonly label: string;
  readonly detail: string;
  readonly art: readonly [string, string];
}

export const DISCOVERY_TILES: readonly PreviewTile[] = [
  { label: 'Mood Picks',  detail: 'Late night, low tempo', art: ['#3d2a8c', '#7f6fd6'] },
  { label: 'Concerts',    detail: 'Tame Impala · Mar 14',  art: ['#1d7a5f', '#4fd6a8'] },
  { label: 'News',        detail: '3 new stories',          art: ['#8c4a1d', '#d6934f'] },
  { label: 'Likes',       detail: '1,284 saved songs',      art: ['#8c1d4a', '#d64f8f'] },
];
