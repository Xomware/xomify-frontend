/**
 * Demo data for the landing-page previews.
 *
 * COVER ART IS REAL. The images under `src/assets/img/landing/` are genuine
 * album covers fetched from the Cover Art Archive (a MusicBrainz project) and
 * committed locally. Generated placeholder art was tried first and read as
 * broken images — a music app whose marketing page shows coloured squares
 * where the covers go undersells the product badly.
 *
 * Committed rather than hotlinked: the landing page is signed-out, so there is
 * no Spotify token to fetch covers with, and an external image host is a
 * runtime dependency that eventually rots.
 *
 * The listening data itself is invented. No real user's history appears on a
 * public page.
 */

const ART = 'assets/img/landing';

export interface PreviewTrack {
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly cover: string;
}

const T = (title: string, artist: string, album: string, slug: string): PreviewTrack => ({
  title,
  artist,
  album,
  cover: `${ART}/${slug}.jpg`,
});

// ── Music Taste ─────────────────────────────────────────────────────────

export const TIME_RANGES = ['Last 4 weeks', 'Last 6 months', 'All time'] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const TASTE_TABS = ['Songs', 'Artists', 'Albums'] as const;
export type TasteTab = (typeof TASTE_TABS)[number];

export interface RankedTrack extends PreviewTrack {
  /** Rank per time range, in TIME_RANGES order. */
  readonly ranks: readonly [number, number, number];
}

export const TOP_SONGS: readonly RankedTrack[] = [
  { ...T('Midnight City', 'M83', 'Hurry Up, We\'re Dreaming', 'm83-hurry-up'), ranks: [1, 3, 2] },
  { ...T('Redbone', 'Childish Gambino', '"Awaken, My Love!"', 'gambino-awaken'), ranks: [2, 1, 1] },
  { ...T('The Less I Know The Better', 'Tame Impala', 'Currents', 'tame-currents'), ranks: [3, 2, 4] },
  { ...T('Nightcall', 'Kavinsky', 'OutRun', 'kavinsky-outrun'), ranks: [4, 6, 5] },
  { ...T('Instant Crush', 'Daft Punk', 'Random Access Memories', 'daftpunk-ram'), ranks: [5, 4, 3] },
  { ...T('Electric Feel', 'MGMT', 'Oracular Spectacular', 'mgmt-oracular'), ranks: [6, 5, 6] },
];

export interface RankedArtist {
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly cover: string;
  readonly ranks: readonly [number, number, number];
}

export const TOP_ARTISTS: readonly RankedArtist[] = [
  { title: 'Tame Impala', artist: 'Psychedelic pop', album: '', cover: `${ART}/tame-currents.jpg`, ranks: [1, 2, 3] },
  { title: 'M83', artist: 'Dream pop', album: '', cover: `${ART}/m83-hurry-up.jpg`, ranks: [2, 1, 1] },
  { title: 'Arctic Monkeys', artist: 'Indie rock', album: '', cover: `${ART}/arctic-fwn.jpg`, ranks: [3, 4, 2] },
  { title: 'Daft Punk', artist: 'French house', album: '', cover: `${ART}/daftpunk-ram.jpg`, ranks: [4, 3, 4] },
  { title: 'Kendrick Lamar', artist: 'Hip hop', album: '', cover: `${ART}/kendrick-tpab.jpg`, ranks: [5, 6, 5] },
  { title: 'Gorillaz', artist: 'Alternative', album: '', cover: `${ART}/gorillaz-demondays.jpg`, ranks: [6, 5, 6] },
];

export const TOP_ALBUMS: readonly RankedArtist[] = [
  { title: 'Currents', artist: 'Tame Impala', album: '', cover: `${ART}/tame-currents.jpg`, ranks: [1, 1, 2] },
  { title: 'In Rainbows', artist: 'Radiohead', album: '', cover: `${ART}/radiohead-inrainbows.jpg`, ranks: [2, 3, 1] },
  { title: 'Blonde', artist: 'Frank Ocean', album: '', cover: `${ART}/frank-blonde.jpg`, ranks: [3, 2, 4] },
  { title: 'Is This It', artist: 'The Strokes', album: '', cover: `${ART}/strokes-isthisit.jpg`, ranks: [4, 5, 3] },
  { title: 'Demon Days', artist: 'Gorillaz', album: '', cover: `${ART}/gorillaz-demondays.jpg`, ranks: [5, 4, 6] },
  { title: 'To Pimp a Butterfly', artist: 'Kendrick Lamar', album: '', cover: `${ART}/kendrick-tpab.jpg`, ranks: [6, 6, 5] },
];

