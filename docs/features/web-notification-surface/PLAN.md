# Plan: web-notification-surface

**Epic**: xomify-relaunch (`docs/features/xomify-relaunch/PLAN.md`, on `feature/landing-page`)
**Sub-feature ID**: B7 (`web-notification-surface`)
**Track**: B — Notifications Platform
**Status**: Done (inbox shipped; preference editing intentionally out of scope)
**Created**: 2026-08-24
**Last updated**: 2026-08-25
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/web-notification-surface`
**Wave**: 4
**Depends on**: `B2`, `B3`

---

## Outcome

**518/518 tests** (up from 510), lint and build clean. Initial bundle **+0.19 kB**.

| File | Change |
|------|--------|
| `src/app/services/notifications.service.ts` | inbox methods + `unread$` badge subject |
| `src/app/pages/notifications-inbox/` | new — the inbox page |
| `src/app/pages/social/social.module.ts` | `/notifications` route + declaration |
| `src/app/components/toolbar/` | bell with unread badge |
| `src/app/shared/shared.module.ts` | `RelativeTimePipe` moved here |
| `src/app/pages/notification-settings/` | relabelled honestly |
| `src/app/services/notifications.service.spec.ts` | new — 8 tests |

## The plan said "rebuild settings against the per-type map". That was wrong.

Per-kind opt-in flags live on the **device-token row**, and the browser has no device
token — it has no APNs registration at all. There is nothing for web to toggle.

Editing a *phone's* preferences from the browser is a coherent feature, but it needs a
`GET /notifications/devices` endpoint to enumerate the user's devices first. That endpoint
does not exist, and inventing it was outside this sub-feature. **Not built, and not
pretended.**

What web *does* own is the inbox, because it is keyed by email rather than device. That is
exactly why B3 writes inbox rows independently of push deliverability — without that
decision, every web user would have a permanently empty inbox.

The existing settings page was never a preferences screen either: it asks the user to paste
a raw APNs device token. It is a maintenance tool. Left working, retitled "Device
registrations", and given a note pointing at the real inbox — leaving it called
"Notifications" next to an actual inbox invites people to look for preferences there and
conclude the app is broken.

## Bug caught by a test

`getFeed` originally interpolated the cursor into the URL. A `tsId` contains `#`, which
**terminates the query string** — the cursor would have been silently dropped and the
client would have re-requested page one forever. Now sent via `HttpParams`, which encodes
it, with a test asserting `%23` survives.

## Other notes

- `RelativeTimePipe` moved to `SharedModule`. Two NgModules cannot declare the same pipe,
  and both `discovery` and `social` need it.
- **The badge is fetched once on mount, not polled.** A timer running against the API for
  a whole session costs more than the nicety is worth; the inbox refreshes it on open, and
  marking read updates it locally through the same subject.
- **Marking read is optimistic**, and reverts on failure. A row that stays bold after you
  clicked it reads as broken.
- **Unread state is a left rule *and* a dot**, not colour alone.
- `routeFor()` translates shared backend route tokens to Angular routes; unknown tokens
  return null and simply do not navigate, rather than routing into a 404.

## Correction to the landing PR (#335)

That PR cites "baseline 229.44 kB". **The true `master` baseline is 254.74 kB** — 229.44
was measured after A1 had already removed the GSAP-importing `ambient-background` from the
eager path. The landing branch therefore *reduces* initial transfer by ~24 kB rather than
being neutral.
