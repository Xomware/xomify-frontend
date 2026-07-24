import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { ShareDeeplinkComponent } from './share-deeplink.component';

describe('ShareDeeplinkComponent', () => {
  let router: Router;
  let navigateSpy: jasmine.Spy;

  function setup() {
    TestBed.configureTestingModule({
      declarations: [ShareDeeplinkComponent],
      imports: [RouterTestingModule],
    });

    const fixture = TestBed.createComponent(ShareDeeplinkComponent);
    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate');
    fixture.componentInstance.ngOnInit();
    return fixture;
  }

  // The old target — `/feed` — was removed along with the "feed" feature
  // (docs/features/xomtracks-xomify-merge/PLAN.md); this now just lands the
  // user somewhere sensible instead of a dead route.
  it('redirects to /my-profile', () => {
    setup();
    expect(navigateSpy).toHaveBeenCalledWith(['/my-profile']);
  });
});
