import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private AuthService: AuthService, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): boolean {

    const isLoggedIn = this.AuthService.isLoggedIn(); // Adjust based on your AuthService implementation

    // If the user is not logged in, send them to Home (`/`), which is the
    // guard-free landing page and works for both logged-in and logged-out
    // visitors.
    if (!isLoggedIn && state.url !== '/') {
      this.router.navigate(['/']);
      return false; // Prevent navigation to the route
    }

    return true; // Allow access to the route
  }
}
