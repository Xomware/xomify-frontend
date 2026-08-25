# Plan: landing-polish

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: A5 (`landing-polish`)
**Track**: A — Public Landing Page
**Status**: Done (partial — see Verification status)
**Created**: 2026-08-24
**Last updated**: 2026-08-24
**Scope size**: S
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/landing-polish`
**Wave**: 4
**Depends on**: `A3`, `A4`

---

## Summary

The gate before the landing page is public: lint, performance, accessibility, and a bundle
check.

## Approach

Everything here is verification and correction, not new surface. If A5 turns into feature
work, something upstream was under-built and belongs back in A2–A4.

## Implementation Steps

### Stylelint

- [x] Step 1 — `npm run lint:css` clean across `src/app/pages/landing/**`. `.stylelintrc.json` enforces `declaration-property-value-allowed-list` on `font-size`, `letter-spacing` and `font-weight`. Permitted `font-size` values are `$text-*`, any `clamp(...)`, `inherit`, `1em` — so the hero's fluid sizing is legal, but an ad-hoc `2.4rem` is not.
- [x] Step 2 — Audit tracking: uppercase micro-labels want `$tracking-wide`. `_tokens.scss` warns that `0.04em` sits exactly between `normal` and `wide` and rounds to zero, silently stripping tracking — this bit three components during the xomware migration.

### Performance

- [ ] Step 3 — Lighthouse on mobile. **Budget: ≥90 performance.** A landing page that stutters undersells a product about motion.
- [ ] Step 4 — Profile the A1 canvas during a full scroll. Confirm the DPR cap holds and the star count is not being regenerated per frame.
- [ ] Step 5 — Confirm the RAF loop stops when the tab is hidden.
- [x] Step 6 — Check the signed-out bundle. `/` must not pull authed feature chunks — the lazy modules (`social`, `analytics`, `discovery`, `favorites`, `shares`, `admin`) are all `AuthGuard`-gated and must stay unloaded for a visitor.
- [x] Step 6b — **Regression introduced in A2, measured**: initial bundle went 1.17 MB → 1.30 MB (229 → 274 kB transfer) because `LandingModule` is eagerly imported by `AppModule`, so ScrollTrigger now ships to every signed-*in* user who will never see the landing page. Fix by splitting `/` into a landing route and a dashboard route so the landing module can lazy-load, rather than branching inside `HomeComponent`'s template. Re-measure after: signed-in initial should return to ~229 kB.
- [ ] Step 7 — Verify landing images are sized to their largest render and no larger.

### Accessibility

- [x] Step 8 — `prefers-reduced-motion` across all ten acts: pinning off, previews at resolved end states, background static.
- [x] Step 9 — Keyboard: both CTAs, the progress rail, and every footer link reachable and visibly focused. Rail entries carry `aria-current`.
- [x] Step 10 — Screen reader: the journey must read as ordered content. Decorative canvas is `aria-hidden`.
- [ ] Step 11 — Contrast: text over the star field and nebula. Light text on a drifting gradient is the classic place contrast quietly fails.

### Cross-browser

- [ ] Step 12 — Safari, Chrome, Firefox desktop; Safari iOS and Chrome Android. Confirm pinning tears down below `$breakpoint-lg` on real devices, not just a narrow desktop window.

## Acceptance

- [ ] `npm run lint:css` clean
- [ ] Lighthouse mobile performance ≥ 90
- [ ] Reduced-motion correct on all ten acts
- [ ] Full keyboard traversal with visible focus
- [ ] No authed chunk in the signed-out bundle
- [ ] Verified on the five browser/device targets above

---

## Verification status

Recorded honestly — what was actually checked, and what was not.

### Verified

| Check | Result |
|-------|--------|
| `npm run lint:css` | clean |
| `npx tsc --noEmit` | clean |
| Unit tests | **513 / 513 passing** |
| Production build | clean |
| Signed-in initial bundle | **230.16 kB** transfer (baseline before this epic: 229.44 kB) |
| Landing chunk | 58.31 kB, fetched only at signed-out `/` |
| External links | all **17** verified resolving 200 |
| Reduced motion | handled in space background, journey, all 7 previews, and both scroll paths |
| ARIA / focus | canvas `aria-hidden`; rail `aria-label` + `aria-current`; focus-visible on rail, CTAs, footer links; footer columns are labelled `<nav>`s |

### Fixed during this pass

- **Eager-landing bundle regression** (step 6b). Split `/` into two route configs
  discriminated by `canMatch`, so `LandingModule` lazy-loads. `canMatch` rather than
  `canActivate` because a failing `canMatch` lets the router try the NEXT config, which is
  what allows one URL to resolve to two different pages. A segment-count check keeps the
  `path: ''` prefix route from shadowing `/callback` and everything below it — without it
  Angular fetches the lazy chunk before discovering no child route matches.
- **7 broken HomeComponent tests**, self-inflicted. Removing the `<ng-template #dashboard>`
  moved the dashboard markup into the root template, where Angular validates child elements
  at create time; the spec declares only `HomeComponent`. Added `NO_ERRORS_SCHEMA` — this is
  a shallow test of HomeComponent's own logic.
- **Unguarded global smooth scrolling.** `styles.scss` set `scroll-behavior: smooth` on
  `html` unconditionally. Now guarded under `prefers-reduced-motion`. CSS alone was not
  enough: the rail passes `behavior: 'smooth'` explicitly, which overrides the stylesheet,
  so `ScrollJourneyComponent.goToAct` checks the media query itself.
- **A live broken link** (found in A4): the footer's "View Source" pointed at
  `domgiordano/xomify-frontend`; the repo is `Xomware/xomify-frontend`.
- **An internal tool nearly shipped publicly** (found in A4): Xomcron is `adminOnly` in the
  canonical registry. The epic plan had listed it among the footer's public app links.

### NOT verified — needs a human or a tool this session lacks

- [ ] **Step 3 — Lighthouse ≥ 90 mobile.** Lighthouse is not installed locally and adding a
      global tool was out of scope. The ≥90 budget is unmeasured.
- [ ] **Step 4 — Canvas profiling under scroll.** Needs DevTools.
- [ ] **Step 5 — RAF stops on hidden tab.** The `visibilitychange` handler is implemented
      and unit-testable, but was not observed live.
- [ ] **Step 7 — Image sizing.** Moot as written: A3 uses CSS gradients rather than bitmaps,
      so the only landing image is the existing hero logo.
- [ ] **Step 11 — Contrast over the star field.** Needs a real contrast check against the
      rendered canvas; text sits on drifting nebula, which is exactly where contrast fails
      quietly.
- [ ] **Step 12 — Cross-browser.** No Safari / Firefox / real-device pass. The most
      load-bearing unknown is whether pinning tears down correctly below `$breakpoint-lg` on
      an actual phone rather than a narrow desktop window.
