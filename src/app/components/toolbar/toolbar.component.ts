import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { QueueService } from '../../services/queue.service';
import { FriendsService } from '../../services/friends.service';
import { UserService } from '../../services/user.service';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

/** A single navigable destination — either a leaf link or a group header. */
export interface NavLink {
  route: string;
  label: string;
  badge$?: 'queue' | 'friends';
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
  isMobile = false;
  queueCount = 0;
  pendingFriendsCount = 0;

  /** Grouped nav — empty groups are hidden in the template. */
  readonly navEntries: NavEntry[] = [
    { kind: 'link', link: { route: '/feed', label: 'Feed' } },
    { kind: 'link', link: { route: '/likes', label: 'Likes' } },
    {
      kind: 'group',
      group: {
        label: 'Music Taste',
        activeRoutes: ['/top-songs', '/top-artists', '/top-genres'],
        links: [
          { route: '/top-songs', label: 'Songs' },
          { route: '/top-artists', label: 'Artists' },
          { route: '/top-genres', label: 'Genres' },
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
        activeRoutes: ['/friends', '/invites', '/groups'],
        badge$: 'friends',
        links: [
          { route: '/friends', label: 'Friends', badge$: 'friends' },
          { route: '/invites', label: 'Invites' },
          { route: '/groups', label: 'Groups' },
        ],
      },
    },
    { kind: 'link', link: { route: '/release-radar', label: 'Release Radar' } },
    { kind: 'link', link: { route: '/wrapped', label: 'Wrapped' } },
    { kind: 'link', link: { route: '/ratings', label: 'Ratings' } },
  ];

  /** Flat list for the mobile dropdown — groups render as headers. */
  readonly mobileEntries: NavEntry[] = this.navEntries;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private queueService: QueueService,
    private friendsService: FriendsService,
    private userService: UserService
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

    if (this.authService.isLoggedIn()) {
      this.loadFriendsData();
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

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.dropdown-button')) {
      this.dropdownVisible = false;
    }
    if (!target.closest('.nav-group')) {
      this.openGroupLabel = null;
    }
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
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

  isSelected(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '?');
  }

  logout(): void {
    this.authService.logout();
    this.dropdownVisible = false;
    this.openGroupLabel = null;
    this.router.navigate(['/home']);
  }
}
