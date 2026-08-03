import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { XomtracksSetupCardComponent } from './xomtracks-setup-card.component';
import { XomtracksIngestTokensService } from '../../services/xomtracks-ingest-tokens.service';
import { XomifyAuthService } from '../../../../services/xomify-auth.service';
import { ImpersonationService } from '../../../../services/impersonation.service';
import { ADMIN_EMAIL } from '../../config/xomtracks-admin';

describe('XomtracksSetupCardComponent', () => {
  let fixture: ComponentFixture<XomtracksSetupCardComponent>;
  let component: XomtracksSetupCardComponent;
  let authSpy: jasmine.SpyObj<XomifyAuthService>;
  let tokensSpy: jasmine.SpyObj<XomtracksIngestTokensService>;
  // Stub avoids pulling the real ImpersonationService (and its HttpClient dep)
  // into the standalone component's injector. Defaults to "not impersonating";
  // individual specs flip `isImpersonating` where they exercise that path.
  let impersonationStub: { isImpersonating: boolean };

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);
    tokensSpy = jasmine.createSpyObj('XomtracksIngestTokensService', ['create', 'revoke']);
    impersonationStub = { isImpersonating: false };

    await TestBed.configureTestingModule({
      imports: [XomtracksSetupCardComponent],
      providers: [
        { provide: XomifyAuthService, useValue: authSpy },
        { provide: XomtracksIngestTokensService, useValue: tokensSpy },
        { provide: ImpersonationService, useValue: impersonationStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(XomtracksSetupCardComponent);
    component = fixture.componentInstance;
  });

  it('hides the card for the admin account by default', () => {
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
    fixture.detectChanges();
    expect(component.isAdmin).toBe(true);
    expect(fixture.nativeElement.querySelector('.xt-setup')).toBeNull();
  });

  it('shows the card for a non-admin account', () => {
    authSpy.getEmail.and.returnValue('someone@example.com');
    fixture.detectChanges();
    expect(component.isAdmin).toBe(false);
    expect(fixture.nativeElement.querySelector('.xt-setup')).not.toBeNull();
  });

  it('shows the card while the admin is impersonating a non-admin target', () => {
    // JWT email is still the admin's during impersonation, but the effective
    // user is the (non-admin) target, who can opt in — so the card must show.
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
    impersonationStub.isImpersonating = true;
    fixture.detectChanges();
    expect(component.isAdmin).toBe(false);
    expect(fixture.nativeElement.querySelector('.xt-setup')).not.toBeNull();
  });

  it('forcePreview renders the card even for the admin account', () => {
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
    component.forcePreview = true;
    fixture.detectChanges();
    expect(component.isAdmin).toBe(false);
    expect(fixture.nativeElement.querySelector('.xt-setup')).not.toBeNull();
  });

  it('forcePreview starts pre-expanded instead of the default collapsed state', () => {
    authSpy.getEmail.and.returnValue('someone@example.com');
    component.forcePreview = true;
    fixture.detectChanges();
    expect(component.expanded).toBe(true);
  });

  it('does not auto-expand in normal (non-preview) mode', () => {
    authSpy.getEmail.and.returnValue('someone@example.com');
    fixture.detectChanges();
    expect(component.expanded).toBe(false);
  });

  it('mint() calls the real ingest-tokens service even in preview mode', () => {
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
    tokensSpy.create.and.returnValue(
      of({ token: 'plaintext-token', tokenHash: 'hash1', ownerId: 'admin-user-id', createdAt: '2026-08-03T00:00:00Z', label: null }),
    );
    component.forcePreview = true;
    fixture.detectChanges();

    component.mint();

    expect(tokensSpy.create).toHaveBeenCalled();
    expect(component.state).toBe('minted');
    expect(component.plaintextToken).toBe('plaintext-token');
  });
});
