# Changelog

All notable changes to the Xomify Frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Weekly Goals now sync through the account (`/goals/*`) instead of `localStorage`

### Fixed
- "Genres explored" reported `unique artists / 2` — a number that was never a genre count
- Weekly streak no longer reset to zero every Monday by the week in progress
- Week history labels named the day before the Monday they described

## [2.6.0] - 2026-08-25

### Added
- Public landing page: ten-act scroll journey with live, looping previews of every feature
- Real album art on the landing page, from the Cover Art Archive
- Landing top navigation — Overview, How it works, Docs, iOS, Sign in
- Notifications inbox at `/notifications`, with an unread badge in the toolbar
- Three-column sourced footer mirroring the Xomware app registry, plus a TestFlight CTA
- Public landing page for signed-out visitors: ten-act scroll journey with animated feature previews, docs section, three-column footer
- Canvas space background (parallax star layers, drifting nebula, shooting stars) replacing the GSAP blob background
- My Favorites: curated best-of lists with rank history, recommendations and a profile summary
- Full tabbed Admin Portal — Health, Users, Crons, Notifications, Broadcasts, plus an Overview tab
- Admin extractor-status view with last-scan, stale flag, playlist status and a run-history feed
- Full impersonation mode ("View As"), using the target user's real Spotify data
- Home rebuilt as a logged-in dashboard, with a live Now Playing widget
- Shares: 3-phase self-serve onboarding Connection panel
- `/search` page and toolbar search entry point
- Share-detail page with comments, reactions and friend drilldowns
- `/share?trackId` deep-link route (desktop Spotify share parity)
- `user-read-recently-played` scope for the now-playing fallback

### Changed
- `NotificationsService` extended with inbox feed, mark-read and unread-count
- `RelativeTimePipe` moved to `SharedModule`
- Notification settings page relabelled "Device registrations" — it is a maintenance tool, not preferences
- Folded Xomtracks into Xomify, replacing the Feed and Groups features
- Renamed the Shares route from `/xomtracks` to `/shares`
- Adopted the shared Xomware design tokens and the tightened radius scale
- Established global design tokens and de-bubbled the shared components
- Restyled the Admin Portal to a macOS pro-tool look; consolidated icons
- Restructured navigation into a user-avatar dropdown
- Removed all emoji glyphs from the UI
- Replaced the broken Web Playback SDK playback with a shared 30-second preview player
- Auth tokens now persist across browser restarts
- Redesigned the Wrapped and Release Radar opt-in flow

### Fixed
- Footer rendered as a fixed full-height overlay on the landing page, covering the content
- Landing acts stacked on top of one another when the pinned journey collapsed
- Album art stretched into flat slivers instead of staying square
- `getFeed` dropped its pagination cursor: a `tsId` contains `#`, which terminated the query string
- "View Source" pointed at a repository that does not exist (`domgiordano/` rather than `Xomware/`)
- Global `scroll-behavior: smooth` was not guarded by `prefers-reduced-motion`
- Blurry album art — now selects a higher-resolution Spotify image
- 401s on direct Spotify API calls from a stale localStorage access token
- Home dashboard spotlight rendering blank instead of a loading skeleton
- Post-login redirect, Home nav highlight, mood-timeline icon, genre number overflow
- Flaky Wrapped/Release Radar enrollment
- `likes_count` snake_case mismatch on the web profile
- My Profile tab switcher moved into a dropdown off the profile name
- Shares: untitled shares filtered, playlist tabs split correctly, search box cleaned up
- Playlist detail: Spotify-only action row replaced with builder + share buttons
- `user/update` call now falls back to email
- Deploy hardened: fail-fast on empty SSM credentials, with injection verified

## [2.5.0] - 2026-04-28

Version bump only — no functional changes in this release.

**Note**: `package.json` lagged at `2.4.3` while this tag existed. Reconciled in 2.6.0,
which is the first release where the two agree.

## [2.4.3] - 2026-04-28

### Fixed
- `likes_count` snake_case mismatch on the web profile

## [2.4.2] - 2026-04-28

Version bump only — no functional changes in this release.

## [2.4.1] - 2026-04-28

### Added
- `/search` page with a toolbar magnifying-glass entry point
- Share-detail page with comments, reactions and friends drilldowns
- Recent tab on My Profile, plus Ratings/Posts header counts
- Likes surfaced in the navigation

### Changed
- Feed: dropped the sticky page header and collapsed three action rows into one
- Feed: grid layout, smaller side-by-side hero, sharer identity, delete-share
- Composer pre-fills the rating; supports group-or-public targeting
- Renamed "Create Share" to "Share Song"
- Self-likes now go straight to Spotify, mirroring the iOS path
- `/likes/push` batch size dropped from 100 to 25 (WAF body limit)

### Fixed
- Friend profile and Following — five bundled fixes from the diagnostic pass
- Likes push body fields, live count and hydrated compatibility
- `getUserTracks` signature widened with a limit param, plus token refresh
- Web tolerates an unwrapped `/auth/login` response (no envelope)
- `hasJwt` validates claims and expiry, rejecting stale or legacy tokens
- Xomify JWT minted on bootstrap with a fresh Spotify token
- Toolbar avatar chip; My Profile now uses `TopItemsService`
- `/user/top-items` raw shape parsed; real name and avatar shown on feed cards
- Horizontal kebab, removed a misleading Queue action, `/likes` pagination

## [2.4.0] - 2026-04-27

### Added
- Web Likes parity: likes service, `/likes` page, profile chips and a privacy toggle
- Likes push coordinator

## [2.3.0] - 2026-04-27

### Changed
- Replaced the per-card Share button with a 3-dot kebab actions menu
- Fixed the feed card author header

## [2.2.1] - 2026-04-27

### Added
- Preemptive Xomify JWT mint on app boot, so restored sessions no longer 401 on their first API call

## [2.2.0] - 2026-01-13

### Added
- Add to Queue functionality for Release Radar albums/singles
- Add to Queue functionality for Wrapped monthly tracks
- CHANGELOG.md for tracking version history
- Enhanced GitHub Actions workflow with version management

### Changed
- N/A

### Fixed
- N/A

## [2.1.0] - 2024-12-XX

### Added
- Release Radar with calendar and list views
- Weekly email notifications for new releases
- Release Radar history tracking
- Weekly playlist generation from followed artists

### Changed
- Updated wrapped service to save monthly snapshots

### Fixed
- Release radar weekly view handling
- Wrapped style improvements

## [2.0.0] - Earlier

### Added
- Monthly Wrapped feature with historical data
- Top songs, artists, and genres tracking by month
- Enrollment system for Wrapped and Release Radar
- Queue Builder with drag-and-drop functionality
- Spotify Web Playback SDK integration
- Play/pause controls throughout the app

### Changed
- Complete UI/UX refresh with modern styling
- Improved navigation and page layouts

---

## Version Format

### Version Numbers
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version (X.0.0): Incompatible API changes or major feature overhauls
- **MINOR** version (0.X.0): New features in a backward-compatible manner
- **PATCH** version (0.0.X): Backward-compatible bug fixes

### Change Categories
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes
