import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AX_ADMIN_DEFAULT_TAB, AX_ADMIN_TABS, AdminTab } from './models/admin-portal.model';

/**
 * The xomify-level Admin Portal (`/admin`, gated by `AdminGuard`). Reachable
 * from the user-avatar dropdown (Dom-only). A tabbed shell over six
 * sections — Overview, Health, Users, Crons, Notifications, Broadcasts —
 * plus a link out to the separately-gated Shares Admin Portal
 * (`/shares/admin`, xomtracks-backend). `docs/features/xomify-admin-portal/
 * PLAN.md`; the macOS-style restyle + Overview tab are a follow-up pass on
 * top of that.
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

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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
