# Plan: landing-space-background

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: A1 (`landing-space-background`)
**Track**: A — Public Landing Page
**Status**: Done
**Created**: 2026-08-24
**Last updated**: 2026-08-24
**Scope size**: M
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/landing-space-background`
**Wave**: 1
**Depends on**: _nothing — can start immediately_

---

## Summary

Replace `app-ambient-background` (GSAP blobs + lightning) with `app-space-background`, a
canvas starfield that renders at two intensities: `full` on the landing page, `ambient`
behind the authed app.

## Why space

`xomware-frontend/src/app/data/planets.ts` already renders the xomware.com landing as a
space journey — one planet per app, derived from `apps.data.ts`. A starfield here is not a
new direction; it is the parent site's visual language continuing into the product, which
is what makes A4's "Back to Xomware" link read as one site rather than two.

## Approach

**Canvas, not SVG.** The outgoing component animates 6 SVG `<g>` nodes and appends/removes
DOM for every lightning bolt. A star field needs hundreds of points — that is a canvas job.
One `<canvas>`, one RAF loop, no per-star DOM.

**Three parallax depth layers.** Far (small, dim, near-static), mid, near (larger, brighter,
faster). On the landing page, scroll offset shifts each layer at a different rate; in
`ambient` mode there is no scroll coupling.

**Nebula.** Two or three soft radial gradients in `--accent-purple` (`#9c0abf`) and the
brand green (`#1bdc6f`), drifting on long sine cycles. This is the one place the outgoing
component's palette carries over intact.

**Shooting stars.** Randomized timer, reusing the `scheduleLightning()` cadence pattern
(`800 + Math.random() * 2200`, rescheduled on each fire) — that structure is sound, only the
thing being drawn changes. `full` only.

### Intensity contract

| | `full` | `ambient` |
|---|---|---|
| Star layers | 3, parallax | 1, static |
| Opacity ceiling | 1.0 | ~0.3 |
| Nebula drift | yes | very slow |
| Shooting stars | yes | no |
| Scroll-reactive | yes | no |

## Affected Files / Components

| File | Change | Why |
|------|--------|-----|
| `src/app/components/space-background/space-background.component.ts` | new | canvas + RAF + intensity input |
| `src/app/components/space-background/space-background.component.html` | new | single `<canvas #sky>` |
| `src/app/components/space-background/space-background.component.scss` | new | fixed, inset 0, pointer-events none |
| `src/app/components/ambient-background/` | **delete** | 295 TS + 66 HTML + 20 SCSS |
| `src/app/app.component.html` | modify | line 1 — swap the element |
| `src/app/app.component.scss` | modify | the `app-ambient-background { position: fixed; inset: 0; z-index: 0; pointer-events: none; }` block is selector-matched — rename it or the background stops being fixed |
| `src/app/app.component.ts` | modify | expose whether the current route is the landing page, to pick intensity |
| `src/app/app.module.ts` | modify | swap the declaration |

## Implementation Steps

- [ ] Step 1 — Scaffold `SpaceBackgroundComponent` with `@Input() intensity: 'full' | 'ambient' = 'ambient'` and a `<canvas #sky>`. Default to `ambient` so a missed binding degrades quietly rather than putting shooting stars behind the admin tables.
- [ ] Step 2 — Size the canvas to the viewport on init and on `resize`, capping `devicePixelRatio` at 2. Uncapped DPR on a 3x phone means 9x the fill rate for no visible gain.
- [ ] Step 3 — Generate the star field once into a typed array (x, y, radius, base alpha, twinkle phase, layer). Regenerate only on resize, never per frame.
- [ ] Step 4 — RAF draw loop: clear, paint nebula gradients, paint the three star layers back to front. Twinkle by modulating alpha on a per-star phase offset.
- [ ] Step 5 — Parallax: in `full`, offset each layer by `scrollY * layerFactor`. Read `scrollY` once per frame, never per star.
- [ ] Step 6 — Shooting stars (`full` only): randomized scheduler on the `scheduleLightning()` cadence; each is a short bright segment with a fading tail, drawn for ~600ms then dropped.
- [ ] Step 7 — `prefers-reduced-motion`: paint one composed static frame and never start the RAF loop. The outgoing component honours this via `placeStatic()` — keep that contract exactly.
- [ ] Step 8 — Pause on `visibilitychange` (cancel the RAF, resume on visible). A hidden tab must cost nothing.
- [ ] Step 9 — `ngOnDestroy`: cancel RAF, remove both listeners. The outgoing `killAll()` is the reference for how thorough teardown needs to be.
- [ ] Step 10 — Wire into `app.component.html`; in `app.component.ts` derive intensity from the router (landing route → `full`, everything else → `ambient`).
- [ ] Step 11 — Rename the `app-ambient-background` selector block in `app.component.scss`. **This is the easy one to miss** — it is matched by element name, and without it the background scrolls with the page.
- [ ] Step 12 — Delete `src/app/components/ambient-background/` and its `app.module.ts` declaration. Confirm no other reference survives: only `app.component.html:1` and the component's own file reference it today.

## Acceptance

- [ ] Landing renders a parallax star field with drifting nebula and occasional shooting stars
- [ ] Authed pages render a quiet static field that never competes with content
- [ ] `prefers-reduced-motion: reduce` → one static frame, RAF never starts
- [ ] Background tab drops to zero RAF callbacks
- [ ] No `ambient-background` references remain anywhere in `src/`
- [ ] Background stays fixed while the page scrolls (the step 11 trap)
