import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AX_ADMIN_DEFAULT_TAB, AX_ADMIN_TABS, AdminTab } from './models/admin-portal.model';
import { ImpersonationService } from '../../services/impersonation.service';

/**
 * The xomify-level Admin Portal (`/admin`, gated by `AdminGuard`). Reachable
 * from the user-avatar dropdown (Dom-only). A tabbed shell over seven
 * sections — Overview, Health, Users, View As, Crons, Notifications,
 * Broadcasts — plus a link out to the separately-gated Shares Admin Portal
 * (`/shares/admin`, xomtracks-backend). `docs/features/xomify-admin-portal/
 * PLAN.md`; the macOS-style restyle + Overview tab are a follow-up pass on
 * top of that. View As restores the impersonation feature dropped by that
 * restyle, promoted from an inline Users-panel drawer to its own tab.
 *
 * Only the active tab's panel is mounted (`*ngSwitch`), so each panel owns
 * its own load/error/empty state independently and nothing fetches until
 * its tab is first opened. The active tab is deep-linkable via `?tab=` and
 * the nav implements the WAI-ARIA APG tablist roving-tabindex keyboard
 * pattern (Left/Right/Home/End moves focus and activates) — same pattern
 * whether it renders as the desktop sidebar or the mobile top scroller.
 */
@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChildren('tabBtn') private tabButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly tabs = AX_ADMIN_TABS;

  activeTab: AdminTab = AX_ADMIN_DEFAULT_TAB;

  /** Set when the Users panel's "View as" row action fires; consumed once by
   * the View As panel's `presetEmail` input on mount. */
  viewAsPresetEmail: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private impersonation: ImpersonationService,
  ) {}

  ngOnInit(): void {
    // Drive tab selection from the URL so /admin?tab=users is a deep link.
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const tab = params.get('tab') as AdminTab | null;
      this.activeTab = this.tabs.some((t) => t.value === tab) ? (tab as AdminTab) : AX_ADMIN_DEFAULT_TAB;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: AdminTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === AX_ADMIN_DEFAULT_TAB ? {} : { tab },
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  /** "View as" from the Users panel: jump to the View As tab pre-loaded for that user. */
  viewAs(email: string): void {
    this.viewAsPresetEmail = email;
    this.setTab('viewas');
  }

  /**
   * "Step through app as this user" — fired from either the Users panel's
   * row action or the View As panel's button. Starts full impersonation
   * (`ImpersonationService.enter`, admin-only/no-op otherwise) and navigates
   * out of the Admin Portal into the app itself, where the persistent
   * banner takes over.
   */
  stepThroughAs(email: string): void {
    this.impersonation.enter(email);
    this.router.navigateByUrl('/');
  }

  /** WAI-ARIA APG tablist keyboard pattern: Left/Right/Up/Down cycle,
   * Home/End jump to the ends. Activates on arrow (automatic activation)
   * and moves DOM focus to the newly-active tab button. */
  onTabKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs.length;
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + count) % count;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.setTab(this.tabs[nextIndex].value);
    this.tabButtons?.toArray()[nextIndex]?.nativeElement.focus();
  }
}
