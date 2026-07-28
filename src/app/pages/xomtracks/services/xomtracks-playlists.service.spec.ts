import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { XomtracksPlaylistsService } from './xomtracks-playlists.service';
import { environment } from 'src/environments/environment';
import { XtMePlaylistsResponse } from '../models/xomtracks-playlists.model';

describe('XomtracksPlaylistsService', () => {
  let service: XomtracksPlaylistsService;
  let httpMock: HttpTestingController;

  const url = `${environment.xomtracksApiUrl}/me/playlists`;

  const mockResponse: XtMePlaylistsResponse = {
    own: {
      in: { playlistId: 'own-in-1', url: 'https://open.spotify.com/playlist/own-in-1', name: 'Shared With Me (Last Month)' },
      out: null,
    },
    baseline: {
      in: { playlistId: 'baseline-in-1', url: 'https://open.spotify.com/playlist/baseline-in-1', name: 'Shared With Me (Last Month)' },
      out: { playlistId: 'baseline-out-1', url: 'https://open.spotify.com/playlist/baseline-out-1', name: 'Shared By Me (Last Month)' },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [XomtracksPlaylistsService],
    });
    service = TestBed.inject(XomtracksPlaylistsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('unwraps the {data,error,meta} envelope from GET /me/playlists', (done) => {
    service.get().subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(res.own.out).toBeNull();
      done();
    });

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockResponse, error: null, meta: {} });
  });

  it('issues a fresh HTTP call on every get() (not cached)', (done) => {
    service.get().subscribe(() => {
      service.get().subscribe((second) => {
        expect(second).toEqual(mockResponse);
        done();
      });
      const secondReq = httpMock.expectOne(url);
      secondReq.flush({ data: mockResponse, error: null, meta: {} });
    });

    const firstReq = httpMock.expectOne(url);
    firstReq.flush({ data: mockResponse, error: null, meta: {} });
  });
});
