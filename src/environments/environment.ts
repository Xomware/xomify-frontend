export const environment = {
  production: true,
  baseCallbackUrl: 'https://xomify.xomware.com',
  spotifyClientId: '---',
  spotifyClientSecret: '---',
  apiAuthToken: '---',
  apiId: '---',
  ticketmasterApiKey: 'MOCK', // Set to real key or use NEXT_PUBLIC_TICKETMASTER_KEY
  get xomifyApiUrl(): string {
    return `https://${this.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  },
};
