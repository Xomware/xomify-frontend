# Plan: landing-scroll-journey

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: A2 (`landing-scroll-journey`)
**Track**: A — Public Landing Page
**Status**: Done
**Created**: 2026-08-24
**Last updated**: 2026-08-24
**Scope size**: L
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/landing-scroll-journey`
**Wave**: 2
**Depends on**: `A1`

---

## Summary

The landing shell: a GSAP `ScrollTrigger` pinned-act journey hosting ten acts, replacing the
87-line login card that signed-out visitors currently get.

## Approach

**Reference implementation**: `reeses-playoff-challenge/frontend/components/ui/scroll-journey.tsx`
and `components/home/landing-view.tsx`. That landing composes the whole page as one act list
rather than a vertical stack with one scrubbing section wedged in the middle — its own source
comments call out that the wedged version "read as two different pages glued together." Same
mistake is available here; the whole page is the journey.

**Where it mounts**: `HomeComponent`'s `!isLoggedIn` branch delegates to
`<app-landing>`. The `#dashboard` `ng-template` branch is untouched — the signed-in
dashboard is not in scope for this epic at all.

**Mobile**: below `$breakpoint-lg`, pinning disengages entirely and acts render as ordinary
stacked sections with in-view reveals. Pinned scroll-scrubbing on a phone fights the
browser's own scroll physics and reads as jank, not motion.

**Progress rail**: a fixed side rail labels each act and marks position. Reeses' rail taught
that two acts sharing a label makes the rail useless — every act label here must be distinct.

## The ten acts

| # | Act | Explains | Preview (built in A3) |
|---|-----|----------|----------------------|
| 1 | Hero | What Xomify is | Logo, tagline, both CTAs, `full` space bg |
| 2 | Music Taste | Top songs / artists / genres, 4 time ranges | Rank list animating, positions reshuffling between ranges |
| 3 | Wrapped | Auto monthly playlist + full history | Month chips advancing, playlist assembling track by track |
| 4 | Release Radar | Weekly releases from artists you follow | Calendar grid filling, release tiles landing on dates |
| 5 | Builder | Queue building, drag-drop, analysis | Tracks dragging into a queue, analysis bars growing |
| 6 | Shares | Send a song to a friend, they rate it back | Share card in, reactions popping, thread, stars filling |
| 7 | Discovery | Mood picks, concerts, news, likes | Compact tile grid, staggered reveal |
| 8 | How it works | Connect → snapshot → generate → share | 4-step sequence, DrawSVG line between steps |
| 9 | Docs | Where to read more | Link cards (A4 fills these) |
| 10 | Join | Convert | Both CTAs repeated |

A2 builds the shell, the act scaffolding, the rail, and the copy. A3 fills the preview
column of acts 2–8.

## Affected Files / Components

| File | Change |
|------|--------|
| `src/app/pages/landing/landing.component.{ts,html,scss}` | new — act host + rail |
| `src/app/pages/landing/scroll-journey/scroll-journey.component.{ts,html,scss}` | new — reusable pin/scrub director |
| `src/app/pages/landing/landing.module.ts` | new |
| `src/app/pages/landing/acts/` | new — one component per act, preview slot left empty for A3 |
| `src/app/pages/home/home.component.html` | modify — `!isLoggedIn` branch delegates to `<app-landing>` |
| `src/app/pages/home/home.component.scss` | modify — drop the now-dead `.login-page` / `.login-content` / `.welcome-*` / `.features` / `.feature-*` / `.login-button` rules |
| `src/app/pages/home/home.component.ts` | modify — `login()` moves to the landing component |
| `src/app/pages/home/home.component.spec.ts` | modify — the logged-out assertions move |

## Implementation Steps

- [ ] Step 1 — Register `ScrollTrigger` once (`gsap.registerPlugin(ScrollTrigger)`). The installed GSAP is the full Club bundle, so ScrollTrigger, Flip, DrawSVG, MorphSVG, Observer and ScrollSmoother are all available without adding a dependency.
- [ ] Step 2 — Build `ScrollJourneyComponent`: takes a list of acts, pins the stage, scrubs between acts, emits the active index for the rail.
- [ ] Step 3 — Add the `matchMedia` breakpoint guard — `ScrollTrigger.matchMedia` (or `gsap.matchMedia`) so pinning only exists above `$breakpoint-lg` and tears itself down below.
- [ ] Step 4 — Build the progress rail: one entry per act, distinct labels, click-to-jump, `aria-current` on the active entry.
- [ ] Step 5 — Scaffold the ten act components with copy and layout, each exposing an empty preview slot for A3.
- [ ] Step 6 — Hero: logo lockup, tagline, and the two CTAs. **Note**: the second CTA (TestFlight) is specified in A4 — leave the slot and wire it there rather than hardcoding the URL twice.
- [ ] Step 7 — Move `login()` off `HomeComponent` onto the landing component; point the `!isLoggedIn` branch at `<app-landing>`.
- [ ] Step 8 — Delete the dead login-card markup and its SCSS. `home.component.scss` is 309 lines and a large share of it is the login card.
- [ ] Step 9 — Update `home.component.spec.ts` — its logged-out assertions target markup that no longer exists there.
- [ ] Step 10 — Kill every ScrollTrigger on destroy. A route change out of the landing page must not leave pins attached to a dead DOM.

## Acceptance

- [ ] Signed-out `/` renders the ten-act journey; signed-in `/` renders the unchanged dashboard
- [ ] Desktop pins and scrubs; below `$breakpoint-lg` acts stack and pinning is fully torn down
- [ ] Rail tracks position, labels are distinct, click-to-jump works
- [ ] Navigating away kills every ScrollTrigger — no orphaned pins, no console warnings
- [ ] `npm run lint:css` clean (hero may use `clamp()` — explicitly allowed by `.stylelintrc.json`)

## Risks

- **Pin + fixed background interaction.** A1's background is `position: fixed`; ScrollTrigger pinning creates transformed ancestors that can break fixed positioning in descendants. The background is a sibling of `.app-container`, not a descendant of the pinned stage, so it should be clear — verify early rather than at A5.
