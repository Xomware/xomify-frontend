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
  let httpMock: HttpTestingController;

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
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
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

  it('refreshes Spotify access token then mints when hasJwt() is false and refreshToken is set', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    xomifyAuth.mintFromSpotifyAccessToken.and.returnValue(of('new-jwt'));
    service.refreshToken = 'spotify-refresh-token';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBe('new-jwt');
      // The mint call must use the FRESH access token, not the previously
      // stored one — that's the whole point of the bootstrap hotfix.
      expect(xomifyAuth.mintFromSpotifyAccessToken).toHaveBeenCalledWith(
        'fresh-access-token',
      );
      done();
    });

    const tokenReq = httpMock.expectOne(
      'https://accounts.spotify.com/api/token',
    );
    expect(tokenReq.request.method).toBe('POST');
    tokenReq.flush({
      access_token: 'fresh-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: '',
    });
  });

  it('returns null when hasJwt() is false and no Spotify refreshToken', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    service.refreshToken = '';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBeNull();
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });
  });

  it('returns null when Spotify refresh fails', (done) => {
    xomifyAuth.hasJwt.and.returnValue(false);
    service.refreshToken = 'spotify-refresh-token';

    service.ensureXomifyJwt().subscribe((jwt) => {
      expect(jwt).toBeNull();
      expect(xomifyAuth.mintFromSpotifyAccessToken).not.toHaveBeenCalled();
      done();
    });

    const tokenReq = httpMock.expectOne(
      'https://accounts.spotify.com/api/token',
    );
    tokenReq.flush(
      { error: 'invalid_grant' },
      { status: 400, statusText: 'Bad Request' },
    );
  });
});
