export const environment = {
  production: true,
  baseCallbackUrl: 'https://xomify.xomware.com',
  spotifyClientId: '---',
  spotifyClientSecret: '---',
  // Legacy static Xomify API token. Sub-feature 0e moved every authorized
  // call to a per-user JWT minted from the user's Spotify access token via
  // POST /auth/login. The interceptor (`auth.interceptor.ts`) only falls back
  // to this value when the per-user JWT is missing (e.g. before the first
  // mint completes). It will be removed entirely in sub-feature 1l once the
  // backend authorizer's dual-mode shim is retired.
  apiAuthToken: '---',
  apiId: '---',
  newsApiKey: '---',
  get xomifyApiUrl(): string {
    return `https://${this.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  },
  // xomtracks-backend — the Xomtracks feature's data/API layer (separate host
  // from xomifyApiUrl). It validates xomify's own HS256 JWT in-handler
  // (WS-AUTH re-base), so the AuthInterceptor attaches the same Bearer token
  // here as it does for Xomify calls — see auth.interceptor.ts's
  // `isXomifyApiRequest`.
  xomtracksApiUrl: 'https://api.xomtracks.xomware.com',
};
