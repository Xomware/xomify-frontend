// impersonation.service.ts
//
// Full-app "step through as" impersonation mode for the admin (Dom) —
// distinct from the Admin Portal's read-only "View As" projection
// (`AdminViewasPanelComponent`, `GET /admin/view-as`), which only ever
// renders a static snapshot inside the Admin Portal itself. This service
// backs actually navigating the whole app AS the target user.
//
// State (the impersonated email) is persisted to localStorage so it survives
// route navigation and a full page refresh — the admin should be able to
// click around `/shares`, refresh, and still be impersonating. It is cleared
// on `exit()` and is defensively re-validated against the current caller's
// admin status on every read (see `readPersistedEmail`), so a stale value
// can never silently leak into a session where the signed-in caller isn't
// the admin (e.g. a different account on the same browser/profile).
//
// Consumers:
//   - `AuthInterceptor` reads `impersonatedEmail` synchronously to append
//     `?impersonate=<email>` to Xomtracks/Shares calls only.
//   - `ImpersonationBannerComponent` (app shell) subscribes to
//     `isImpersonating$` / `impersonatedEmail$` to render the persistent
//     warning banner and drive the `--impersonation-banner-h` layout offset.
//   - The Admin Portal's Users panel and View As panel call `enter()` to
//     start impersonating a given user.

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { XomifyAuthService } from './xomify-auth.service';
import { isAdminEmail } from '../config/admin.config';

/** localStorage key for the persisted impersonated email. */
const STORAGE_KEY = 'xomify.impersonation.email';

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly emailSubject = new BehaviorSubject<string | null>(null);

  /** The currently-impersonated target email, or `null` when not impersonating. */
  readonly impersonatedEmail$: Observable<string | null> = this.emailSubject.asObservable();

  /** Derived convenience stream — `true` any time an impersonation target is set. */
  readonly isImpersonating$: Observable<boolean> = this.impersonatedEmail$.pipe(
    map((email) => !!email),
  );

  constructor(private xomifyAuth: XomifyAuthService) {
    this.emailSubject.next(this.readPersistedEmail());
  }

  /** Synchronous read for callers that can't subscribe (e.g. the interceptor,
   * which runs on the hot HTTP path for every request). */
  get impersonatedEmail(): string | null {
    return this.emailSubject.value;
  }

  get isImpersonating(): boolean {
    return !!this.emailSubject.value;
  }

  /**
   * Admin-only: begin stepping through the entire app as `email`. No-ops (and
   * clears any pre-existing state) if the current caller isn't the admin —
   * callers should still gate the entry point itself (nav link, button) on
   * admin status; this is the belt-and-suspenders backstop.
   */
  enter(email: string): void {
    if (!this.isAdmin()) {
      this.exit();
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    this.persistEmail(normalized);
    this.emailSubject.next(normalized);
  }

  /** Clears impersonation state, locally and in localStorage. */
  exit(): void {
    this.persistEmail(null);
    this.emailSubject.next(null);
  }

  private isAdmin(): boolean {
    return isAdminEmail(this.xomifyAuth.getEmail());
  }

  private readPersistedEmail(): string | null {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage can throw in private-mode/embedded webviews — treat as
      // "not impersonating".
      return null;
    }
    if (!stored) {
      return null;
    }
    if (!this.isAdmin()) {
      // Defensive: don't let a stale impersonation email survive into a
      // session where the signed-in caller isn't the admin.
      this.persistEmail(null);
      return null;
    }
    return stored;
  }

  private persistEmail(email: string | null): void {
    try {
      if (email) {
        localStorage.setItem(STORAGE_KEY, email);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Best-effort — private-mode/embedded webviews can throw.
    }
  }
}
