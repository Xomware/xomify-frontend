import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { ShareDeeplinkComponent } from './share-deeplink.component';

describe('ShareDeeplinkComponent', () => {
  let router: Router;
  let navigateSpy: jasmine.Spy;

  function setup(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      declarations: [ShareDeeplinkComponent],
      imports: [RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => queryParams[key] ?? null,
              },
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ShareDeeplinkComponent);
    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate');
    fixture.componentInstance.ngOnInit();
    return fixture;
  }

  it('redirects to /feed with shareTrackId when trackId is present', () => {
    setup({ trackId: 'spotify123' });
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/feed'],
      { queryParams: { shareTrackId: 'spotify123' } },
    );
  });

  it('redirects to /feed without queryParams when trackId is absent', () => {
    setup({});
    expect(navigateSpy).toHaveBeenCalledWith(['/feed']);
  });
});
