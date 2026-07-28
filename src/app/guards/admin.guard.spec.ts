import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AdminGuard } from './admin.guard';
import { XomifyAuthService } from '../services/xomify-auth.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let authSpy: jasmine.SpyObj<XomifyAuthService>;
  let router: Router;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);

    TestBed.configureTestingModule({
      providers: [
        AdminGuard,
        { provide: XomifyAuthService, useValue: authSpy },
      ],
    });

    guard = TestBed.inject(AdminGuard);
    router = TestBed.inject(Router);
  });

  it('allows activation when the caller is the admin', () => {
    authSpy.getEmail.and.returnValue('dominickj.giordano@gmail.com');

    expect(guard.canActivate()).toBe(true);
  });

  it('is case-insensitive when matching the admin email', () => {
    authSpy.getEmail.and.returnValue('DominickJ.Giordano@Gmail.com');

    expect(guard.canActivate()).toBe(true);
  });

  it('redirects to /my-profile when the caller is not the admin', () => {
    authSpy.getEmail.and.returnValue('someone-else@example.com');

    const result = guard.canActivate();
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/my-profile');
  });

  it('redirects to /my-profile when there is no JWT email', () => {
    authSpy.getEmail.and.returnValue(null);

    const result = guard.canActivate();
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/my-profile');
  });
});
