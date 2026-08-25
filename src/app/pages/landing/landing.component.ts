import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import {
  LinkEntry,
  XOMIFY_DOCS,
  XOMIFY_IOS,
  XOMIFY_REPOS,
} from 'src/app/data/xomware-apps.data';

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
  /**
   * Index of the act currently in view, fed to each preview's `active` input.
   * Previews stay mounted for the life of the page (the journey cross-fades
   * rather than destroys), so this is what tells one to play.
   */
  activeAct = 0;

  /** Sourced from the registry, not hardcoded — A2 left this slot empty on
   * purpose so the TestFlight URL lives in exactly one place. */
  readonly iosApp = XOMIFY_IOS;
  readonly repos: readonly LinkEntry[] = XOMIFY_REPOS;
  readonly docs: readonly LinkEntry[] = XOMIFY_DOCS;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  onActChange(index: number): void {
    this.activeAct = index;
    this.cdr.markForCheck();
  }

  login(): void {
    this.authService.login();
  }
}
