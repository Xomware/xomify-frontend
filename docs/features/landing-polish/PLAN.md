# Plan: landing-polish

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: A5 (`landing-polish`)
**Track**: A — Public Landing Page
**Status**: Ready
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

- [ ] Step 1 — `npm run lint:css` clean across `src/app/pages/landing/**`. `.stylelintrc.json` enforces `declaration-property-value-allowed-list` on `font-size`, `letter-spacing` and `font-weight`. Permitted `font-size` values are `$text-*`, any `clamp(...)`, `inherit`, `1em` — so the hero's fluid sizing is legal, but an ad-hoc `2.4rem` is not.
- [ ] Step 2 — Audit tracking: uppercase micro-labels want `$tracking-wide`. `_tokens.scss` warns that `0.04em` sits exactly between `normal` and `wide` and rounds to zero, silently stripping tracking — this bit three components during the xomware migration.

### Performance

- [ ] Step 3 — Lighthouse on mobile. **Budget: ≥90 performance.** A landing page that stutters undersells a product about motion.
- [ ] Step 4 — Profile the A1 canvas during a full scroll. Confirm the DPR cap holds and the star count is not being regenerated per frame.
- [ ] Step 5 — Confirm the RAF loop stops when the tab is hidden.
- [ ] Step 6 — Check the signed-out bundle. `/` must not pull authed feature chunks — the lazy modules (`social`, `analytics`, `discovery`, `favorites`, `shares`, `admin`) are all `AuthGuard`-gated and must stay unloaded for a visitor.
- [ ] Step 7 — Verify landing images are sized to their largest render and no larger.

### Accessibility

- [ ] Step 8 — `prefers-reduced-motion` across all ten acts: pinning off, previews at resolved end states, background static.
- [ ] Step 9 — Keyboard: both CTAs, the progress rail, and every footer link reachable and visibly focused. Rail entries carry `aria-current`.
- [ ] Step 10 — Screen reader: the journey must read as ordered content. Decorative canvas is `aria-hidden`.
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
