# Plan: landing-feature-previews

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: A3 (`landing-feature-previews`)
**Track**: A — Public Landing Page
**Status**: Done
**Created**: 2026-08-24
**Last updated**: 2026-08-24
**Scope size**: L
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/landing-feature-previews`
**Wave**: 3
**Depends on**: `A2`

---

## Summary

The animated glimpse inside acts 2–8: one small presentational component per act, fed from a
committed fixtures file.

## Approach

**Why not reuse the real components.** The landing page is signed-out — there is no Spotify
token and no authed session. Every real feature component injects services that assume both
(`TopItemsService`, `ListeningHistoryService`, `PlaylistService`). Previews are purpose-built
and fixture-fed. They imitate the real UI closely enough to be honest about what the product
looks like, without dragging the authed bundle onto a public page.

**Hard rules for every preview component:**

1. No service injection, no HTTP, no `sessionStorage`. Pure `@Input`s.
2. `ChangeDetectionStrategy.OnPush`.
3. **Idempotent under re-entry.** ScrollTrigger fires enter/leave repeatedly as the user
   scrolls up and back down. Every timeline must be created once and replayed — never
   rebuilt per enter, or timelines stack and the animation accelerates each pass. This is the
   single most likely bug in this sub-feature.
4. Art from committed local assets under `src/assets/img/landing/`. Never hotlink Spotify CDN
   URLs — they rot, and a broken image on the landing page is the first thing a visitor sees.
5. Respect `prefers-reduced-motion`: render the *end* state, not the first frame. A still
   frame of an unstarted animation is an empty box.

## Affected Files / Components

| File | Change |
|------|--------|
| `src/app/pages/landing/landing-fixtures.ts` | new — all canned data, one export per act |
| `src/app/pages/landing/previews/rank-list-preview/` | new — act 2 |
| `src/app/pages/landing/previews/wrapped-preview/` | new — act 3 |
| `src/app/pages/landing/previews/radar-calendar-preview/` | new — act 4 |
| `src/app/pages/landing/previews/builder-preview/` | new — act 5 |
| `src/app/pages/landing/previews/share-card-preview/` | new — act 6 |
| `src/app/pages/landing/previews/discovery-grid-preview/` | new — act 7 |
| `src/app/pages/landing/previews/how-it-works-preview/` | new — act 8 |
| `src/assets/img/landing/` | new — album/artist art, licensed or self-owned |
| `src/app/pages/landing/acts/*` | modify — fill the preview slots left by A2 |

## Implementation Steps

- [ ] Step 1 — Write `landing-fixtures.ts`: a plausible top-10 across four time ranges, a Wrapped month set, a week of releases, a builder queue, a share with reactions and a comment thread, and discovery tiles. Plausible, not real — no actual user data on a public page.
- [ ] Step 2 — Source the art. Self-owned or clearly licensed images only, committed under `src/assets/img/landing/`, sized for the largest render and no larger.
- [ ] Step 3 — Rank list preview (act 2): list animates in staggered, then positions reshuffle as the time-range chip advances. `Flip` (in the installed bundle) handles the reshuffle far more cleanly than hand-tweening positions.
- [ ] Step 4 — Wrapped preview (act 3): month chips advance; the playlist card assembles track by track.
- [ ] Step 5 — Radar calendar preview (act 4): grid draws in, release tiles land on their dates.
- [ ] Step 6 — Builder preview (act 5): tracks slide into a queue, then analysis bars grow. Bars are the one place a count-up is worth it.
- [ ] Step 7 — Share preview (act 6): card enters, reactions pop in staggered, a comment appears, stars fill left to right. This act carries the social half of the product — it should be the most alive of the seven.
- [ ] Step 8 — Discovery grid preview (act 7): tile grid, staggered reveal. Deliberately the quietest — it follows the busiest.
- [ ] Step 9 — How-it-works preview (act 8): four numbered steps with a connecting line drawn between them via `DrawSVGPlugin`.
- [ ] Step 10 — Reduced-motion pass across all seven: each renders its resolved end state.
- [ ] Step 11 — Re-entry test: scroll the full journey down, up, and down again, watching that no animation runs faster on the second pass.

## Acceptance

- [ ] Acts 2–8 each show a moving preview that reads as the real feature
- [ ] Zero service injection and zero network requests from any preview
- [ ] Scrolling up and back down replays cleanly — no acceleration, no stacking
- [ ] Reduced-motion shows resolved end states, not blank frames
- [ ] No external image URLs anywhere in the landing bundle