// ── Wrapped ─────────────────────────────────────────────────────────────

export interface WrappedMonth {
  readonly month: string;
  readonly playlistName: string;
  /** Cover of the playlist itself — Xomify uses the month's #1 track's art. */
  readonly cover: string;
  readonly minutes: string;
  readonly tracks: readonly PreviewTrack[];
}

export const WRAPPED_MONTHS: readonly WrappedMonth[] = [
  {
    month: 'March',
    playlistName: 'Xomify — March',
    cover: `${ART}/kendrick-tpab.jpg`,
    minutes: '4,182',
    tracks: [
      T('Alright', 'Kendrick Lamar', 'To Pimp a Butterfly', 'kendrick-tpab'),
      T('Nikes', 'Frank Ocean', 'Blonde', 'frank-blonde'),
      T('Feel Good Inc.', 'Gorillaz', 'Demon Days', 'gorillaz-demondays'),
      T('Last Nite', 'The Strokes', 'Is This It', 'strokes-isthisit'),
    ],
  },
  {
    month: 'April',
    playlistName: 'Xomify — April',
    cover: `${ART}/tame-currents.jpg`,
    minutes: '3,904',
    tracks: [
      T('The Less I Know The Better', 'Tame Impala', 'Currents', 'tame-currents'),
      T('Weak', 'AJR', 'The Click', 'ajr-theclick'),
      T('15 Step', 'Radiohead', 'In Rainbows', 'radiohead-inrainbows'),
      T('Location', 'Khalid', 'American Teen', 'khalid-americanteen'),
    ],
  },
  {
    month: 'May',
    playlistName: 'Xomify — May',
    cover: `${ART}/m83-hurry-up.jpg`,
    minutes: '5,117',
    tracks: [
      T('Midnight City', 'M83', 'Hurry Up, We\'re Dreaming', 'm83-hurry-up'),
      T('Instant Crush', 'Daft Punk', 'Random Access Memories', 'daftpunk-ram'),
      T('Fluorescent Adolescent', 'Arctic Monkeys', 'Favourite Worst Nightmare', 'arctic-fwn'),
      T('Sunflower', 'Rex Orange County', 'Apricot Princess', 'rex-apricot'),
    ],
  },
];

// ── Release Radar ───────────────────────────────────────────────────────

export const RADAR_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface PreviewRelease {
  readonly day: number;
  readonly title: string;
  readonly artist: string;
  readonly kind: 'Album' | 'Single' | 'EP';
  readonly cover: string;
}

export interface RadarWeek {
  readonly label: string;
  /** Month shown in the header, e.g. "May 2026". */
  readonly monthLabel: string;
  /** Date number for each of the seven columns, Monday first. */
  readonly dates: readonly number[];
  readonly releases: readonly PreviewRelease[];
}

export const RADAR_WEEKS: readonly RadarWeek[] = [
  {
    label: 'This week',
    monthLabel: 'May 2026',
    dates: [18, 19, 20, 21, 22, 23, 24],
    releases: [
      { day: 0, title: 'Dogrel', artist: 'Fontaines D.C.', kind: 'Album', cover: `${ART}/fontaines-dogrel.jpg` },
      { day: 2, title: 'Currents', artist: 'Tame Impala', kind: 'Album', cover: `${ART}/tame-currents.jpg` },
      { day: 4, title: 'Apricot Princess', artist: 'Rex Orange County', kind: 'EP', cover: `${ART}/rex-apricot.jpg` },
      { day: 5, title: 'American Teen', artist: 'Khalid', kind: 'Single', cover: `${ART}/khalid-americanteen.jpg` },
    ],
  },
  {
    label: 'Last week',
    monthLabel: 'May 2026',
    dates: [11, 12, 13, 14, 15, 16, 17],
    releases: [
      { day: 1, title: 'In Rainbows', artist: 'Radiohead', kind: 'Album', cover: `${ART}/radiohead-inrainbows.jpg` },
      { day: 3, title: 'Blonde', artist: 'Frank Ocean', kind: 'Album', cover: `${ART}/frank-blonde.jpg` },
      { day: 6, title: 'Is This It', artist: 'The Strokes', kind: 'Single', cover: `${ART}/strokes-isthisit.jpg` },
    ],
  },
  {
    label: '2 weeks ago',
    monthLabel: 'May 2026',
    dates: [4, 5, 6, 7, 8, 9, 10],
    releases: [
      { day: 0, title: 'Demon Days', artist: 'Gorillaz', kind: 'Album', cover: `${ART}/gorillaz-demondays.jpg` },
      { day: 2, title: 'OutRun', artist: 'Kavinsky', kind: 'Single', cover: `${ART}/kavinsky-outrun.jpg` },
      { day: 4, title: 'The Click', artist: 'AJR', kind: 'EP', cover: `${ART}/ajr-theclick.jpg` },
      { day: 5, title: 'Oracular Spectacular', artist: 'MGMT', kind: 'Album', cover: `${ART}/mgmt-oracular.jpg` },
    ],
  },
];

