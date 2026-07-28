import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BroadcastsService } from './broadcasts.service';
import { environment } from 'src/environments/environment';
import { Broadcast } from '../models/broadcast.model';

describe('BroadcastsService', () => {
  let service: BroadcastsService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.xomifyApiUrl}/admin`;

  const sample: Broadcast = {
    id: 'b1',
    title: 'New Favorites feature',
    body: 'Check out My Favorites on your profile.',
    activeUntil: null,
    createdAt: '2026-07-28T00:00:00Z',
    createdBy: 'dominickj.giordano@gmail.com',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BroadcastsService],
    });
    service = TestBed.inject(BroadcastsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /admin/broadcasts-list returns the raw array when the backend responds with one', (done) => {
    service.list().subscribe((res) => {
      expect(res).toEqual([sample]);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/broadcasts-list`);
    expect(req.request.method).toBe('GET');
    req.flush([sample]);
  });

  it('GET /admin/broadcasts-list unwraps a { broadcasts } shape', (done) => {
    service.list().subscribe((res) => {
      expect(res).toEqual([sample]);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/broadcasts-list`);
    req.flush({ broadcasts: [sample] });
  });

  it('POST /admin/broadcasts-create sends the create body', (done) => {
    service.create({ title: sample.title, body: sample.body }).subscribe((res) => {
      expect(res).toEqual(sample);
      done();
    });
    const req = httpMock.expectOne(`${baseUrl}/broadcasts-create`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: sample.title, body: sample.body });
    req.flush(sample);
  });

  it('DELETE /admin/broadcasts-delete sends id as a query param', (done) => {
    service.delete('b1').subscribe((res) => {
      expect(res).toEqual({ deleted: true, id: 'b1' });
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/broadcasts-delete`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('id')).toBe('b1');
    req.flush({ deleted: true, id: 'b1' });
  });

  it('propagates a 404 (endpoint not live yet) to the caller', (done) => {
    service.list().subscribe({
      next: () => fail('expected error'),
      error: (err) => {
        expect(err.status).toBe(404);
        done();
      },
    });
    const req = httpMock.expectOne(`${baseUrl}/broadcasts-list`);
    req.flush('not found', { status: 404, statusText: 'Not Found' });
  });
});
