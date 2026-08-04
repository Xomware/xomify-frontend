import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { XomtracksSetupCardComponent } from './xomtracks-setup-card.component';
import {
  XomtracksIngestTokensService,
  XtIngestDevice,
} from '../../services/xomtracks-ingest-tokens.service';
import { XomtracksMeService } from '../../services/xomtracks-me.service';
import { XtMeResponse } from '../../models/xomtracks-admin.model';
import { XomifyAuthService } from '../../../../services/xomify-auth.service';
import { ImpersonationService } from '../../../../services/impersonation.service';
import { ADMIN_EMAIL } from '../../config/xomtracks-admin';

function makeMe(overrides: Partial<XtMeResponse> = {}): XtMeResponse {
  return {
    email: 'friend@example.com',
    linkStatus: 'none',
    linked: false,
    linkedHandles: [],
    shareCount: 0,
    spotifyConnected: false,
    spotifyUserId: null,
    isAdmin: false,
    ownIngest: false,
    lastScanAt: null,
    ...overrides,
  };
}

describe('XomtracksSetupCardComponent', () => {
  let fixture: ComponentFixture<XomtracksSetupCardComponent>;
  let component: XomtracksSetupCardComponent;
  let authSpy: jasmine.SpyObj<XomifyAuthService>;
  let tokensSpy: jasmine.SpyObj<XomtracksIngestTokensService>;
  let meSpy: jasmine.SpyObj<XomtracksMeService>;
  let impersonationStub: { isImpersonating: boolean };

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);
    authSpy.getEmail.and.returnValue('friend@example.com');
    tokensSpy = jasmine.createSpyObj('XomtracksIngestTokensService', ['create', 'revoke', 'list']);
    tokensSpy.list.and.returnValue(of([]));
    meSpy = jasmine.createSpyObj('XomtracksMeService', ['get', 'refresh']);
    meSpy.get.and.returnValue(of(makeMe()));
    impersonationStub = { isImpersonating: false };

    await TestBed.configureTestingModule({
      imports: [XomtracksSetupCardComponent],
      providers: [
        { provide: XomifyAuthService, useValue: authSpy },
        { provide: XomtracksIngestTokensService, useValue: tokensSpy },
        { provide: XomtracksMeService, useValue: meSpy },
        { provide: ImpersonationService, useValue: impersonationStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(XomtracksSetupCardComponent);
    component = fixture.componentInstance;
  });

  it('hides the panel for the real admin on their own feed (no me fetch)', () => {
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
    fixture.detectChanges();
    expect(component.isAdmin).toBe(true);
    expect(meSpy.get).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.xt-setup')).toBeNull();
  });

  it('shows the SETUP phase for a not-connected user', () => {
    meSpy.get.and.returnValue(of(makeMe({ ownIngest: false })));
    fixture.detectChanges();
    expect(component.phase).toBe('setup');
    expect(fixture.nativeElement.querySelector('.xt-phase-setup')).not.toBeNull();
  });

  it('shows the CONNECTED phase (with device list) when ownIngest is true', () => {
    meSpy.get.and.returnValue(of(makeMe({ ownIngest: true, shareCount: 12, lastScanAt: '2026-08-04T00:00:00Z' })));
    const devices: XtIngestDevice[] = [
      { tokenHash: 'h1', label: 'MacBook Pro', createdAt: '2026-08-01T00:00:00Z', lastScanAt: '2026-08-04T00:00:00Z' },
    ];
    tokensSpy.list.and.returnValue(of(devices));

    fixture.detectChanges();

    expect(component.phase).toBe('connected');
    expect(component.shareCount).toBe(12);
    expect(component.devices.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.xt-phase-connected')).not.toBeNull();
  });

  it('revoke() calls the service with the device hash and drops it from the list', () => {
    meSpy.get.and.returnValue(of(makeMe({ ownIngest: true })));
    const devices: XtIngestDevice[] = [
      { tokenHash: 'h1', label: 'A', createdAt: null, lastScanAt: null },
      { tokenHash: 'h2', label: 'B', createdAt: null, lastScanAt: null },
    ];
    // Initial load returns both; after revoke, loadConnection re-fetches the
    // authoritative (now shorter) list from the server.
    tokensSpy.list.and.returnValues(of(devices), of([devices[1]]));
    tokensSpy.revoke.and.returnValue(of({ revoked: true, tokenHash: 'h1' }));
    fixture.detectChanges();

    component.revoke(devices[0]);

    expect(tokensSpy.revoke).toHaveBeenCalledWith('h1');
    expect(component.devices.map((d) => d.tokenHash)).toEqual(['h2']);
  });

  it('shows the panel while impersonating and disables revoke (read-only)', () => {
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL); // JWT is still the admin's
    impersonationStub.isImpersonating = true;
    meSpy.get.and.returnValue(of(makeMe({ ownIngest: true })));
    tokensSpy.list.and.returnValue(of([{ tokenHash: 'h1', label: 'X', createdAt: null, lastScanAt: null }]));
    fixture.detectChanges();

    expect(component.isAdmin).toBe(false);
    expect(component.readOnly).toBe(true);
    // A revoke attempt no-ops under impersonation.
    component.revoke({ tokenHash: 'h1', label: 'X', createdAt: null, lastScanAt: null });
    expect(tokensSpy.revoke).not.toHaveBeenCalled();
  });

  it('forcePreview renders the setup flow without fetching /me/get', () => {
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
    component.forcePreview = true;
    fixture.detectChanges();
    expect(component.isAdmin).toBe(false);
    expect(component.phase).toBe('setup');
    expect(meSpy.get).not.toHaveBeenCalled();
  });

  it('mint() reveals the one-time token (minted phase)', () => {
    meSpy.get.and.returnValue(of(makeMe({ ownIngest: false })));
    tokensSpy.create.and.returnValue(
      of({ token: 'xti_secret', tokenHash: 'h9', ownerId: 'o', createdAt: 'x', label: null }),
    );
    fixture.detectChanges();

    component.mint();

    expect(tokensSpy.create).toHaveBeenCalled();
    expect(component.phase).toBe('minted');
    expect(component.plaintextToken).toBe('xti_secret');
  });

  it('polls until the first scan lands, then stops (waiting → scanned)', fakeAsync(() => {
    // Connected but no scan yet -> should poll; second /me/get has a scan.
    meSpy.get.and.returnValues(
      of(makeMe({ ownIngest: true, lastScanAt: null })),
      of(makeMe({ ownIngest: true, lastScanAt: '2026-08-04T00:00:05Z', shareCount: 3 })),
      of(makeMe({ ownIngest: true, lastScanAt: '2026-08-04T00:00:05Z', shareCount: 3 })),
    );
    fixture.detectChanges();
    expect(component.lastScanAt).toBeNull();

    tick(15_000); // first poll
    expect(component.lastScanAt).toBe('2026-08-04T00:00:05Z');
    expect(component.shareCount).toBe(3);

    tick(15_000); // no further poll — takeWhile completed
    expect(meSpy.get).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
  }));
});
