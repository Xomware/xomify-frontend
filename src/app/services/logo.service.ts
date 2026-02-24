import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

/**
 * LogoService
 *
 * Loads the Xomify logo from a static asset at runtime and converts it to a
 * raw base64 JPEG string suitable for Spotify's playlist-cover API.
 *
 * The result is cached via shareReplay so the HTTP request is only made once
 * per application lifecycle, regardless of how many callers subscribe.
 */
@Injectable({
  providedIn: 'root',
})
export class LogoService {
  /** Path to the static logo asset, relative to Angular's base-href. */
  private readonly logoPath = 'assets/images/xomify-logo.jpeg';

  /** Cached Observable – emits a raw base64 string (no data-URL prefix). */
  private readonly logo$: Observable<string>;

  constructor(private http: HttpClient) {
    this.logo$ = this.http
      .get(this.logoPath, { responseType: 'arraybuffer' })
      .pipe(
        map((buffer) => this.arrayBufferToBase64(buffer)),
        shareReplay(1),
      );
  }

  /**
   * Returns an Observable that emits the logo as a raw base64 string.
   * Subsequent subscriptions reuse the cached value without a new HTTP request.
   */
  getLogoBase64(): Observable<string> {
    return this.logo$;
  }

  /** Converts an ArrayBuffer to a raw base64 string (no data-URL prefix). */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
