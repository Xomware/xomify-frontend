import { TestBed } from '@angular/core/testing';
import { ImpersonationService } from './impersonation.service';
import { XomifyAuthService } from './xomify-auth.service';

describe('ImpersonationService', () => {
  let service: ImpersonationService;
  let authSpy: jasmine.SpyObj<XomifyAuthService>;

  const ADMIN_EMAIL = 'dominickj.giordano@gmail.com';
  const STORAGE_KEY = 'xomify.impersonation.email';

  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        ImpersonationService,
        { provide: XomifyAuthService, useValue: authSpy },
      ],
    });
    service = TestBed.inject(ImpersonationService);
  }

  beforeEach(() => {
    localStorage.clear();
    authSpy = jasmine.createSpyObj('XomifyAuthService', ['getEmail']);
    authSpy.getEmail.and.returnValue(ADMIN_EMAIL);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts not impersonating when localStorage is empty', () => {
    configure();
    expect(service.impersonatedEmail).toBeNull();
    expect(service.isImpersonating).toBe(false);
  });

  it('enter() persists and exposes the (lowercased/trimmed) target email for the admin caller', () => {
    configure();
    service.enter('  Someone@Example.com  ');

    expect(service.impersonatedEmail).toBe('someone@example.com');
    expect(service.isImpersonating).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('someone@example.com');
  });

  it('enter() is a no-op for a non-admin caller', () => {
    authSpy.getEmail.and.returnValue('someone-else@example.com');
    configure();

    service.enter('target@example.com');

    expect(service.impersonatedEmail).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('enter() ignores a blank/whitespace-only email', () => {
    configure();
    service.enter('   ');

    expect(service.impersonatedEmail).toBeNull();
  });

  it('exit() clears state, locally and in localStorage', () => {
    configure();
    service.enter('target@example.com');
    expect(service.isImpersonating).toBe(true);

    service.exit();

    expect(service.impersonatedEmail).toBeNull();
    expect(service.isImpersonating).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('isImpersonating$ emits true/false in step with enter()/exit()', () => {
    configure();
    const seen: boolean[] = [];
    service.isImpersonating$.subscribe((v) => seen.push(v));

    service.enter('target@example.com');
    service.exit();

    expect(seen).toEqual([false, true, false]);
  });

  it('restores a persisted email on construction when the caller is (still) the admin', () => {
    localStorage.setItem(STORAGE_KEY, 'persisted@example.com');
    configure();

    expect(service.impersonatedEmail).toBe('persisted@example.com');
  });

  it('discards a persisted email on construction if the current caller is not the admin, and wipes it from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'persisted@example.com');
    authSpy.getEmail.and.returnValue('someone-else@example.com');
    configure();

    expect(service.impersonatedEmail).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
