import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { XomtracksMeService } from './xomtracks-me.service';
import { environment } from 'src/environments/environment';
import { XtMeResponse } from '../models/xomtracks-admin.model';

describe('XomtracksMeService', () => {
  let service: XomtracksMeService;
  let httpMock: HttpTestingController;

  const url = `${environment.xomtracksApiUrl}/me/get`;

  const mockMe: XtMeResponse = {
    email: 'dominickj.giordano@gmail.com',
    linkStatus: 'linked',
    linked: true,
    linkedHandles: ['+15551234567'],
    shareCount: 42,
    spotifyConnected: true,
    spotifyUserId: 'spuser1',
    isAdmin: true,
    ownIngest: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [XomtracksMeService],
    });
    service = TestBed.inject(XomtracksMeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('unwraps the {data,error,meta} envelope from GET /me/get', (done) => {
    service.get().subscribe((res) => {
      expect(res).toEqual(mockMe);
      expect(res.isAdmin).toBe(true);
      done();
    });

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockMe, error: null, meta: {} });
  });

  it('caches the response — a second get() does not issue a second HTTP call', (done) => {
    service.get().subscribe(() => {
      service.get().subscribe((second) => {
        expect(second).toEqual(mockMe);
        httpMock.expectNone(url);
        done();
      });
    });

    const req = httpMock.expectOne(url);
    req.flush({ data: mockMe, error: null, meta: {} });
  });

  it('refresh() busts the cache so the next get() re-fetches', (done) => {
    service.get().subscribe(() => {
      service.refresh();
      service.get().subscribe((second) => {
        expect(second.isAdmin).toBe(false);
        done();
      });

      const secondReq = httpMock.expectOne(url);
      secondReq.flush({ data: { ...mockMe, isAdmin: false }, error: null, meta: {} });
    });

    const firstReq = httpMock.expectOne(url);
    firstReq.flush({ data: mockMe, error: null, meta: {} });
  });
});
