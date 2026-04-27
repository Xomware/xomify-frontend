# Reference: Auth Identity Hardening + Live `/user/top-items`

This repo (`xomify-frontend`) is part of a **5-repo epic**. The canonical plan lives at:

**`/Users/dom/Code/xomify-backend/docs/features/auth-identity-and-live-top-items/PLAN.md`**

Read that doc for full context. This file is a pointer + a list of sub-features that touch THIS repo.

## Sub-features in this repo

- **(0e) `web-per-user-jwt`** — After Spotify OAuth, call `POST /auth/login` to mint a per-user JWT. Store in `sessionStorage`. Replace every `environment.apiAuthToken` reference (~10 services) with the per-user token via an `HttpInterceptor`. Add a 401-retry interceptor that refreshes Spotify token, re-mints, and retries once.

- **(1j) `frontend-drop-caller-email`** — Sweep all Angular services. Remove caller `email` query params and body fields. Keep target emails (`friendEmail`, etc.).

- **(2b) `music-taste-page-wire-up`** — Point the Music Taste page at the new `GET /user/top-items` endpoint instead of whatever snapshot it currently uses.

## Affected repos (full epic)

1. `xomify-backend` (Python lambdas) — canonical plan owner
2. `xomify-frontend` (Angular) — **this repo**
3. `xomify-ios` (Swift)
4. `xomify-infrastructure` (Terraform)
5. `api-gateway-service` (external Terraform module) — published from a separate GitHub repo, not locally cloned

## Status

Per-sub-feature status is tracked on **XomBoard (GitHub Project #2)** via per-repo issues. The canonical plan doc is the source of truth for design and dependencies.
