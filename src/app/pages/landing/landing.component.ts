import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';

/**
 * The signed-out landing page.
 *
 * Replaces the login card that `HomeComponent` used to render for visitors who
 * were not logged in. Someone arriving from a link has no idea what Xomify is;
 * a lone "Connect with Spotify" button asks them to hand over their Spotify
 * account before telling them why. The journey shows the product first.
 *
 * `HomeComponent` still owns the signed-IN dashboard — that branch is untouched.
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  constructor(private authService: AuthService) {}

  login(): void {
    this.authService.login();
  }
}
