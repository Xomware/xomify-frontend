# Shares Self-Serve Onboarding — Connection Panel

**Status:** Ready
**Owner:** Dom
**Repos:** `xomify-frontend` (primary), `xomtracks-backend` (one small change)
**Created:** 2026-08-04

---

## Problem

Today the "Toggle in your own shares" card is a **fire-and-forget token dispenser**:
mint a token → copy two shell commands → and the UI never confirms anything
worked. The trust story (read-only, never sends messages, token never on disk)
and the prerequisites (macOS, Terminal, Full Disk Access) live *inside the
terminal installer* — which the user only sees *after* they've already committed
to a `curl | bash`. There's no feedback loop, so a user can't tell whether
they're connected, whether a scan has run, or whether their shares are landing.

**Goal:** turn the card into a small stateful **Connection panel** — set
expectations and earn trust *before* the token, then show **live status**
(connected · last scan · N shares) *after* it, so onboarding feels real instead
of "here's a token, good luck."

## Non-Goals (this pass)

- Rewriting the extractor / installer itself (`install.sh` stays as-is).
- A *heavy* device manager (rename, per-token scopes, usage graphs). We DO add
  a minimal caller-scoped **device list** this pass (see Decision 1) so revoke
  works from any device — but nothing beyond list + revoke + add.
- Windows/Linux support — extractor is macOS-only by nature (`chat.db`,
  launchd, Keychain). We now *say so up front* rather than support it.
- Non-admin ability to see other users' ingest status (admin portal already
  covers that separately).

---

## What already exists (grounding)

Confirmed in the backend so the spec isn't hand-wavy:

- `GET /me/get` already returns `ownIngest` (bool), `shareCount` (int),
  `spotifyConnected`, `linkStatus`.
  (`xomtracks-backend/lambdas/me_get/handler.py`)
- The ingest-token row already carries **`lastUsedAt`** (epoch), stamped
  best-effort on *every* extractor push via `_touch_last_used`.
  (`xomtracks-backend/lambdas/common/ingest_tokens.py`)
- Mint (`POST /ingest-tokens/create`) and revoke (`/ingest-tokens/revoke`,
  takes `tokenHash` in the body) already exist and are wired to the current card.
- Admin-scoped `list_all_tokens()` already exists
  (`ingest_tokens.py` → returns `ownerEmail, tokenHash, label, createdAt,
  lastUsedAt, revoked`) — a **caller-scoped** list is a thin filter over the
  same query.

So the missing datums are: (a) surfacing `lastUsedAt` per token, and (b) a
caller-scoped list route. No new storage, no extractor change.

## Locked decisions

1. **One active token *per device*, re-mintable across devices** — add a
   caller-scoped `GET /ingest-tokens/list` so Phase C can show all the user's
   devices and revoke any of them (not just the one this browser minted).
   Replaces the fragile localStorage-hash revoke. Not a heavy manager —
   list + revoke + "add another device" only.
2. **`lastScanAt` / `lastUsedAt` surfaced as ISO 8601 strings** (handler
   converts the stored epoch), matching the frontend's existing relative-time
   rendering for other timestamps (`messageDate`, `played_at`).
3. **Always-poll-while-null** — no "I've run the installer" button. Phase C
   polls whenever it's showing with no scan yet; self-heals across reloads.

---

## Proposed flow

Three phases in one panel, driven by `/me/get` + local mint state:

### Phase A — Not connected (pre-token)

Replaces today's one-paragraph blurb. Shown when `ownIngest === false`.

1. **What this is** — one line: your iMessage music links, scanned locally,
   added to the feed stamped as yours.
2. **Requirements** (explicit, up front): a **Mac**, comfort running one
   **Terminal** command, and granting **Full Disk Access** (so it can read
   `chat.db`). macOS-only — stated, not discovered.
