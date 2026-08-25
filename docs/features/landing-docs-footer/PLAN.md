# Plan: landing-docs-footer

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: A4 (`landing-docs-footer`)
**Track**: A — Public Landing Page
**Status**: Ready
**Created**: 2026-08-24
**Last updated**: 2026-08-24
**Scope size**: M
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/landing-docs-footer`
**Wave**: 3
**Depends on**: `A2`

---

## Summary

Rebuild the footer as three sourced columns, add the TestFlight CTA to the hero, and backfill
`CHANGELOG.md` so the docs column can honestly link it.

## Approach

**The footer is sourced, not hand-maintained.** `xomware-frontend/src/app/data/apps.data.ts`
is the canonical app registry — it is what xomware.com derives its landing planets from, and
it carries `name`, `url`, and `status: 'live' | 'coming-soon'` for every product. Copy that
registry's shape into a local `xomware-apps.data.ts` with the source file named in a header
comment, matching the one-directional convention `src/styles/_tokens.scss` already documents
for design tokens. Filter to `status === 'live'`.

**Today's footer** (`footer.component.html`, 29 lines) is a credit line, a route-dependent
action button, and one GitHub button whose URL is hardcoded to `xomify-frontend` only.

### Columns

| Column | Contents |
|--------|----------|
| **Xomware** | `xomware.com`, then the live apps from the registry — Xomify, XomCloud, Xomper, Sun God Derby, Reese's Playoff Challenge, Xom Appétit, XomForms, Today In Sports, XomFit, Xomcron |
| **Repos** | `xomify-frontend`, `xomify-backend`, `xomify-ios`, `xomify-infrastructure` |
| **Docs** | README, `docs/architecture.md`, `CHANGELOG.md` |

### Hero CTA

The hero gains a second CTA beside *Connect with Spotify*: **Get the iOS app**, pointing at
`https://testflight.apple.com/join/5CQaJ2mB` — already in the registry under Xomify/iOS.
Xomify ships an iOS app and nothing on the web currently says so.

### Two footer modes

The landing renders the full three-column footer. Authed pages keep the compact one,
including the existing dynamic action button (Go Back on `/artist`, Download Playlist on
`/top-songs`). Drive it with an `@Input() variant: 'full' | 'compact'`.

### Changelog backfill

`CHANGELOG.md` has empty `Added` / `Changed` / `Fixed` sections for every release from 2.2.1
through 2.4.3 — fifteen releases of nothing. Reconstruct from the ~40 commits across those
tags. A public changelog that stops at 2.2.0 reads worse than no changelog at all.

## Affected Files / Components

| File | Change |
|------|--------|
| `src/app/data/xomware-apps.data.ts` | new — registry copy, source named in header |
| `src/app/components/footer/footer.component.ts` | modify — `variant` input, drop the hardcoded single repo URL |
| `src/app/components/footer/footer.component.html` | modify — three-column full mode |
| `src/app/components/footer/footer.component.scss` | modify — 129 lines, needs the column layout |
| `src/app/pages/landing/acts/hero-act/` | modify — second CTA |
| `src/app/pages/landing/acts/docs-act/` | modify — fill the link cards A2 scaffolded |
| `CHANGELOG.md` | modify — backfill 2.2.1 → 2.4.3 |

## Implementation Steps

- [ ] Step 1 — Read `xomware-frontend/src/app/data/apps.data.ts` and port the entries to `src/app/data/xomware-apps.data.ts`. Header comment must name the source path and state that edits belong upstream.
- [ ] Step 2 — Add `@Input() variant: 'full' | 'compact' = 'compact'` to `FooterComponent`. Compact must stay byte-identical in behaviour — the dynamic action button is live on `/artist` and `/top-songs` today.
- [ ] Step 3 — Build the three-column full footer, filtering the registry to `status === 'live'`.
- [ ] Step 4 — Replace the single hardcoded `githubRepoUrl` with all four repo links.
- [ ] Step 5 — Landing passes `variant="full"`; every other page keeps the default.
- [ ] Step 6 — Add the TestFlight CTA to the hero act, sourcing the URL from the registry rather than a second hardcoded string.
- [ ] Step 7 — Fill the docs act's link cards: README, architecture, changelog.
- [ ] Step 8 — Backfill the changelog. Walk `git log` between tags and write real entries. Notable ground already covered: impersonation and View As, the admin extractor-status and run-history views, shares onboarding, the Home live Now Playing widget, the preview-player replacement for the broken Web Playback SDK, the blurry-album-art fix, and the stale-token 401 fix.
- [ ] Step 9 — Verify every external link resolves. A dead link in a public footer is worse than an absent one.

## Acceptance

- [ ] Landing shows the three-column footer; authed pages are visually unchanged
- [ ] The dynamic action button still works on `/artist` and `/top-songs`
- [ ] All four repo links present and resolving
- [ ] TestFlight CTA in the hero, URL sourced from the registry once
- [ ] `CHANGELOG.md` has real entries for 2.2.1 → 2.4.3
- [ ] Registry file names its upstream source in a header comment
