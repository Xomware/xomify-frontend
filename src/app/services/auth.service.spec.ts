import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthService } from './auth.service';
import { XomifyAuthService } from './xomify-auth.service';
import { ToastService } from './toast.service';
import { of } from 'rxjs';

describe('AuthService.ensureXomifyJwt', () => {
  let service: AuthService;
  let xomifyAuth: jasmine.SpyObj<XomifyAuthService>;

  beforeEach(() => {
    const xomifyAuthSpy = jasmine.createSpyObj<XomifyAuthService>(
      'XomifyAuthService',
      ['hasJwt', 'getJwt', 'mintFromSpotifyAccessToken', 'persist', 'clear'],
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        AuthService,
        { provide: XomifyAuthService, useValue: xomifyAuthSpy },
        { provide: ToastService, useValue: { showNegativeToast: () => {} } },
      ],
    });

    service = TestBed.inject(AuthService);
    xomifyAuth = TestBed.inject(
      XomifyAuthService,
    ) as jasmine.SpyObj<XomifyAuthService>;
  });

  it('returns existing JWT without minting when hasJwt() is true', (done) => {
    xomifyAuth.hasJwt.and.returnValue(true);
    xomifyAuth.getJwt.and.returnValue('existing-jwt');

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBe('existing-jwt');
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });
  });

  it('mints a new JWT when hasJwt() is false and accessToken is set', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    xomifyAuth.mintFromSpotifyAccessToken.and.returnValue(of('new-jwt'));
    service.accessToken = 'spotify-access-token';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBe('new-jwt');
      expect(xomifyAuth.mintFromSpotifyAccessToken).toHaveBeenCalledWith(
        'spotify-access-token',
      );
      done();
    });
  });

  it('returns null when hasJwt() is false and no Spotify accessToken', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    service.accessToken = '';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBeNull();
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });
  });
});
