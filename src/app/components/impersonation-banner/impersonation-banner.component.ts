import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ImpersonationService } from '../../services/impersonation.service';

/**
 * Persistent, warning-colored bar rendered at the very top of the app shell
 * (above `app-toolbar` — see `app.component.html`) any time
 * `ImpersonationService.isImpersonating$` is true. Visible on every page,
 * survives navigation and refresh (the service persists the target to
 * localStorage).
 *
 * Its visibility drives `--impersonation-banner-h` on `.app-container`
 * (see `app.component.scss`), which both `app-toolbar` and `.content` read
 * to shift down and stay clear of the fixed toolbar — see those files for
 * the mechanism.
 */
@Component({
  selector: 'app-impersonation-banner',
  templateUrl: './impersonation-banner.component.html',
  styleUrls: ['./impersonation-banner.component.scss'],
})
export class ImpersonationBannerComponent {
  readonly impersonatedEmail$: Observable<string | null>;

  constructor(
    private impersonation: ImpersonationService,
    private router: Router,
  ) {
    this.impersonatedEmail$ = this.impersonation.impersonatedEmail$;
  }

  exit(): void {
    this.impersonation.exit();
    this.router.navigateByUrl('/admin');
  }
}