3. **Trust story** (the reassurance that's currently buried in the installer):
   - Runs **entirely on your Mac** — read-only against `chat.db`.
   - **Never** sends messages, **never** writes to the DB.
   - Only **music links** (Spotify / SoundCloud / Apple Music) are pushed here
     — not message text, not contacts.
   - Token is stored in your **login Keychain**, never on disk, never in the
     browser.
4. CTA: **Generate my token** (optional device Label, as today).

### Phase B — Token minted (one-time reveal)

Unchanged in substance, tightened in form:

- One-time plaintext token + "copy now, can't be recovered" warning.
- **Single** primary step: the guided installer one-liner (`curl … | bash`).
  Demote the standalone Keychain command to a collapsible *"prefer to store the
  token manually?"* — the installer already takes it interactively, so showing
  both as co-equal steps is the current redundancy (gap #5).
- After copying, a **"I've run the installer"** button → advances to Phase C's
  polling state (instead of a bare "Done").

### Phase C — Connected (live status + devices)

Shown when `ownIngest === true`. This is the new part.

**Header — overall status:**
- **Connected** indicator (green dot).
- **Last scan:** relative time from `lastScanAt` (`"3 min ago"`,
  `"waiting for first scan…"` until the first push lands).
- **Your shares:** `shareCount` ("12 of your links in the feed").

**Devices list** (from `GET /ingest-tokens/list`, active tokens only):
- One row per device: **label** (or "Unnamed device") · **last scan**
  (per-token `lastUsedAt`) · **Revoke** button.
- Revoke calls `/ingest-tokens/revoke` with that row's `tokenHash` — works
  regardless of which browser/device you're on (the fix for "revoke on a
  different device").
- **"Add another device"** → drops back into Phase B (mint a new token, run
  the installer on the new Mac). The old device keeps working until revoked.
- If the list is empty but `shareCount > 0` (they own shares but hold no live
  token — e.g. all revoked), show a gentle "no active devices — add one to keep
  scanning" nudge.

**First-scan polling:** whenever Phase C is showing and `lastScanAt` is null,
poll `/me/get` (+ the device list) every ~15s for up to ~10 min, so the moment
the first push lands the panel flips from "waiting for first scan…" to
"last scan just now · N shares". Stop once `lastScanAt` is set or the window
elapses (falls back to on-load refresh; self-heals across reloads per
Decision 3).

---

## Backend changes (`xomtracks-backend`)

**1. Surface `lastScanAt` on `/me/get`.**
- Return the **max `lastUsedAt`** across the caller's non-revoked tokens as
  ISO 8601 (convert from the stored epoch); `null` when no push has landed yet
  (drives "waiting for first scan…"). Extend the query already run for
  `ownIngest` rather than adding a call. No schema change.

**2. New caller-scoped list route: `GET /ingest-tokens/list`.**
- Returns the caller's **own** active (non-revoked) tokens:
  `[{ tokenHash, label, createdAt, lastUsedAt }]`, timestamps ISO 8601.
- Thin wrapper: filter the existing `list_all_tokens()` (or a scoped query) by
  `ownerId == caller`, drop `revoked`, never return plaintext. Cognito-gated
  like the other `/ingest-tokens/*` routes.
- Route is 2 levels (`/ingest-tokens/list`), consistent with the api-gateway
  no-path-param constraint (revoke already passes `tokenHash` in the body).
- Infra: add the Lambda + route (mirror `ingesttokens_revoke`).

Everything else the panel needs (`ownIngest`, `shareCount`) is already there.

## Frontend changes

`xomify-frontend`, all inside the existing setup-card component + its service:

1. **`XtMeResponse` model** — add `lastScanAt: string | null`.
2. **Ingest-tokens service** — add `list()` → `GET /ingest-tokens/list`
   (`XomtracksIngestTokensService` already has `create`/`revoke`). Add a
   `IngestTokenSummary` model (`tokenHash, label, createdAt, lastScanAt`).
3. **Setup card → Connection panel** — render Phase A / B / C off `ownIngest`
   + mint state. Inject `XomtracksMeService`; keep the existing
   `impersonation.isImpersonating` gate so an impersonated user sees their own
   real phase (they may be pre- or post-connect).
4. **Device list (Phase C)** — render the `list()` rows with per-row revoke;
   "Add another device" re-opens the mint form. Replaces the localStorage-hash
   revoke as the source of truth (keep the hash only as an optimistic hint).
5. **First-scan polling** — a bounded `timer(0, 15s)` that refreshes `/me/get`
   (+ device list) while Phase C shows a null `lastScanAt`, until it's set or
   the window elapses; `takeUntil(destroy$)`.
6. **Copy** — the requirements + trust bullets (Phase A) and the demoted
   Keychain step (Phase B).
7. **Tests** — phase selection by `ownIngest`; device list renders + revoke
   calls with the right hash; "waiting → scanned" transition; polling stops on
   first scan; impersonation shows the panel AND disables revoke (read-only).

## Copy (draft — for review)

> **Add your own shares**
> Your iMessage music links, scanned on your Mac and added to the feed as yours.
>
> **You'll need:** a Mac · Terminal · Full Disk Access (to read your Messages DB)
>
> **How your data is handled**
> · Runs entirely on your Mac, read-only
> · Never sends messages, never writes to your Messages DB
> · Only music links are shared — never message text or contacts
> · Your token lives in the login Keychain, never on disk

---

## Risks / tradeoffs

- **Polling `/me/get`** adds load during the onboarding window only (bounded,
  one user, ~10 min). Acceptable; stops on first scan.
- **`lastUsedAt` is best-effort** (stamped in a `try/except` that never fails
  the push). Rare case: a scan lands shares but the stamp write fails →
  "last scan" lags while `shareCount` moves. Mitigate copy: lead with
  `shareCount` ("12 of your links"), treat last-scan as secondary.
- **Trust claims must stay true.** The bullets are load-bearing promises; if the
  extractor ever changes what it reads/sends, this copy must change with it.
  Cross-linked to the extractor's own README/installer wording.
- **Impersonation:** Phase C shows the *target's* `shareCount`/`lastScanAt`
  (correct — it's their real connection state). Revoke while impersonating
  would revoke *their* token — keep revoke disabled under impersonation
  (read-only, matches the rest of impersonation's write policy).

## Open questions — RESOLVED

1. ~~single-token vs device manager~~ → **minimal device list** (list + revoke +
   add), so revoke works from any device. Not a heavy manager. (Decision 1)
2. ~~`lastScanAt` format~~ → **ISO 8601**. (Decision 2)
3. ~~polling trigger~~ → **always poll while `lastScanAt` is null**, no button.
   (Decision 3)

## Implementation steps

1. **Backend — `/me/get`** — add ISO `lastScanAt` (max `lastUsedAt`, revoked
   excluded, null when never used); unit test. Deploy.
2. **Backend — `GET /ingest-tokens/list`** — new caller-scoped Lambda + infra
   route (mirror `ingesttokens_revoke`); returns active tokens only, ISO
   timestamps, no plaintext; unit test the owner filter. Deploy (backend PR +
   infra PR; plan-check the infra branch against current master first).
3. **Frontend model + service** — `lastScanAt` on `XtMeResponse`;
   `IngestTokenSummary` + `list()` on the ingest-tokens service; confirm
   `XomtracksMeService.refresh()` busts `shareReplay` for polling.
4. **Panel Phase A/B/C** — rebuild the card template + component state machine.
5. **Device list + polling** — Phase C rows with revoke; bounded first-scan poll.
6. **Tests** — the cases in Frontend §7.
7. **Manual** — real end-to-end: fresh (impersonated) user → mint → run
   installer → watch it flip to "connected · N shares"; revoke from a second
   browser.

## Estimate

Medium. Backend ~1 day (`lastScanAt` field + new list route/Lambda/infra +
tests). Frontend ~1.5–2 days (state machine + device list + copy + polling +
tests). Low–moderate risk — mint/revoke exist and `lastUsedAt` is already
stored; the new surface area is one read route + one infra route.
