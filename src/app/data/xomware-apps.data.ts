/**
 * Xomware app directory — public entries only.
 *
 * PORTED, NOT AUTHORED. Canonical source:
 *   xomware-frontend/src/app/data/apps.data.ts
 *
 * That file is what xomware.com derives both its /apps grid and its landing
 * planets from. Add or change an app THERE and re-sync here — the same
 * one-directional convention src/styles/_tokens.scss already documents for
 * design tokens.
 *
 * TWO FILTERS ARE APPLIED, and both matter:
 *  - `adminOnly` entries are dropped. Xomcron is an internal tool; its own API
 *    is the real gate, but an internal link has no business on a public
 *    marketing footer.
 *  - `status: 'coming-soon'` entries are dropped (Xomper iOS). A footer link to
 *    something that does not exist yet is a dead end.
 *
 * The Xomify iOS entry is kept out of the directory list and exposed
 * separately as XOMIFY_IOS — it is this app's own TestFlight link, used by the
 * landing hero CTA, not a sibling product.
 */

export interface XomwareApp {
  readonly name: string;
  readonly url: string;
  readonly platform: 'web' | 'ios' | 'pool';
}

export const XOMWARE_URL = 'https://xomware.com';

/** Xomify's own iOS build. Drives the landing hero's second CTA. */
export const XOMIFY_IOS = {
  name: 'Xomify for iOS',
  url: 'https://testflight.apple.com/join/5CQaJ2mB',
} as const;

/** Sibling products, for the footer's Xomware column. */
export const XOMWARE_APPS: readonly XomwareApp[] = [
  { name: 'XomCloud', url: 'https://xomcloud.xomware.com', platform: 'web' },
  { name: 'Xomper', url: 'https://xomper.xomware.com', platform: 'web' },
  { name: 'Xom Appétit', url: 'https://xomappetit.xomware.com', platform: 'web' },
  { name: 'Xom Forms', url: 'https://xomforms.xomware.com', platform: 'web' },
  { name: 'Today In Sports', url: 'https://todayinsports.app', platform: 'web' },
  { name: 'XomFit', url: 'https://testflight.apple.com/join/xttcUQwT', platform: 'ios' },
  { name: 'Sun God Derby', url: 'https://derby.xomware.com', platform: 'pool' },
  { name: "Reese's Playoff Challenge", url: 'https://playoffs.xomware.com', platform: 'pool' },
];

export interface LinkEntry {
  readonly name: string;
  readonly url: string;
}

/** All four Xomify repos. The footer used to hardcode only the frontend. */
export const XOMIFY_REPOS: readonly LinkEntry[] = [
  { name: 'Frontend', url: 'https://github.com/Xomware/xomify-frontend' },
  { name: 'Backend', url: 'https://github.com/Xomware/xomify-backend' },
  { name: 'iOS', url: 'https://github.com/Xomware/xomify-ios' },
  { name: 'Infrastructure', url: 'https://github.com/Xomware/xomify-infrastructure' },
];

export const XOMIFY_DOCS: readonly LinkEntry[] = [
  { name: 'README', url: 'https://github.com/Xomware/xomify-frontend#readme' },
  {
    name: 'Architecture',
    url: 'https://github.com/Xomware/xomify-frontend/blob/master/docs/architecture.md',
  },
  {
    name: 'Changelog',
    url: 'https://github.com/Xomware/xomify-frontend/blob/master/CHANGELOG.md',
  },
];
