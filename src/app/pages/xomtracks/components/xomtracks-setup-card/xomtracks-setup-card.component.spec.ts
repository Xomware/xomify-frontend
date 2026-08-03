import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { XomtracksSetupCardComponent } from './xomtracks-setup-card.component';
import { XomtracksIngestTokensService } from '../../services/xomtracks-ingest-tokens.service';
import { XomifyAuthService } from '../../../../services/xomify-auth.service';
import { ADMIN_EMAIL } from '../../config/xomtracks-admin';

describe('XomtracksSetupCardComponent', () => {
  let fixture: ComponentFixture<XomtracksSetupCardComponent>;
  let component: XomtracksSetupCardComponent;
  let authSpy: jasmine.SpyObj<XomifyAuthService>;
  let tokensSpy: jasmine.SpyObj<XomtracksIngestTokensService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);
    tokensSpy = jasmine.createSpyObj('XomtracksIngestTokensService', ['create', 'revoke']);

    await TestBed.configureTestingModule({
      imports: [XomtracksSetupCardComponent],
      providers: [
        { provide: XomifyAuthService, useValue: authSpy },
        { provide: XomtracksIngestTokensService, useValue: tokensSpy },
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
