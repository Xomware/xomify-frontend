import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  private readonly apiAuthToken = environment.apiAuthToken;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.apiAuthToken}`,
      'Content-Type': 'application/json',
    });
  }

  /** POST /notifications/register — opt a device into push. */
  registerDevice(
    email: string,
    deviceToken: string,
    platform: DevicePlatform = 'ios',
  ): Observable<RegisterDeviceResponse> {
    const url = `${this.xomifyApiUrl}/notifications/register`;
    return this.http.post<RegisterDeviceResponse>(
      url,
      { email, deviceToken, platform },
      { headers: this.getHeaders() },
    );
  }

  /** POST /notifications/unregister — stop push to a specific device token. */
  unregisterDevice(
    email: string,
    deviceToken: string,
  ): Observable<UnregisterDeviceResponse> {
    const url = `${this.xomifyApiUrl}/notifications/unregister`;
    return this.http.post<UnregisterDeviceResponse>(
      url,
      { email, deviceToken },
      { headers: this.getHeaders() },
    );
  }
}