// ── Playlist Builder ────────────────────────────────────────────────────

export const BUILDER_QUEUE: readonly PreviewTrack[] = [
  T('Sunflower', 'Rex Orange County', 'Apricot Princess', 'rex-apricot'),
  T('Location', 'Khalid', 'American Teen', 'khalid-americanteen'),
  T('Nikes', 'Frank Ocean', 'Blonde', 'frank-blonde'),
  T('Feel Good Inc.', 'Gorillaz', 'Demon Days', 'gorillaz-demondays'),
  T('Last Nite', 'The Strokes', 'Is This It', 'strokes-isthisit'),
];

export interface AnalysisBar {
  readonly label: string;
  /** 0-100. */
  readonly value: number;
}

export const BUILDER_ANALYSIS: readonly AnalysisBar[] = [
  { label: 'Energy', value: 72 },
  { label: 'Danceability', value: 64 },
  { label: 'Valence', value: 45 },
  { label: 'Acousticness', value: 28 },
];

// ── Shares ──────────────────────────────────────────────────────────────

export interface SharePost {
  readonly from: string;
  readonly when: string;
  readonly track: PreviewTrack;
  readonly caption: string;
  readonly reactions: readonly string[];
  readonly comment?: { readonly author: string; readonly body: string };
  readonly rating: number;
  readonly listened: boolean;
}

export const SHARE_FEED: readonly SharePost[] = [
  {
    from: 'John',
    when: '2h',
    track: T('Midnight City', 'M83', 'Hurry Up, We\'re Dreaming', 'm83-hurry-up'),
    caption: 'certified drive-home song',
    reactions: ['🔥', '🎧'],
    comment: { author: 'Jack', body: 'the sax outro. every time.' },
    rating: 5,
    listened: true,
  },
  {
    from: 'Jack',
    when: '5h',
    track: T('Redbone', 'Childish Gambino', '"Awaken, My Love!"', 'gambino-awaken'),
    caption: 'stay woke',
    reactions: ['💜', '🔥', '🎧'],
    comment: { author: 'Smith', body: 'bassline is unreal' },
    rating: 4,
    listened: true,
  },
  {
    from: 'Smith',
    when: '1d',
    track: T('Fluorescent Adolescent', 'Arctic Monkeys', 'Favourite Worst Nightmare', 'arctic-fwn'),
    caption: 'throwback',
    reactions: ['🎧'],
    rating: 4,
    listened: false,
  },
  {
    from: 'John',
    when: '2d',
    track: T('15 Step', 'Radiohead', 'In Rainbows', 'radiohead-inrainbows'),
    caption: 'that drum pattern',
    reactions: ['🔥'],
    comment: { author: 'Jack', body: 'ok this one is a grower' },
    rating: 5,
    listened: true,
  },
];

// ── Discovery ───────────────────────────────────────────────────────────

export interface PreviewTile {
  readonly label: string;
  readonly detail: string;
  readonly cover: string;
}

export const DISCOVERY_TILES: readonly PreviewTile[] = [
  { label: 'Mood Picks', detail: 'Late night, low tempo', cover: `${ART}/kavinsky-outrun.jpg` },
  { label: 'Concerts', detail: 'Tame Impala · Mar 14', cover: `${ART}/tame-currents.jpg` },
  { label: 'News', detail: '3 new stories', cover: `${ART}/fontaines-dogrel.jpg` },
  { label: 'Likes', detail: '1,284 saved songs', cover: `${ART}/frank-blonde.jpg` },
];
