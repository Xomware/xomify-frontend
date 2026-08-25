# Epic Plan: Xomify Relaunch

**Status**: Ready
**Created**: 2026-08-24
**Scope size**: XL (epic — 4 repos, 3 tracks, 18 sub-features)
**Repos touched**: `xomify-frontend`, `xomify-ios`, `xomify-backend`, `xomify-infrastructure`
**Board**: XomBoard (GitHub Projects #2), App = Xomify

---

## Summary

Three tracks, one shipment:

- **A — Public landing page.** `/` currently renders an 87-line login card to signed-out
  visitors. Replace it with a scroll-driven landing page in the shape of
  `reeses-playoff-challenge`: every feature explained, each with an animated glimpse of
  the real UI, plus docs and a proper footer.
- **B — Notifications platform.** Of ~14 notifiable events in the product, exactly **one**
  currently sends a push. Build the missing 13, add a real per-user inbox, and give every
  type its own toggle.
- **C — iOS parity + visual overhaul.** iOS is still on the pre-`ea5d391` information
  architecture (Feed + Groups, both deleted on web). Align the IA, then rebuild the
  surface on shared design tokens plus native iOS patterns.

Track A is independent. Track B is the long pole and gates part of C. Track C's parity
work (C1) is independent of B and can start immediately.

---

## Decisions (locked — do not re-litigate)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Space background is global, two intensities** | One `app-space-background` component with `[intensity]="'full' \| 'ambient'"`. `full` on the landing page (parallax star layers, nebula drift, shooting stars, scroll-reactive); `ambient` behind the authed app (static field, very low opacity, slow drift only). Replaces `app-ambient-background` entirely. |
| 2 | **iOS gets tokens *and* native polish** | Port the Xomware token ramp into a Swift `DesignTokens` enum AND adopt native iOS patterns (large titles, materials, SF Symbols, haptics, context menus, swipe actions, spring transitions). |
| 3 | **Per-type notification toggles** | One opt-in flag per notification kind on the device-token record, grouped into three sections in Settings. Not a master switch, not category groups. |
| 4 | **Real backend inbox** | New `xomify-notifications` table (PK `email`, SK `ts#id`) with read/unread state, feeding an inbox on **both** iOS and web plus badge counts. The current iOS inbox reads `UNUserNotificationCenter.getDeliveredNotifications` and goes empty the moment the user clears their tray. |
| 5 | **Groups is deleted on iOS** | Matches `ea5d391` ("Fold Xomtracks into xomify, replacing feed + groups"). `groups_*` lambdas stay deployed but unused — no backend change, no data migration. |
| 6 | **Commenting stays share-scoped** | Generalizing comments to top-items / Wrapped / Favorites needs a `subjectType`/`subjectId` redesign of the comments table plus UI on 4+ pages. Separate epic. This one only *notifies* on comments that already exist. |
| 7 | **Landing previews use canned demo data** | The landing page is signed-out — there is no Spotify token. Previews are purpose-built lightweight components fed from a fixtures file, not the real feature components (which all depend on authed services). |
| 8 | **Footer mirrors `apps.data.ts`** | The landing footer renders the same app registry xomware.com derives its planets from, plus the 4 GitHub repos and a docs column. Add an app there, it appears here. Hero carries a second CTA: **Get the iOS app** → the TestFlight link already in that registry. |
| 9 | **`rate_reminder` is 24h, once per share, ever** | Suppressed if the share was queued OR rated. Idempotent via a `REMINDED#<shareId>` marker. No second nudge. |
| 10 | **`CHANGELOG.md` gets backfilled, then linked** | ~15 releases (2.2.1 → 2.4.3) reconstructed from git history. A changelog that publicly stops at 2.2.0 reads worse than no changelog. |
| 11 | **`share_listened` + `share_rated` coalesce in a 10-minute window** | Two kinds and two toggles server-side, but `notify()` debounces before dispatch: same actor + same share inside 10 minutes → one merged push. A listen with no follow-up rating still fires on its own once the window closes. |

---

## Track A — Public Landing Page (`xomify-frontend`)

### A1 — `app-space-background`

Replaces `src/app/components/ambient-background/` (295 TS + 66 HTML + 20 SCSS, GSAP blobs
and lightning), which is mounted globally in `app.component.html:1`.

- Canvas-based star field (three parallax depth layers) — canvas, not 200 SVG nodes.
- Drifting nebula clouds in the existing brand purple `#9c0abf` / green `#1bdc6f`.
- Occasional shooting star on a randomized timer (reuses the existing `scheduleLightning`
  cadence pattern).
- `[intensity]` input: `full` (all layers, scroll-reactive parallax) vs `ambient`
  (static field, ~0.3 opacity, slow drift, no shooting stars).
- `prefers-reduced-motion` renders a static composed frame — the existing component
  already does this via `placeStatic()`; keep that contract.
- Pause the RAF loop on `visibilitychange` so a background tab costs nothing.

**Why space, concretely**: `xomware-frontend/src/app/data/planets.ts` already renders the
xomware.com landing as a space journey, one planet per app, derived from `apps.data.ts`.
A starfield here isn't a new direction — it's the parent site's visual language continuing
into the product, and it makes the footer's "Back to Xomware" link feel like one site
rather than two.

**Delete when done**: `src/app/components/ambient-background/` and its module registration.

### A2 — Landing shell + scroll journey

New `src/app/pages/landing/`. `HomeComponent`'s `!isLoggedIn` branch delegates to it; the
signed-in dashboard branch is untouched.

GSAP `ScrollTrigger` drives a pinned-act sequence modeled on
`reeses-playoff-challenge/frontend/components/ui/scroll-journey.tsx`. A progress rail down
the side labels each act. Below the `$breakpoint-lg` breakpoint the pinning disengages and
acts stack as normal scrolled sections — pinned horizontal-feeling scroll on a phone is a
trap.

**Acts** (each = explanation copy + animated preview):

| Act | Explains | Animated glimpse |
|-----|----------|------------------|
| Hero | What Xomify is | Logo, tagline, Spotify CTA, full-intensity space bg |
| Music Taste | Top songs / artists / genres across 4 time ranges | Rank list animating in, positions shuffling between time ranges, album art tiles |
| Monthly Wrapped | Auto-generated monthly playlist + full history | Month chips advancing, playlist card assembling track by track |
| Release Radar | Weekly new releases from artists you follow | Calendar grid filling in, release tiles landing on dates |
| Playlist Builder | Queue building, drag-and-drop, analysis | Tracks dragging into a queue, analysis bars growing |
| Shares | Send a song to a friend, they rate it back | Share card in, reactions popping, comment thread, star rating filling |
| Discovery | Mood picks, concerts, news, likes | Compact tile grid, staggered reveal |
| How it works | Connect → snapshot → generate → share | 4-step numbered sequence, line drawing between steps (DrawSVG) |
| Docs | Where to read more | Links out |
| Join | Convert | Spotify CTA, repeated |

### A3 — Preview components + fixtures

`src/app/pages/landing/previews/` — one small presentational component per act, plus
`landing-fixtures.ts` holding the canned demo data.

Rules: no service injection, no HTTP, `OnPush`, and every animation must be idempotent
under `ScrollTrigger` re-entry (scrolling back up and down again must not double-run a
timeline). Real album art comes from committed local assets, not hotlinked Spotify CDN
URLs that rot.

### A4 — Docs section + footer

Footer today (`footer.component.html`) is a credit line, a context-dependent action
button, and a GitHub button pointing at `xomify-frontend`. Rebuild:

Three columns, sourced rather than hand-maintained:

- **Xomware** — `xomware.com` plus the live app list, mirroring
  `xomware-frontend/src/app/data/apps.data.ts` (Xomify, XomCloud, Xomper, Sun God Derby,
  Reese's Playoff Challenge, Xom Appétit, XomForms, Today In Sports, XomFit, Xomcron).
  Copy the registry shape into a local `xomware-apps.data.ts` with the source file named in
  a header comment — same one-directional convention `_tokens.scss` already uses.
- **Repos** — `xomify-frontend`, `xomify-backend`, `xomify-ios`, `xomify-infrastructure`.
  The current footer hardcodes only the first.
- **Docs** — README, `docs/architecture.md`, `CHANGELOG.md`.

The hero gains a second CTA beside *Connect with Spotify*: **Get the iOS app**, pointing at
`https://testflight.apple.com/join/5CQaJ2mB` (already in the registry). Xomify ships an iOS
app and nothing on the web currently says so.

Keep the existing dynamic action button for authed pages — the landing renders the full
three-column footer, authed pages keep the compact one.

**Changelog backfill** (decision 10): `CHANGELOG.md` has empty `Added`/`Changed`/`Fixed`
sections for every release from 2.2.1 through 2.4.3. Reconstruct them from the ~40 commits
across those tags before linking the file.

### A5 — Landing polish pass

Stylelint compliance (`declaration-property-value-allowed-list` enforces the type ramp —
no font-size outside `$text-3xs`..`$text-5xl`), Lighthouse pass, reduced-motion audit of
every act, and a real check that the signed-out page doesn't pull the authed bundle.

---

## Track B — Notifications Platform (`xomify-backend`, `xomify-infrastructure`, both clients)

### Current state

`notifications_send` accepts exactly two kinds — `queue_threshold` and `digest` — gated on
two flags (`queueNotificationsEnabled`, `digestEnabled`) on the `xomify-device-tokens`
row. The only per-interaction producer in the whole codebase is a latch in
`shares_react/handler.py` that fires `queue_threshold` when N friends queue a share.
`cron_wrapped`, `cron_release_radar`, and `cron_favorites_reminder` all send **email only**.

### B1 — Notification kind registry + fan-out helper

- Promote the kind list to `lambdas/common/notification_kinds.py`: kind → default opt-in,
  title/body template, deep-link route template, section.
- `lambdas/common/notify.py` — one `notify(kind, email, **ctx)` helper that writes the
  inbox row, checks the per-kind opt-in, and async-invokes `notifications_send`.
  Fail-open, exactly like `record_notification`.
- **Coalescing** (decision 11): kinds may declare a `coalesce_key` + window. `share_listened`
  and `share_rated` share the key `(actorEmail, shareId)` on a 10-minute window — the first
  event writes a pending row, the second merges into it and dispatches once
  (*"Dom listened and rated ★★★★ Midnight City"*). A listen with no rating dispatches on its
  own when the window lapses. Needs a short-TTL pending row and a sweeper; simplest home for
  the sweeper is the `cron_rate_reminder` schedule (B5), which already runs daily — but the
  window is 10 minutes, so this needs its own 5-minute rule. Called out in B6.
- Rewrite `notifications_send` to validate against the registry instead of its hardcoded
  `VALID_KINDS` / `OPT_IN_FLAG_BY_KIND` pair.

### B2 — Per-type preferences

`device_tokens_dynamo` gains one boolean per kind. Migration: absent flag reads as the
registry default, so existing rows keep working with no backfill.
`notifications_register` accepts the full preference map.

**The 14 kinds:**

*Shares & Social*
| Kind | Fires when | Producer |
|---|---|---|
| `share_received` | Someone shares a song with you | `shares_create` |
| `share_comment` | Someone comments on your share | `shares_comments_create` |
| `share_reaction` | Someone reacts to your share | `shares_reactions_toggle` |
| `share_listened` | Someone listened to a song you sent | `shares_listened` |
| `share_rated` | Someone rated a song you sent | `shares_react` (`rated`) |
| `queue_threshold` | N friends queued your share | `shares_react` latch *(exists)* |
| `friend_request` | Friend request received | `friends_request` |
| `friend_accepted` | Friend request accepted | `friends_accept` |
| `invite_received` | Invite received | `invites_create` |
| `invite_accepted` | Invite accepted | `invites_accept` |

*Playlist Drops*
| Kind | Fires when | Producer |
|---|---|---|
| `wrapped_drop` | Monthly Wrapped is ready | `cron_wrapped` |
| `release_radar_drop` | Release Radar is ready | `cron_release_radar` |

*Reminders & Updates*
| Kind | Fires when | Producer |
|---|---|---|
| `rate_reminder` | A share you received is still unrated | `cron_rate_reminder` **(new)** |
| `favorites_reminder` | Time to set this year's favorites | `cron_favorites_reminder` |
| `digest` | Weekly shares digest | `cron_shares_digest` *(exists)* |
| `broadcast` | Admin posts an app update | `admin_broadcasts_create` |

### B3 — Inbox table + endpoints

`xomify-notifications` — PK `email`, SK `ts#<rand8>`; attrs `kind`, `title`, `body`,
`route`, `actorEmail`, `actorName`, `imageUrl`, `read`, `createdAt`, `ttl` (90 days).

- `GET /notifications` — paginated feed, newest first
- `POST /notifications/read` — mark one or all read
- `GET /notifications/unread-count` — badge

Distinct from `xomify-notification-log`, which is PK `day`, scan-based, and an
admin send-log rather than a per-user feed. Both stay.

### B4 — Interaction producers

Wire `notify(...)` into `shares_create`, `shares_comments_create`,
`shares_reactions_toggle`, `shares_listened`, `shares_react`, `friends_request`,
`friends_accept`, `invites_create`, `invites_accept`, `admin_broadcasts_create`.

Every call is fire-and-forget — a failed notification must never fail the interaction.
Self-notification is suppressed (you don't get pushed for your own action).

### B5 — Cron producers + `cron_rate_reminder`

- `cron_wrapped` / `cron_release_radar`: after generating each playlist, `notify(...)` with
  a **sneak peek** — top track name + artist + cover art in the body, deep link straight
  into the playlist. This is explicitly what was asked for: "giving me sneak peek and
  opening me to the playlists."
- `cron_favorites_reminder`: add push alongside its existing SES email.
- **New** `cron_rate_reminder` (decision 9): scans `xomify-share-interactions` for shares
  received ≥24h ago with neither `queued` nor `rated` set; **one reminder per share, ever**,
  idempotent via a `REMINDED#<shareId>` marker. Daily schedule. No second nudge — if 24h
  didn't land it, a 72h repeat only teaches you to ignore the app.

### B6 — Terraform

Lambda + IAM + schedule for `cron_rate_reminder` (daily), the `xomify-notifications` table
and its API Gateway routes, IAM for the new `notifications_send` invokers, and a second
5-minute schedule for the coalesce sweeper from B1. Follows the existing
`lambdas_notifications.tf` / `locals.tf` pattern.

### B7 — Web notification surface

`src/app/pages/notification-settings/` (102 TS / 126 HTML) currently covers the old
two-flag model — rebuild against the per-type map. Add a web inbox with unread badge in
the toolbar.

### B8 — iOS notification surface

- `PushKind` enum extended to all 14, with per-kind foreground presentation and deep-link
  routes.
- `NotificationsInboxView` re-pointed from `getDeliveredNotifications` to `GET /notifications`,
  with unread badge and mark-read.
- `SettingsViewModel` + Settings screen: three sections, per-type rows, permission-denied
  affordance retained.

---

## Track C — iOS Parity + Visual Overhaul (`xomify-ios`)

### C1 — IA parity with web

Web's `ea5d391` folded Xomtracks in and deleted Feed + Groups. iOS still ships both.

**Delete**: `Views/Feed/` (12 files — `FeedView`, `ShareCardView`, `FilterChipsView`,
`FeedRefinementSheet`, `AuthorPickerSheet`, `ComposerFAB`, `FeedEmptyStateView`,
`FriendsQueuedListView`, `FriendsRatedListView`, `ReactionsBar`, `ShareComposerView`,
`ShareDetailView` — the last two get **moved**, not deleted, into a new `Views/Shares/`),
`GroupsView`, `GroupDetailView`, `ViewModels/GroupsViewModel`, `GroupDetailViewModel`,
`ViewModels/Feed/`, `FeedCacheService`, and `Destination.feed` / `.groups`.

**Add**: a `Shares` destination matching web's `/shares`, plus `Destination.favorites`
(web has `/favorites`, iOS has nothing).

**Reconcile** the drawer against web's actual nav: Home / Music Taste (Songs, Artists,
Genres, Likes) / Playlists (My Playlists, Builder, Analysis, Mood Picks) / Social (Friends,
Invites, Shares) / Release Radar / Wrapped.

### C2 — Design token layer

`Utilities/DesignTokens.swift` — port `_tokens.scss` (type ramp, 8px spacing grid,
3/6/8/12/16/pill radii, motion curves). `ColorExtensions` and `FontExtensions` already
exist and stay as the color/type source; tokens add the spacing and radius half that's
currently ad-hoc. Sync stays one-directional from `xomware-frontend`.

### C3 — Component rebuild on tokens

Cards, chips, sheets, list rows, buttons, empty states, loaders rebuilt against C2.
Kill hardcoded corner radii and paddings. `AmbientBackground.swift` becomes a space
background matching web A1.

### C4 — Native polish

Large-title navigation, `.ultraThinMaterial` chrome, SF Symbols throughout, haptics on
primary actions, context menus replacing the kebab pattern, swipe actions on list rows,
spring transitions, and `matchedGeometryEffect` on art → detail.

### C5 — iOS QA pass

Dark mode, Dynamic Type at accessibility sizes, VoiceOver on the rebuilt components,
reduced-motion, and a device build of the full notification matrix.

---

## Execution order

```
A1 ──► A2 ──► A3 ──► A4 ──► A5          (web landing — fully independent)

C1 ─────────────────────────┐            (iOS parity — independent, start now)
                            ▼
B1 ──► B2 ──► B3 ──► B4 ──► B8 ──► C3 ──► C4 ──► C5
        │      │      │
        │      │      └──► B7            (web notif surface)
        │      └──► B6                   (terraform, parallel with B4)
        └──► B5                          (cron producers)

C2 ──────────────────────────┘           (tokens — no deps, gates C3)
```

**Suggested sequencing**: A-track and C1+C2 run first in parallel (no shared files, no
shared repo). B1–B3 is the critical path and should start as soon as C1 is merged, since
B8 needs the settled iOS IA to know what routes deep links can target.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Landing page motion tanks mobile performance | Canvas star field with a capped DPR, pinning disabled below `$breakpoint-lg`, RAF paused on hidden tab. Budget: landing must stay ≥90 Lighthouse performance on mobile. |
| 14 push types = notification fatigue, user disables everything | Per-type toggles (decision 3) are the structural answer. Also: self-notification suppression, and the decision-11 coalescing window. |
| `notify()` failures break interactions | Fail-open helper, fire-and-forget async invoke, mirroring the existing `record_notification` contract. |
| Deleting `Views/Feed/` on iOS loses share composer + detail | Those two files are **moved** to `Views/Shares/`, not deleted. Called out explicitly in C1. |
| Token sync drift between web and iOS | `_tokens.scss` stays canonical in `xomware-frontend`; C2 is a generated port with the source hash in a header comment, same as the SCSS file already does. |
| APNs per-kind opt-in migration | Absent flag reads as registry default — no backfill, existing device rows keep working. |

---

## Sub-features

Decomposed 2026-08-24. **Track A is fully planned** (A1–A5 `Ready`) — the whole track was
written up front so the landing page could be reviewed as one design. Tracks B and C are
`Draft` stubs; run `/plan <slug>` on each before `/execute`.

**Execution mode**: parallel within each wave.

**Track A is complete** as of 2026-08-25 on `feature/landing-page` — A1–A5 all `Done`,
513/513 tests passing, lint and production build clean. Five commits, one per sub-feature.
Lighthouse, contrast and cross-browser remain unverified; see `landing-polish/PLAN.md`.

Tracks B and C have not started — this session has no write access to `xomify-backend`,
`xomify-infrastructure` or `xomify-ios`, so their 12 stubs are staged rather than installed.

| ID | Slug | Repo | Wave | Depends on |
|----|------|------|------|------------|
| A1 | `landing-space-background` | frontend | 1 | — |
| A2 | `landing-scroll-journey` | frontend | 2 | A1 |
| A3 | `landing-feature-previews` | frontend | 3 | A2 |
| A4 | `landing-docs-footer` | frontend | 3 | A2 |
| A5 | `landing-polish` | frontend | 4 | A3, A4 |
| B1 | `notification-kind-registry` | backend | 1 | — |
| B2 | `notification-per-type-prefs` | backend | 2 | B1 |
| B3 | `notification-inbox-api` | backend | 2 | B1 |
| B4 | `notification-interaction-producers` | backend | 3 | B2, B3 |
| B5 | `notification-cron-producers` | backend | 3 | B2, B3 |
| B6 | `notification-infra` | infrastructure | 4 | B3, B5 |
| B7 | `web-notification-surface` | frontend | 4 | B2, B3 |
| B8 | `ios-notification-surface` | ios | 4 | B2, B3, C1 |
| C1 | `ios-ia-parity` | ios | 1 | — |
| C2 | `ios-design-tokens` | ios | 1 | — |
| C3 | `ios-component-rebuild` | ios | 2 | C1, C2 |
| C4 | `ios-native-polish` | ios | 3 | C3 |
| C5 | `ios-qa-pass` | ios | 5 | C4, B8 |

**Cross-repo note**: stubs live in the repo each sub-feature touches, following the
`auth-identity-and-live-top-items` precedent (that epic replicates across all four repos).

**Deploy-order trap**: B6 is the *last* wave-4 item to be written but the *first* to be
applied — the `xomify-notifications` table and the two new schedules must exist before B3
and B5 can run in prod.

