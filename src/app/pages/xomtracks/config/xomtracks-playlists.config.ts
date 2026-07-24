/**
 * The two live, rolling Spotify playlists Xomtracks keeps in sync
 * ("Shared With Me" / "Shared By Me", last 30 days — rebuilt weekly by
 * xomtracks-backend's `cron_rolling_playlists`).
 *
 * KNOWN LIMITATION (flagged for follow-up, not silently papered over):
 * xomtracks-backend stores rolling-playlist ids PER OWNER
 * (`rollingInPlaylistId`/`rollingOutPlaylistId` on the user's row —
 * `lambdas/cron_rolling_playlists/handler.py`), but does not yet expose them
 * over the API (`GET /me/get` doesn't return them; there's no
 * `GET /playlists` endpoint). Until xomtracks-backend ships one, this stays
 * hardcoded to Dom's two ids — correct for him today, but NOT
 * self-serve-correct for a second connected user. A follow-up should add
 * `rollingInPlaylistId`/`rollingOutPlaylistId` to `GET /me/get` (or a
 * dedicated route) and this file should be replaced with a service call.
 */
export interface XtRollingPlaylist {
  /** Spotify playlist id (the path segment after /playlist/). */
  id: string;
  /** Heading shown above the embed. */
  title: string;
  /** One-line description of what the playlist rolls up. */
  blurb: string;
  /** Direction this playlist rolls up — drives the accent color (mirrors the
   * plan's "playlist covers encode direction by color" decision). */
  direction: 'in' | 'out';
}

export const XT_ROLLING_PLAYLISTS: ReadonlyArray<XtRollingPlaylist> = [
  {
    id: '1EovEoa2MJO7tX4qPEvnsr',
    title: 'Shared With Me — Last Month',
    blurb: 'Everything sent your way over the past month.',
    direction: 'in',
  },
  {
    id: '12rO1QHPLvJ4L3Gehi7PPX',
    title: 'Shared By Me — Last Month',
    blurb: 'Everything you shared out over the past month.',
    direction: 'out',
  },
];

/** Spotify iframe embed URL for a playlist id. */
export function xtSpotifyEmbedUrl(id: string): string {
  return `https://open.spotify.com/embed/playlist/${id}`;
}

/** Public "open in Spotify" URL for a playlist id. */
export function xtSpotifyPlaylistUrl(id: string): string {
  return `https://open.spotify.com/playlist/${id}`;
}
