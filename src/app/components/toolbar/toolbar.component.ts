import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { QueueService } from '../../services/queue.service';
import { FriendsService } from '../../services/friends.service';
import { UserService } from '../../services/user.service';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

export interface NavLink {
  route: string;
  label: string;
  badge$?: 'queue' | 'friends';
}

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent implements OnInit, OnDestroy {
  dropdownVisible = false;
  isMobile = false;
  queueCount = 0;
  pendingFriendsCount = 0;

  readonly navLinks: NavLink[] = [
    { route: '/my-profile', label: 'My Profile' },
    { route: '/top-songs', label: 'Top Songs' },
    { route: '/top-artists', label: 'Top Artists' },
    { route: '/top-genres', label: 'Top Genres' },
    { route: '/release-radar', label: 'Release Radar' },
    { route: '/wrapped', label: 'Wrapped' },
    { route: '/ratings', label: 'Ratings' },
    { route: '/friends', label: 'Friends', badge$: 'friends' },
    { route: '/groups', label: 'Groups' },
    { route: '/playlist-builder', label: 'Playlist Builder', badge$: 'queue' },
    { route: '/playlist-analysis', label: 'Playlist Analysis' },
  ];

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

  getBadgeCount(link: NavLink): number {
    if (link.badge$ === 'queue') return this.queueCount;
    if (link.badge$ === 'friends') return this.pendingFriendsCount;
    return 0;
  }

  toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  selectItem(route: string): void {
    this.dropdownVisible = false;
    this.router.navigate([route]);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.dropdown-button')) {
      this.dropdownVisible = false;
    }
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  isSelected(route: string): boolean {
    return this.router.url === route;
  }

  logout(): void {
    this.authService.logout();
    this.dropdownVisible = false;
    this.router.navigate(['/home']);
  }
}
