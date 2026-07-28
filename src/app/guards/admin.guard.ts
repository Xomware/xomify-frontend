import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { XomifyAuthService } from '../services/xomify-auth.service';
import { isAdminEmail } from '../config/admin.config';

/**
 * Gates the xomify-level `/admin` route (Broadcasts authoring, WS-B) to the
 * admin (Dom) only. Reads the caller's email off the xomify JWT via
 * `XomifyAuthService.getEmail()` and compares against `ADMIN_EMAIL` —
 * synchronous, no network round-trip. `AuthGuard` runs first on this route
 * (see `app-routing.module.ts`) so a logged-out caller never reaches here;
 * anyone who isn't the admin is redirected to `/my-profile` rather than
 * shown a 403 page.
 */
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private xomifyAuth: XomifyAuthService,
    private router: Router,
  ) {}

  canActivate(): boolean | UrlTree {
    if (isAdminEmail(this.xomifyAuth.getEmail())) {
      return true;
    }
    return this.router.parseUrl('/my-profile');
  }
}
