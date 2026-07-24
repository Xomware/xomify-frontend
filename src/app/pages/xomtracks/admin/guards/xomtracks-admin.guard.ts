import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { XomtracksMeService } from '../../services/xomtracks-me.service';

/**
 * Gates `/xomtracks/admin` to the admin (Dom) only. Reads the
 * server-authoritative `isAdmin` flag from `GET /me/get` (never the JWT
 * client-side) — anything else (non-admin, or the `/me/get` call itself
 * failing) redirects to the Shares feed rather than rendering a 403 page.
 *
 * `AuthGuard` already gates the parent `/xomtracks` route, so by the time
 * this guard runs the caller is guaranteed to be logged in.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksAdminGuard implements CanActivate {
  constructor(
    private me: XomtracksMeService,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.me.get().pipe(
      map((me) => (me.isAdmin ? true : this.router.parseUrl('/xomtracks'))),
      catchError(() => of(this.router.parseUrl('/xomtracks'))),
    );
  }
}
