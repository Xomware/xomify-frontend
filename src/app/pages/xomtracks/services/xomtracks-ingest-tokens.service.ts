import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

interface XtApiEnvelope<T> {
  data: T;
  error: { message: string; status: number } | null;
  meta: Record<string, unknown>;
}

/**
 * POST /ingest-tokens/create response. `token` is the PLAINTEXT ingest token
 * — returned exactly once, never recoverable afterward
 * (xomtracks-backend/lambdas/ingesttokens_create/handler.py). `tokenHash` is
 * the non-secret id, safe to keep around client-side for a later revoke.
 */
export interface XtIngestToken {
  token: string;
  tokenHash: string;
  ownerId: string;
  createdAt: string;
  label: string | null;
}

export interface XtIngestTokenRevokeResult {
  revoked: boolean;
  tokenHash: string;
}

/**
 * Mints/revokes the caller's own extractor ingest token — the credential
 * their local iMessage extractor uses to authenticate `POST /shares/ingest`
 * as them (self-serve foundation Phase 3). Backs the Xomtracks "Set up your
 * own" onboarding card.
 */
@Injectable({ providedIn: 'root' })
export class XomtracksIngestTokensService {
  private readonly baseUrl = `${environment.xomtracksApiUrl}/ingest-tokens`;

  constructor(private http: HttpClient) {}

  /** POST /ingest-tokens/create — mint a new token. `label` is an optional
   * human tag (e.g. the device it'll live on), surfaced back at revoke time. */
  create(label?: string): Observable<XtIngestToken> {
    const body = label?.trim() ? { label: label.trim() } : {};
    return this.http
      .post<XtApiEnvelope<XtIngestToken>>(`${this.baseUrl}/create`, body)
      .pipe(map((res) => res.data));
  }

  /** POST /ingest-tokens/revoke — revoke a token by its (non-secret) hash. */
  revoke(tokenHash: string): Observable<XtIngestTokenRevokeResult> {
    return this.http
      .post<XtApiEnvelope<XtIngestTokenRevokeResult>>(`${this.baseUrl}/revoke`, { tokenHash })
      .pipe(map((res) => res.data));
  }
}
