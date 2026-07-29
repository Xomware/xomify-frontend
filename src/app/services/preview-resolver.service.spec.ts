import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { PreviewResolverService } from './preview-resolver.service';

describe('PreviewResolverService', () => {
  let service: PreviewResolverService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PreviewResolverService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  const isItunesRequest = (r: { url: string }) =>
    r.url.startsWith('https://itunes.apple.com/search');

  it('resolves a previewUrl from the first iTunes result', () => {
    let result: string | null | undefined;
    service.resolve('Track One', 'Artist One').subscribe((url) => (result = url));

    const req = httpMock.expectOne(isItunesRequest);
    expect(decodeURIComponent(req.request.url)).toContain('term=Artist One Track One');
    req.flush({
      resultCount: 1,
      results: [{ previewUrl: 'https://audio.example/preview.m4a' }],
    });

    expect(result).toBe('https://audio.example/preview.m4a');
  });

  it('resolves null when iTunes has no results', () => {
    let result: string | null | undefined;
    service.resolve('Nothing', 'Nobody').subscribe((url) => (result = url));

    const req = httpMock.expectOne(isItunesRequest);
    req.flush({ resultCount: 0, results: [] });

    expect(result).toBeNull();
  });

  it('resolves null (not an error) when the request fails', () => {
    let result: string | null | undefined;
    let errored = false;
    service.resolve('Track', 'Artist').subscribe({
      next: (url) => (result = url),
      error: () => (errored = true),
    });

    const req = httpMock.expectOne(isItunesRequest);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(errored).toBeFalse();
    expect(result).toBeNull();
  });

  it('caches in-memory so a second call for the same track does not refetch', () => {
    service.resolve('Track One', 'Artist One').subscribe();
    httpMock.expectOne(isItunesRequest).flush({
      resultCount: 1,
      results: [{ previewUrl: 'https://audio.example/a.m4a' }],
    });

    let second: string | null | undefined;
    service.resolve('Track One', 'Artist One').subscribe((url) => (second = url));

    httpMock.expectNone(isItunesRequest);
    expect(second).toBe('https://audio.example/a.m4a');
  });

  it('resolves null without an HTTP call when both title and artist are empty', () => {
    let result: string | null | undefined;
    service.resolve('', '').subscribe((url) => (result = url));

    httpMock.expectNone(isItunesRequest);
    expect(result).toBeNull();
  });
});
