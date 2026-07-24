import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';
import { XomtracksAdminGuard } from './xomtracks-admin.guard';
import { XomtracksMeService } from '../../services/xomtracks-me.service';
import { XtMeResponse } from '../../models/xomtracks-admin.model';

describe('XomtracksAdminGuard', () => {
  let guard: XomtracksAdminGuard;
  let meSpy: jasmine.SpyObj<XomtracksMeService>;
  let router: Router;

  const baseMe: XtMeResponse = {
    email: 'someone@example.com',
    linkStatus: 'none',
    linked: false,
    linkedHandles: [],
    shareCount: 0,
    spotifyConnected: false,
    spotifyUserId: null,
    isAdmin: false,
    ownIngest: false,
  };

  beforeEach(() => {
    meSpy = jasmine.createSpyObj('XomtracksMeService', ['get']);

    TestBed.configureTestingModule({
      providers: [
        XomtracksAdminGuard,
        { provide: XomtracksMeService, useValue: meSpy },
      ],
    });

    guard = TestBed.inject(XomtracksAdminGuard);
    router = TestBed.inject(Router);
  });

  it('allows activation when the caller is the admin', (done) => {
    meSpy.get.and.returnValue(of({ ...baseMe, isAdmin: true }));

    guard.canActivate().subscribe((result) => {
      expect(result).toBe(true);
      done();
    });
  });

  it('redirects to /xomtracks when the caller is not the admin', (done) => {
    meSpy.get.and.returnValue(of({ ...baseMe, isAdmin: false }));

    guard.canActivate().subscribe((result) => {
      expect(result instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(result as UrlTree)).toBe('/xomtracks');
      done();
    });
  });

  it('redirects to /xomtracks when the /me/get call fails', (done) => {
    meSpy.get.and.returnValue(throwError(() => new Error('boom')));

    guard.canActivate().subscribe((result) => {
      expect(result instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(result as UrlTree)).toBe('/xomtracks');
      done();
    });
  });
});
