import { XtPlatform, XtShare } from '../models/xomtracks-share.model';

const PLATFORM_LABELS: Record<XtPlatform, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  apple: 'Apple Music',
};

export function xtPlatformLabel(platform: XtPlatform): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

/** A share is "matched" (has a usable Spotify id) when matched or manually set. */
export function xtIsMatched(share: XtShare): boolean {
  return (
    !!share.resolvedSpotifyId &&
    (share.matchStatus === 'matched' || share.matchStatus === 'manual')
  );
}

/**
 * Human title, falling back to a slug parsed from the source URL when
 * metadata hasn't resolved yet (common for fresh SoundCloud shares). Last
 * resort is a generic label so the row is never blank.
 */
export function xtDisplayTitle(share: XtShare): string {
  const explicit = share.trackTitle?.trim();
  if (explicit && !looksLikeRawId(explicit)) return explicit;
  const slug = slugFromUrl(share.sourceUrl);
  if (slug && !looksLikeRawId(slug)) return slug;
  return 'Untitled track';
}

/**
 * True when a candidate title is really a machine id or raw URL rather than
 * a human song title.
 */
function looksLikeRawId(value: string): boolean {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return true;
  if (/\s/.test(v)) return false; // any whitespace => a real phrase, not an id
  return (
    v.length >= 16 &&
    /^[A-Za-z0-9_-]+$/.test(v) &&
    /[A-Za-z]/.test(v) &&
    /\d/.test(v)
  );
}

/**
 * True when a share resolved to a real, human track title — not the generic
 * "Untitled track" fallback `xtDisplayTitle` falls back to when neither the
 * metadata nor the source URL yielded anything usable. Shares that fail this
 * predicate couldn't be matched to real track info and must be excluded from
 * the feed entirely (list, tiles, AND the count) rather than rendered as a
 * dead "Untitled track / —" row.
 */
export function xtHasRealTitle(share: XtShare): boolean {
  return xtDisplayTitle(share) !== 'Untitled track';
}

/** Best outbound URL: the Spotify track when matched, else the original share. */
export function xtPrimaryUrl(share: XtShare): string {
  if (xtIsMatched(share)) return `https://open.spotify.com/track/${share.resolvedSpotifyId}`;
  return share.sourceUrl;
}

/** Label for the outbound action, platform-aware for unmatched shares. */
export function xtOpenLabel(share: XtShare): string {
  if (xtIsMatched(share)) return 'Play on Spotify';
  switch (share.platform) {
    case 'soundcloud':
      return 'Open on SoundCloud';
    case 'apple':
      return 'Open in Apple Music';
    case 'spotify':
      return 'Open on Spotify';
    default:
      return 'Open original';
  }
}

/**
 * host + path (no query/hash/trailing slash), lowercased — so the same link
 * shared in slightly different forms still groups together.
 */
export function xtNormalizedUrl(raw?: string | null): string {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.host}${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

/**
 * Identity for "same track" grouping — Spotify id when resolved, else the
 * normalised source URL, else title+artist. Shared by the feed's grouping,
 * the detail modal's occurrence count, AND the rating control so the ×N
 * badge, "shared N times", and a whole-group rating all key on the same
 * track. Also the `trackKey` POSTed to `/ratings/set` and `/heard/set`.
 */
export function xtTrackKey(share: XtShare): string {
  if (share.resolvedSpotifyId) return `sp:${share.resolvedSpotifyId}`;
  const url = xtNormalizedUrl(share.sourceUrl);
  if (url) return `url:${url}`;
  const title = (share.trackTitle ?? '').trim().toLowerCase();
  const artist = (share.trackArtist ?? '').trim().toLowerCase();
  return `ta:${title}|${artist}`;
}

/** Turn the last path segment of a URL into a Title Cased label. */
function slugFromUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').filter(Boolean).pop() ?? '';
    const cleaned = decodeURIComponent(last)
      .replace(/\.\w+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (!cleaned) return '';
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return '';
  }
}

/** Relative/short date label shared by the card, list row, and modal. */
export function xtRelativeDate(epochSeconds: number | undefined | null): string {
  const ms = (epochSeconds ?? 0) * 1000;
  if (!ms) return '';
  const then = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Sharer display name for one share ("You" for outbound). */
export function xtSharerLabel(share: XtShare): string {
  if (share.direction === 'out') return 'You';
  return share.sharerName?.trim() || share.sharerHandle?.trim() || 'Unknown';
}
