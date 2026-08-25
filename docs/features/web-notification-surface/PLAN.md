# Plan: web-notification-surface

**Epic**: [xomify-relaunch](../xomify-relaunch/PLAN.md)
**Sub-feature ID**: B7 (`web-notification-surface`)
**Track**: B — Notifications Platform
**Status**: Draft
**Created**: 2026-08-24
**Last updated**: 2026-08-24
**Scope size**: TBD — run `/plan web-notification-surface` to size
**Repo(s) touched**: `xomify-frontend`
**Branch**: `feature/web-notification-surface`
**Wave**: 4
**Depends on**: `B2`, `B3`

---

## Summary

Rebuild web notification settings against the per-type model and add a web inbox with unread badge.

## Approach

The existing page (102 TS / 126 HTML) covers only the old two-flag model. Rebuild as three sections with per-type rows. Add an inbox view backed by GET /notifications plus an unread badge in the toolbar.

## Affected Files / Components

- `src/app/pages/notification-settings/`
- `src/app/components/toolbar/`
- `src/app/services/notifications.service.ts (new)`

## Implementation Steps

_Stub — not yet planned. Run `/plan web-notification-surface` to expand this into ordered, checkable steps._

- [ ] TBD

## Acceptance

_Stub — define with `/plan web-notification-surface`._

---

## Epic context

Locked decisions live in the epic plan and must not be re-litigated here. See
`../xomify-relaunch/PLAN.md` — decisions table, rows 1-11.
