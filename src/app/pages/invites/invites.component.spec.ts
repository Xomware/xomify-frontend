import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { InvitesComponent } from './invites.component';
import {
  AcceptInviteResponse,
  CreateInviteResponse,
  Invite,
  InvitesService,
  PendingInvitesResponse,
} from 'src/app/services/invites.service';
import { ShareService } from 'src/app/services/share.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

describe('InvitesComponent', () => {
  let component: InvitesComponent;
  let fixture: ComponentFixture<InvitesComponent>;
  let invites: jasmine.SpyObj<InvitesService>;
  let share: jasmine.SpyObj<ShareService>;
  let toast: jasmine.SpyObj<ToastService>;
  let pendingSubject: BehaviorSubject<Invite[]>;

  const mkInvite = (code: string): Invite => ({
    inviteCode: code,
    senderEmail: 'dom@example.com',
    createdAt: '2026-04-23T10:00:00Z',
    expiresAt: '2026-05-23T10:00:00Z',
    inviteUrl: `https://xomify.app/invite/${code}`,
  });

  beforeEach(async () => {
    pendingSubject = new BehaviorSubject<Invite[]>([]);

    const invitesSpy = jasmine.createSpyObj(
      'InvitesService',
      ['listPending', 'createInvite', 'acceptInvite', 'hideLocally'],
      { pendingInvites$: pendingSubject.asObservable() },
    );
    const shareSpy = jasmine.createSpyObj('ShareService', [
      'copyToClipboard',
      'share',
    ]);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    const userSpy = jasmine.createSpyObj('UserService', ['getEmail']);

    userSpy.getEmail.and.returnValue('dom@example.com');
    shareSpy.copyToClipboard.and.resolveTo(true);
    shareSpy.share.and.resolveTo(true);

    await TestBed.configureTestingModule({
      declarations: [InvitesComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: InvitesService, useValue: invitesSpy },
        { provide: ShareService, useValue: shareSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: UserService, useValue: userSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    invites = TestBed.inject(InvitesService) as jasmine.SpyObj<InvitesService>;
    share = TestBed.inject(ShareService) as jasmine.SpyObj<ShareService>;
    toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;

    fixture = TestBed.createComponent(InvitesComponent);
    component = fixture.componentInstance;
  });

  it('loads pending invites on init and mirrors the service cache', () => {
    const resp: PendingInvitesResponse = {
      email: 'dom@example.com',
      count: 2,
      invites: [mkInvite('A'), mkInvite('B')],
    };
    invites.listPending.and.returnValue(of(resp));

    fixture.detectChanges();

    expect(invites.listPending).toHaveBeenCalledWith('dom@example.com');
    expect(component.loading).toBe(false);

    // Simulate the service pushing cache updates.
    pendingSubject.next(resp.invites);
    expect(component.invites.length).toBe(2);
  });

  it('sets an error message when the load fails', () => {
    invites.listPending.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect(component.error).toBeTruthy();
    expect(component.loading).toBe(false);
  });

  it('createInvite stores the response and triggers share', async () => {
    invites.listPending.and.returnValue(
      of({ email: 'dom@example.com', count: 0, invites: [] }),
    );
    fixture.detectChanges();

    const mockResp: CreateInviteResponse = {
      inviteCode: 'NEW-1',
      inviteUrl: 'https://xomify.app/invite/NEW-1',
      createdAt: '2026-04-23T10:00:00Z',
      expiresAt: '2026-05-23T10:00:00Z',
    };
    invites.createInvite.and.returnValue(of(mockResp));

    component.createInvite();
    await fixture.whenStable();

    expect(invites.createInvite).toHaveBeenCalledWith('dom@example.com');
    expect(component.lastCreated).toEqual(mockResp);
    expect(component.creating).toBe(false);
    expect(share.share).toHaveBeenCalled();
  });

  it('copyLink copies invite URL to clipboard and toasts success', async () => {
    invites.listPending.and.returnValue(
      of({ email: 'dom@example.com', count: 0, invites: [] }),
    );
    fixture.detectChanges();

    const invite = mkInvite('CODE-1');
    await component.copyLink(invite);

    expect(share.copyToClipboard).toHaveBeenCalledWith(invite.inviteUrl as string);
    expect(toast.showPositiveToast).toHaveBeenCalled();
  });

  it('revokeLocally calls hideLocally on the service and toasts', () => {
    invites.listPending.and.returnValue(
      of({ email: 'dom@example.com', count: 0, invites: [] }),
    );
    fixture.detectChanges();

    const invite = mkInvite('REV-1');
    component.revokeLocally(invite);

    expect(invites.hideLocally).toHaveBeenCalledWith('REV-1');
    expect(toast.showPositiveToast).toHaveBeenCalled();
  });

  it('acceptInvite navigates to /friend/:senderEmail on success', () => {
    invites.listPending.and.returnValue(
      of({ email: 'dom@example.com', count: 0, invites: [] }),
    );
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');

    const mockResp: AcceptInviteResponse = {
      ok: true,
      senderEmail: 'friend@example.com',
      inviteCode: 'FRND-1',
    };
    invites.acceptInvite.and.returnValue(of(mockResp));

    component.acceptCodeInput = 'FRND-1';
    component.acceptInvite();

    expect(invites.acceptInvite).toHaveBeenCalledWith(
      'dom@example.com',
      'FRND-1',
    );
    expect(navSpy).toHaveBeenCalledWith(['/friend', 'friend@example.com']);
    expect(component.acceptCodeInput).toBe('');
  });

  it('acceptInvite toasts error when backend rejects the code', () => {
    invites.listPending.and.returnValue(
      of({ email: 'dom@example.com', count: 0, invites: [] }),
    );
    fixture.detectChanges();

    invites.acceptInvite.and.returnValue(
      throwError(() => ({ error: { message: 'invalid code' } })),
    );

    component.acceptCodeInput = 'BAD';
    component.acceptInvite();

    expect(toast.showNegativeToast).toHaveBeenCalledWith('invalid code');
    expect(component.accepting).toBe(false);
  });

  it('acceptInvite rejects empty input without hitting the service', () => {
    invites.listPending.and.returnValue(
      of({ email: 'dom@example.com', count: 0, invites: [] }),
    );
    fixture.detectChanges();

    component.acceptCodeInput = '  ';
    component.acceptInvite();

    expect(invites.acceptInvite).not.toHaveBeenCalled();
    expect(toast.showNegativeToast).toHaveBeenCalled();
  });
});
