import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { QueueService } from '../../services/queue.service';
import { FriendsService } from '../../services/friends.service';
import { UserService } from '../../services/user.service';
import { XomifyAuthService } from '../../services/xomify-auth.service';
import { isAdminEmail } from '../../config/admin.config';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { NotificationsService } from 'src/app/services/notifications.service';
import { XOMIFY_IOS } from 'src/app/data/xomware-apps.data';

/** A single navigable destination — either a leaf link or a group header. */
export interface NavLink {
  route: string;
  label: string;
  badge$?: 'queue' | 'friends';
  /** Only highlight on an exact URL match — used for `/` (Home), which
   * would otherwise match every route as a routerLinkActive prefix. */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  /** Routes considered "active" when this group's dropdown button should highlight. */
  activeRoutes: string[];
  links: NavLink[];
  /** Aggregate badges across child links — sum of matching badge counts. */
  badge$?: 'queue' | 'friends';
}

export type NavEntry =
  | { kind: 'link'; link: NavLink }
  | { kind: 'group'; group: NavGroup };

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent implements OnInit, OnDestroy {
  /** Mobile hamburger menu. */
  dropdownVisible = false;
  /** Desktop group dropdowns — keyed by group label; only one open at a time. */
  openGroupLabel: string | null = null;
  /** Top-right user-avatar dropdown (username/email header + Profile, My
   * Ratings, My Favorites, Settings, Log out, and — admin only — Admin). */
  avatarMenuOpen = false;
  isMobile = false;
  queueCount = 0;
  pendingFriendsCount = 0;
  unreadNotifications = 0;

  /** Landing-page CTA target. Sourced, never hardcoded twice. */
  readonly iosApp = XOMIFY_IOS;

  /**
   * Landing sections, shown in the toolbar for signed-out visitors on `/`.
   *
   * They live HERE rather than in a second header inside the landing page: the
   * app already renders a fixed toolbar on every route, so a landing-only bar
   * underneath it was simply two stacked headers.
   */
  readonly landingSections = [
    { id: 'overview', label: 'Overview' },
    { id: 'how', label: 'How it works' },
    { id: 'docs', label: 'Docs' },
  ];

  /** Grouped nav — empty groups are hidden in the template. */
  readonly navEntries: NavEntry[] = [
    { kind: 'link', link: { route: '/', label: 'Home', exact: true } },
    {
      kind: 'group',
      group: {
        label: 'Music Taste',
        activeRoutes: ['/top-songs', '/top-artists', '/top-genres', '/likes'],
        links: [
          { route: '/top-songs', label: 'Songs' },
          { route: '/top-artists', label: 'Artists' },
          { route: '/top-genres', label: 'Genres' },
          { route: '/likes', label: 'Likes' },
        ],
      },
    },
    {
      kind: 'group',
      group: {
        label: 'Playlists',
        activeRoutes: [
          '/my-playlists',
          '/playlist-builder',
          '/playlist-analysis',
          '/mood-recommendations',
        ],
        badge$: 'queue',
        links: [
          { route: '/my-playlists', label: 'My Playlists' },
          { route: '/playlist-builder', label: 'Builder', badge$: 'queue' },
          { route: '/playlist-analysis', label: 'Analysis' },
          { route: '/mood-recommendations', label: 'Mood Picks' },
        ],
      },
    },
    {
      kind: 'group',
      group: {
        label: 'Social',
        activeRoutes: ['/friends', '/invites', '/shares'],
        badge$: 'friends',
        links: [
          { route: '/friends', label: 'Friends', badge$: 'friends' },
          { route: '/invites', label: 'Invites' },
          { route: '/shares', label: 'Shares' },
        ],
      },
    },
    { kind: 'link', link: { route: '/release-radar', label: 'Release Radar' } },
    { kind: 'link', link: { route: '/wrapped', label: 'Wrapped' } },
  ];

  /** Flat list for the mobile dropdown — groups render as headers. */
  readonly mobileEntries: NavEntry[] = this.navEntries;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private queueService: QueueService,
    private friendsService: FriendsService,
    private userService: UserService,
    private xomifyAuthService: XomifyAuthService,
    private notificationsService: NotificationsService,
  ) {
    this.checkIfMobile();
    window.addEventListener('resize', this.checkIfMobile.bind(this));
  }

  ngOnInit(): void {
    this.queueService.queueCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.queueCount = count;
      });

    this.friendsService.incomingCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.pendingFriendsCount = count;
      });

    this.notificationsService.unread$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.unreadNotifications = count;
      });

    if (this.authService.isLoggedIn()) {
      this.loadFriendsData();
      // One fetch on mount. Deliberately NOT polled: the badge is a nicety,
      // and a timer firing against the API for the whole session costs more
      // than it's worth. The inbox refreshes it on open, and marking items
      // read updates it locally through the same subject.
      this.notificationsService.refreshUnreadCount().subscribe();
    }
  }

  loadFriendsData(): void {
    const email = this.userService.getEmail();
    if (email) {
      this.friendsService.getFriendsList(email).pipe(take(1)).subscribe();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Used by the template's `*ngFor`-friendly pattern matching helpers. */
  asLink(entry: NavEntry): NavLink | null {
    return entry.kind === 'link' ? entry.link : null;
  }

  asGroup(entry: NavEntry): NavGroup | null {
    return entry.kind === 'group' ? entry.group : null;
  }

  getBadgeCount(source: NavLink | NavGroup | undefined): number {
    if (!source?.badge$) return 0;
    if (source.badge$ === 'queue') return this.queueCount;
    if (source.badge$ === 'friends') return this.pendingFriendsCount;
    return 0;
  }

  isGroupActive(group: NavGroup): boolean {
    return group.activeRoutes.some((r) => this.router.url.startsWith(r));
  }

  toggleGroup(label: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openGroupLabel = this.openGroupLabel === label ? null : label;
  }

  closeGroups(): void {
    this.openGroupLabel = null;
  }

  toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  selectItem(route: string): void {
    this.dropdownVisible = false;
    this.openGroupLabel = null;
    this.router.navigate([route]);
  }

  toggleAvatarMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.avatarMenuOpen = !this.avatarMenuOpen;
  }

  closeAvatarMenu(): void {
    this.avatarMenuOpen = false;
  }

  /** Avatar menu item click — close the menu, let routerLink handle nav. */
  selectAvatarItem(): void {
    this.avatarMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.dropdown-button')) {
      this.dropdownVisible = false;
    }
    if (!target.closest('.nav-group')) {
      this.openGroupLabel = null;
    }
    if (!target.closest('.avatar-menu-wrap')) {
      this.avatarMenuOpen = false;
    }
  }

  /** Esc closes whichever menu is open — group dropdown, avatar dropdown,
   * or the mobile nav. */
  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.openGroupLabel = null;
    this.avatarMenuOpen = false;
    this.dropdownVisible = false;
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  /** True only for a signed-out visitor on the landing route. */
  isLanding(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return (path === '/' || path === '') && !this.isLoggedIn();
  }

  login(): void {
    this.authService.login();
  }

  /**
   * Scroll to a landing section.
   *
   * The toolbar reaches into the landing page's DOM by id, which is a liberty —
   * but the alternative is a shared scroll service for three anchors on one
   * route, and these buttons only exist while that route is showing.
   */
  scrollToSection(id: string): void {
    const target = document.getElementById(id);
    if (!target) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  /**
   * Avatar URL for the top-right chip. Falls back to the bundled default when
   * the Spotify profile hasn't been hydrated yet (UserService.user is null
   * pre-bootstrap). Template binds the fallback path itself so this getter
   * returns an empty string in that case.
   */
  get profilePicture(): string {
    return this.userService.getProfilePic();
  }

  /** Username shown in the avatar dropdown header. */
  get displayName(): string {
    return this.userService.getUserName() || 'Xomify user';
  }

  /**
   * Email shown in the avatar dropdown header. Prefers the xomify JWT's
   * `email` claim (the identity xomify's own backend — and the admin gate —
   * actually authorizes against); falls back to the Spotify profile email if
   * the JWT hasn't minted yet.
   */
  get userEmail(): string {
    return this.xomifyAuthService.getEmail() || this.userService.getEmail() || '';
  }

  /**
   * True only for the admin (Dom). Client-side check against `ADMIN_EMAIL`
   * — gates the "Admin" avatar-dropdown entry only; the `/admin` route
   * itself is independently enforced by `AdminGuard`.
   */
  get isAdmin(): boolean {
    return isAdminEmail(this.xomifyAuthService.getEmail());
  }

  isSelected(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '?');
  }

  logout(): void {
    this.authService.logout();
    this.dropdownVisible = false;
    this.openGroupLabel = null;
    this.avatarMenuOpen = false;
    this.router.navigate(['/home']);
  }
}
