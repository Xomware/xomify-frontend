import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ToolbarComponent } from './toolbar.component';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { XomifyAuthService } from '../../services/xomify-auth.service';
import { QueueService } from '../../services/queue.service';
import { FriendsService } from '../../services/friends.service';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let userSpy: jasmine.SpyObj<UserService>;
  let xomifyAuthSpy: jasmine.SpyObj<XomifyAuthService>;
  let queueSpy: jasmine.SpyObj<QueueService>;
  let friendsSpy: jasmine.SpyObj<FriendsService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'logout']);
    userSpy = jasmine.createSpyObj('UserService', [
      'getEmail',
      'getUserName',
      'getProfilePic',
    ]);
    xomifyAuthSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);
    queueSpy = jasmine.createSpyObj('QueueService', [], {
      queueCount$: of(0),
    });
    friendsSpy = jasmine.createSpyObj(
      'FriendsService',
      ['getFriendsList'],
      { incomingCount$: of(0) },
    );

    authSpy.isLoggedIn.and.returnValue(true);
    userSpy.getEmail.and.returnValue('someone@example.com');
    userSpy.getUserName.and.returnValue('Someone');
    userSpy.getProfilePic.and.returnValue('');
    xomifyAuthSpy.getEmail.and.returnValue('someone@example.com');
    friendsSpy.getFriendsList.and.returnValue(of({} as never));

    await TestBed.configureTestingModule({
      declarations: [ToolbarComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: UserService, useValue: userSpy },
        { provide: XomifyAuthService, useValue: xomifyAuthSpy },
        { provide: QueueService, useValue: queueSpy },
        { provide: FriendsService, useValue: friendsSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  describe('nav restructure', () => {
    it('moves Shares into the Social group', () => {
      const social = component.navEntries.find(
        (e) => e.kind === 'group' && e.group.label === 'Social',
      );
      expect(social?.kind).toBe('group');
      const labels =
        social?.kind === 'group' ? social.group.links.map((l) => l.label) : [];
      expect(labels).toEqual(['Friends', 'Invites', 'Shares']);
    });

    it('moves Likes into the Music Taste group', () => {
      const musicTaste = component.navEntries.find(
        (e) => e.kind === 'group' && e.group.label === 'Music Taste',
      );
      expect(musicTaste?.kind).toBe('group');
      const labels =
        musicTaste?.kind === 'group'
          ? musicTaste.group.links.map((l) => l.label)
          : [];
      expect(labels).toEqual(['Songs', 'Artists', 'Genres', 'Likes']);
    });

    it('has no top-level Shares or Likes leaves', () => {
      const leaves = component.navEntries
        .filter((e) => e.kind === 'link')
        .map((e) => (e.kind === 'link' ? e.link.route : ''));
      expect(leaves).not.toContain('/shares');
      expect(leaves).not.toContain('/likes');
    });

    it('has no top-level Ratings leaf', () => {
      const leaves = component.navEntries
        .filter((e) => e.kind === 'link')
        .map((e) => (e.kind === 'link' ? e.link.route : ''));
      expect(leaves).not.toContain('/ratings');
    });

    it('keeps Release Radar and Wrapped as top-level leaves', () => {
      const leaves = component.navEntries
        .filter((e) => e.kind === 'link')
        .map((e) => (e.kind === 'link' ? e.link.route : ''));
      expect(leaves).toContain('/release-radar');
      expect(leaves).toContain('/wrapped');
    });
  });

  describe('avatar dropdown', () => {
    it('starts closed', () => {
      expect(component.avatarMenuOpen).toBe(false);
    });

    it('opens on toggle and closes on a second toggle', () => {
      const event = new MouseEvent('click');
      component.toggleAvatarMenu(event);
      expect(component.avatarMenuOpen).toBe(true);
      component.toggleAvatarMenu(event);
      expect(component.avatarMenuOpen).toBe(false);
    });

    it('closes on Escape', () => {
      component.avatarMenuOpen = true;
      component.handleEscape();
      expect(component.avatarMenuOpen).toBe(false);
    });

    it('closes when clicking outside the menu', () => {
      component.avatarMenuOpen = true;
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      component.handleDocumentClick({ target: outside } as unknown as MouseEvent);
      expect(component.avatarMenuOpen).toBe(false);
      outside.remove();
    });

    it('shows username from UserService and email from XomifyAuthService', () => {
      expect(component.displayName).toBe('Someone');
      expect(component.userEmail).toBe('someone@example.com');
    });

    it('renders the account menu header + items when open', () => {
      component.avatarMenuOpen = true;
      fixture.detectChanges();

      const menu = fixture.debugElement.query(By.css('.avatar-menu'));
      expect(menu).toBeTruthy();
      const text = menu.nativeElement.textContent as string;
      expect(text).toContain('Someone');
      expect(text).toContain('someone@example.com');
      expect(text).toContain('Profile');
      expect(text).toContain('My Ratings');
      expect(text).toContain('My Favorites');
      expect(text).toContain('Settings');
      expect(text).toContain('Log out');
    });

    it('does not render a separate top-bar Logout button', () => {
      const logoutBtn = fixture.debugElement.query(By.css('.logout-btn'));
      expect(logoutBtn).toBeNull();
    });
  });

  describe('isAdmin gating', () => {
    it('is false for a non-admin email', () => {
      xomifyAuthSpy.getEmail.and.returnValue('someone@example.com');
      expect(component.isAdmin).toBe(false);
    });

    it('is true for the admin email', () => {
      xomifyAuthSpy.getEmail.and.returnValue('dominickj.giordano@gmail.com');
      expect(component.isAdmin).toBe(true);
    });

    it('shows the Admin entry in the avatar menu only for the admin', () => {
      xomifyAuthSpy.getEmail.and.returnValue('dominickj.giordano@gmail.com');
      component.avatarMenuOpen = true;
      fixture.detectChanges();

      const adminLink = fixture.debugElement.query(By.css('.avatar-menu-admin'));
      expect(adminLink).toBeTruthy();
    });

    it('hides the Admin entry in the avatar menu for non-admins', () => {
      xomifyAuthSpy.getEmail.and.returnValue('someone@example.com');
      component.avatarMenuOpen = true;
      fixture.detectChanges();

      const adminLink = fixture.debugElement.query(By.css('.avatar-menu-admin'));
      expect(adminLink).toBeFalsy();
    });
  });

  describe('logout', () => {
    it('calls AuthService.logout and closes all menus', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);

      component.avatarMenuOpen = true;
      component.openGroupLabel = 'Social';
      component.dropdownVisible = true;

      component.logout();

      expect(authSpy.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
      expect(component.avatarMenuOpen).toBe(false);
      expect(component.openGroupLabel).toBeNull();
      expect(component.dropdownVisible).toBe(false);
    });
  });
});
