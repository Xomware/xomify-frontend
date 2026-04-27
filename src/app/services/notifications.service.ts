import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// ============================================
// Types — shapes match deployed handlers:
//   notifications_register   (POST /notifications/register)
//   notifications_unregister (POST /notifications/unregister)
//
// NOTE: There is no `/notifications/list` endpoint yet, so the UI can only
// act on a device token the user already has in hand (typically the one
// copied off the iOS companion app). Surfacing a list of registered
// devices is tracked as a backend follow-up.
// ============================================

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface RegisterDeviceResponse {
  ok: true;
  deviceToken: string;
}

export interface UnregisterDeviceResponse {
  ok: true;
  deviceToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private xomifyApiUrl = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  // Authorization for Xomify API calls is attached by AuthInterceptor (sub-feature 0e).

  constructor(private http: HttpClient) {}

  /** POST /notifications/register — opt a device into push.
   *  The `email` arg is retained for call-site compatibility but is no longer
   *  forwarded — caller identity comes from the JWT context (1f).
   *  `deviceToken` is the target identifier of the device being registered. */
  registerDevice(
    _email: string,
    deviceToken: string,
    platform: DevicePlatform = 'ios',
  ): Observable<RegisterDeviceResponse> {
    const url = `${this.xomifyApiUrl}/notifications/register`;
    return this.http.post<RegisterDeviceResponse>(url, {
      deviceToken,
      platform,
    });
  }

  /** POST /notifications/unregister — stop push to a specific device token.
   *  The `email` arg is retained for call-site compatibility but is no longer
   *  forwarded — caller identity comes from the JWT context (1f). */
  unregisterDevice(
    _email: string,
    deviceToken: string,
  ): Observable<UnregisterDeviceResponse> {
    const url = `${this.xomifyApiUrl}/notifications/unregister`;
    return this.http.post<UnregisterDeviceResponse>(url, {
      deviceToken,
    });
  }
}
