# Web Parity: Likes + Feed Cleanup + Auth Boot Fix

**Status:** Done
**Repo:** xomify-frontend
**Base:** master
**Strategy:** 3 sequential PRs, each branch off latest master, each on auto-merge.

---

## Context

iOS just shipped a Likes feature (PRs #97-99 on xomify-ios; backend PRs #169-172 on xomify-backend; infra PR #77 on xomify-infrastructure). Web needs to match.

Dom's screenshot also flagged Feed UI bugs:
- Author header is visually cropped (only avatar + "2d ago" visible).
- Two Share buttons (page header + per-card) — confusing UX. iOS uses a per-card 3-dot action menu (play / queue / share post / external).

Dom is also seeing widespread 401s on `/user/data`, `/user/top-items`, `/shares/feed`, `/groups/list`. Root cause: the JWT interceptor mints on OAuth callback only — restored sessions (page reload, fresh tab) ship the legacy `apiAuthToken: '---'` fallback first, then rely on the 401-retry path which can fail or race.

---

## Phase 1 — Auth boot fix (small, ships fast)

**Branch:** `feature/auth-preemptive-jwt-mint`
**Version:** 2.2.1 (patch)

**Goal:** On app boot with restored Spotify tokens but no JWT, mint preemptively so the first API call carries a valid Bearer JWT.

**Changes:**
- `src/app/services/auth.service.ts`
  - Add `ensureXomifyJwt(): Observable<string | null>` — if `xomifyAuth.hasJwt()` returns true, no-op (return `of(currentJwt)`); else if `accessToken` is set, call `xomifyAuth.mintFromSpotifyAccessToken(accessToken)`; else return `of(null)`.
- `src/app/app.component.ts`
  - In `ngOnInit`, after the existing `isLoggedIn()` check, call `authService.ensureXomifyJwt().pipe(take(1)).subscribe()` BEFORE `userService.ensureLoaded()`. Chain via `switchMap` so `ensureLoaded()` waits for the mint.
- `src/app/services/auth.service.spec.ts` (or new) — unit-test `ensureXomifyJwt`: returns existing JWT, mints when missing, returns null when no Spotify token.

**Verify:**
- `npm run build` clean.
- Manual: clear sessionStorage `xomify_jwt`, reload, check Network tab — first request should have Bearer JWT (not `---`).

---

## Phase 2 — Feed UI cleanup

**Branch:** `feature/feed-card-actions-menu`
**Version:** 2.3.0 (minor — UX change)

**Goal:** Fix cropped author header. Replace per-card "Share" button with a 3-dot action menu matching iOS (play / queue / share post / open in Spotify).

**Changes:**
- `src/app/components/share-card/share-card.component.scss`
  - Fix the `.author-meta` truncation: ensure `.author-meta` has `min-width: 0` AND `flex: 1`. Confirm `.card-header` doesn't have a fixed `height` that would clip the row. Restore visible username.
- `src/app/components/share-card/share-card.component.html`
  - Remove the standalone "Share" button at the bottom-right of the card.
  - Add a 3-dot kebab `<button>` next to "+ Queue" using `<mat-icon>more_vert</mat-icon>` or a CSS dot. Clicking opens a small popover/menu.
- New `src/app/components/share-card/share-card-actions-menu/share-card-actions-menu.component.ts` (+ `.html` + `.scss`):
  - Inputs: `track`, `shareLink`.
  - Outputs/actions: `play()`, `queue()`, `sharePostLink()` (existing `shareLink()` behavior — copy share URL), `openInSpotify()` (use `track.external_urls.spotify` or build from `uri`).
  - Component-local open/close state, click-outside to dismiss.
- `src/app/pages/feed/feed.component.html`
  - Keep top-right "+ Share" but rename to "Create Share" or add `aria-label="Create new share"` for clarity. (Label change only — wiring unchanged.)
- Delete the now-dead `shareLink()` styling overrides on the card if any.
- Add a `.spec.ts` for the new menu component (open/close + each action emits / calls correctly).

**Verify:**
- `npm run build` clean.
- Manual: load Feed, confirm author username + handle visible above the track row. Confirm only ONE Share-related control per card (the menu). Confirm play/queue/share/open all work.

---

## Phase 3 — Likes parity

**Branch:** `feature/web-likes-parity`
**Version:** 2.4.0 (minor — new feature)

**Goal:** Match iOS social-library-likes feature on web.

**Backend endpoints (already deployed):**
- `POST /likes/push` — body `{ tracks: [{ trackId, addedAt, ...meta }] }`
- `GET /likes/by-user?email=<email>` — returns paginated saved tracks of any user (subject to that user's `likesPublic` flag); friends always allowed
- `POST /users/likes-public` — body `{ public: boolean }`
- `GET /friends/profile?friendEmail=<email>` — now includes `likesCount` and `likesUpdatedAt`
- `GET /user/data` — should also return `likesCount` for self (verify; if not, fetch from `/likes/by-user?email=self&limit=1` and read total)

**Changes:**

### 3a. Likes service
- New `src/app/services/likes.service.ts`:
  - `pushUserLikes(tracks: LikePushItem[]): Observable<void>` — chunks into batches (e.g. 100/req) and pipes into `concatMap` to push sequentially.
  - `getLikesByUser(email: string, opts: { limit?: number; cursor?: string; q?: string }): Observable<LikesByUserResponse>`
  - `setLikesPublic(isPublic: boolean): Observable<void>`
- Models in same file: `LikePushItem`, `LikesByUserResponse`, `LikesTrackDisplayItem`.
- `src/app/services/likes.service.spec.ts` covering each method.

### 3b. Cold-open push hook
- `src/app/services/likes-push-coordinator.service.ts`:
  - On call to `runIfDue()`, check sessionStorage flag `xomify_likes_pushed_at` (ISO date). If unset OR older than 24h, paginate `/me/tracks` from Spotify (existing service) and call `likesService.pushUserLikes(...)` then write the timestamp.
- Wire into `AppComponent.ngOnInit` after the JWT mint chain: `coord.runIfDue().subscribe()`.
- Errors swallowed with console.warn (push failure must not block the UI).

### 3c. Likes page (self + friend)
- New route: `{ path: 'likes', component: LikesComponent }` and `{ path: 'likes/:email', component: LikesComponent }` (friend variant).
- New `src/app/pages/likes/likes.component.{ts,html,scss}`:
  - Reads `:email` route param. If absent → self mode (read user email from `UserService`). If present → friend mode.
  - Search input wired to `likesService.getLikesByUser(..., { q })` with debounce.
  - Paginated list with infinite-scroll OR "Load more" button (match existing playlist-tracks pattern).
  - Each row: album art + title + artist + small kebab matching the new share-card actions menu (play / queue / share post optional / open in Spotify).
  - Empty state copy: self → "You haven't liked any songs yet." friend → "{name}'s likes are private." (when 403/empty).
  - 403 handling: render the "private" empty state instead of an error toast.
- `.spec.ts` for the page (self mode loads, friend mode loads, search filters, pagination triggers next page, 403 → private state).

### 3d. Profile chips
- `src/app/pages/my-profile/my-profile.component.{html,ts}`:
  - Add a "Likes" stat in the stats row (next to existing Friends/Ratings/Posts). Tap navigates to `/likes`.
  - Source `likesCount` from `userService` (extend if needed).
- `src/app/pages/friend-profile/friend-profile.component.{html,ts}`:
  - Add the same chip (un-gated). Tap navigates to `/likes/<friendEmail>`.
  - Source from `friendsService.getFriendProfile(...).likesCount`.

### 3e. Settings toggle
- In `my-profile` Settings tab (or wherever the user-facing settings live — confirm by reading the file):
  - Add a "Privacy" section with a toggle: "Make my likes visible to friends".
  - On toggle change: call `likesService.setLikesPublic(value)`. Optimistic UI; rollback + toast on error.
  - Read initial value from `userService.getCurrentUser().likesPublic` (extend the user model if missing).

**Verify:**
- `npm run build` clean.
- Manual: load `/my-profile`, see Likes chip with non-zero count after first push runs. Click chip → Likes page renders. Search filters. Toggle privacy → friend's view of `/likes/<self>` updates accordingly.

---

## Conventions

- Branch naming: `feature/<short-slug>` (no issue numbers unless tied to one).
- Commit messages: terse, no Co-Authored-By, no `#N` issue tag.
- Version bumps via `npm run version:patch|minor`. Update CHANGELOG.md if that's the convention (check recent commits).
- Auto-merge each PR: `gh pr merge <num> --auto --squash`.
- Build verify before opening PR: `npm run build`.

## Out of scope
- Web Playback SDK / track preview playback (use existing player hooks).
- Backend changes (already shipped).
- Tests for legacy code untouched by this PR.
