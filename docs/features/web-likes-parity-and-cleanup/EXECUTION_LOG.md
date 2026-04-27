# Execution Log: Web Parity — Likes + Feed Cleanup + Auth Boot Fix

## 2026-04-27 — Phase 1: Auth Preemptive JWT Mint (v2.2.1)
- **PR**: #259 — merged
- **Action**: Added `ensureXomifyJwt()` to `AuthService`. Wired into `AppComponent.ngOnInit` via `switchMap` so `userService.ensureLoaded()` waits on the mint. Added `auth.service.spec.ts` covering all three branches (existing JWT / mint when missing / null when no Spotify token).
- **Files changed**: `auth.service.ts`, `app.component.ts`, `auth.service.spec.ts`
- **Version**: 2.2.0 → 2.2.1 (patch)
- **Result**: success

## 2026-04-27 — Phase 2: Feed Card Actions Menu (v2.3.0)
- **PR**: #260 — merged
- **Action**: Fixed `.author` flex truncation (`flex: 1`). Replaced per-card Share button with a 3-dot kebab menu (play / add to queue / share post / open in Spotify). `@HostListener('document:click')` closes the menu on outside click. Relabeled feed header button to "Create Share". Updated `share-card.component.spec.ts` with `PlayerService` mock and menu behavior tests.
- **Files changed**: `share-card.component.ts`, `share-card.component.html`, `share-card.component.scss`, `share-card.component.spec.ts`, `feed.component.html`
- **Version**: 2.2.1 → 2.3.0 (minor)
- **Result**: success

## 2026-04-27 — Phase 3: Web Likes Parity (v2.4.0)
- **PR**: #261 — merged
- **Action**:
  - `LikesService` — `pushUserLikes` (batched 100/req), `getLikesByUser`, `setLikesPublic`
  - `LikesPushCoordinatorService` — once-per-24h push of `/me/tracks` via `SongService.getAllUserTracks`, wired into `AppComponent.ngOnInit` after JWT mint chain (fire-and-forget)
  - `LikesComponent` — `/likes` (self) and `/likes/:email` (friend), search with debounce, load-more pagination, 403→private empty state
  - `UserService` — `likesCount` + `likesPublic` read from `/user/data`, getters/setters exposed
  - `FriendProfile` interface — `likesCount` + `likesUpdatedAt` fields
  - `my-profile` — Likes stat chip → `/likes`, Privacy toggle in Settings tab with optimistic UI + rollback
  - `friend-profile` — Likes chip → `/likes/<email>` (shown when `profile.likesCount != null`)
  - Registered `LikesComponent` in `SocialModule` with routes `/likes` and `/likes/:email`
  - `likes.service.spec.ts` covering all three methods
- **Files changed**: `likes.service.ts`, `likes.service.spec.ts`, `likes-push-coordinator.service.ts`, `user.service.ts`, `friends.service.ts`, `likes.component.{ts,html,scss}`, `social.module.ts`, `my-profile.component.{ts,html,scss}`, `friend-profile.component.{ts,html}`, `app.component.ts`
- **Version**: 2.3.0 → 2.4.0 (minor)
- **Result**: success

## Summary
All 3 phases shipped. Versions: 2.2.1, 2.3.0, 2.4.0. PRs: #259, #260, #261 — all merged to master.
