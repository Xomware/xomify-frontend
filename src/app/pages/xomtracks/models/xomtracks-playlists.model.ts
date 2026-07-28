import { XtDirection } from './xomtracks-share.model';

/**
 * Mirrors `GET /me/playlists` (xomtracks-backend `lambdas/me_playlists`).
 * One rolling playlist, or `null` when it hasn't been generated yet.
 */
export interface XtPlaylistEntry {
  playlistId: string;
  /** Public "open in Spotify" URL — `open.spotify.com/playlist/<id>`. */
  url: string;
  /** e.g. "Shared With Me (Last Month)" — identical text for `own` and
   * `baseline` on the same direction; only the underlying playlist differs. */
  name: string;
}

export interface XtPlaylistPair {
  in: XtPlaylistEntry | null;
  out: XtPlaylistEntry | null;
}

export interface XtMePlaylistsResponse {
  /** The CALLER's own rolling pair, built on their own connected Spotify once
   * they opt in and run their own extractor. Null entries until then. For
   * the baseline account (Dom), this IS `baseline` — same pair, same ids. */
  own: XtPlaylistPair;
  /** The app's always-visible pair — every signed-in member sees these
   * regardless of whether they've opted in themselves. */
  baseline: XtPlaylistPair;
}

/** Spotify iframe embed URL for a playlist id — the backend only returns the
 * public "open" link, so the embed URL is derived client-side. */
export function xtSpotifyEmbedUrl(playlistId: string): string {
  return `https://open.spotify.com/embed/playlist/${playlistId}`;
}

/** True when `own` is a real, generated playlist that's a DIFFERENT playlist
 * than `baseline` for this direction — i.e. the caller has opted in and run
 * their own extractor. False for the baseline account (own === baseline) and
 * for anyone who hasn't self-served yet (own is null). */
export function xtHasOwnPlaylist(pair: XtMePlaylistsResponse, direction: XtDirection): boolean {
  const own = pair.own[direction];
  const baseline = pair.baseline[direction];
  return !!own && own.playlistId !== baseline?.playlistId;
}
