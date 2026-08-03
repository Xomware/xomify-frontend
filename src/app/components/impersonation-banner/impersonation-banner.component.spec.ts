import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ImpersonationBannerComponent } from './impersonation-banner.component';
import { IconComponent } from '../icon/icon.component';
import { ImpersonationService } from '../../services/impersonation.service';

describe('ImpersonationBannerComponent', () => {
  let fixture: ComponentFixture<ImpersonationBannerComponent>;
  let impersonationSpy: jasmine.SpyObj<ImpersonationService>;
  let router: Router;

  async function build(
    impersonatedEmail: string | null,
    spotifyTokenUnavailable = false,
  ): Promise<void> {
    impersonationSpy = jasmine.createSpyObj(
      'ImpersonationService',
      ['exit'],
      {
        impersonatedEmail$: of(impersonatedEmail),
        spotifyTokenUnavailable$: of(spotifyTokenUnavailable),
      },
    );

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [ImpersonationBannerComponent, IconComponent],
      providers: [{ provide: ImpersonationService, useValue: impersonationSpy }],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    fixture = TestBed.createComponent(ImpersonationBannerComponent);
    fixture.detectChanges();
  }

  it('renders nothing when not impersonating', async () => {
    await build(null);
    const el = fixture.debugElement.query(By.css('.impersonation-banner'));
    expect(el).toBeNull();
  });

  it('renders the banner with the impersonated email when impersonating', async () => {
    await build('target@example.com');
    const el = fixture.debugElement.query(By.css('.impersonation-banner'));
    expect(el).not.toBeNull();
    expect(el.nativeElement.textContent).toContain('target@example.com');
  });

  it('does not render the Spotify-token-unavailable note when the target token loaded fine', async () => {
    await build('target@example.com', false);
    const note = fixture.debugElement.query(By.css('.impersonation-banner-note'));
    expect(note).toBeNull();
  });

  it('renders the Spotify-token-unavailable note when minting the target token failed', async () => {
    await build('target@example.com', true);
    const note = fixture.debugElement.query(By.css('.impersonation-banner-note'));
    expect(note).not.toBeNull();
    expect(note.nativeElement.textContent).toContain("couldn't load their Spotify data");
  });

  it('exit() clears impersonation and navigates back to /admin', async () => {
    await build('target@example.com');
    const button = fixture.debugElement.query(By.css('.impersonation-banner-exit'));
    button.nativeElement.click();

    expect(impersonationSpy.exit).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });
});
