// persisted-token-storage.spec.ts
//
// Coverage for the localStorage-first token helper used by AuthService and
// XomifyAuthService:
//   - Reads/writes go to localStorage (survives a browser restart).
//   - A legacy value still sitting in sessionStorage (from before this
//     migration) is read once, copied into localStorage, and removed from
//     sessionStorage so it isn't read twice or left stale.
//   - `remove` clears both storages.

import {
  readPersistedToken,
  writePersistedToken,
  removePersistedToken,
} from './persisted-token-storage';

describe('persisted-token-storage', () => {
  const KEY = 'test_token_key';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('writes to localStorage', () => {
    writePersistedToken(KEY, 'abc123');
    expect(localStorage.getItem(KEY)).toBe('abc123');
  });

  it('reads a value already in localStorage', () => {
    localStorage.setItem(KEY, 'from-local');
    expect(readPersistedToken(KEY)).toBe('from-local');
  });

  it('migrates a legacy sessionStorage value into localStorage on read', () => {
    sessionStorage.setItem(KEY, 'from-legacy-session');

    const value = readPersistedToken(KEY);

    expect(value).toBe('from-legacy-session');
    expect(localStorage.getItem(KEY)).toBe('from-legacy-session');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('prefers localStorage over a stale sessionStorage value', () => {
    localStorage.setItem(KEY, 'authoritative');
    sessionStorage.setItem(KEY, 'stale');

    expect(readPersistedToken(KEY)).toBe('authoritative');
  });

  it('returns null when the key is absent from both storages', () => {
    expect(readPersistedToken(KEY)).toBeNull();
  });

  it('write clears any stale sessionStorage copy of the same key', () => {
    sessionStorage.setItem(KEY, 'stale');

    writePersistedToken(KEY, 'fresh');

    expect(localStorage.getItem(KEY)).toBe('fresh');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('remove clears both storages', () => {
    localStorage.setItem(KEY, 'a');
    sessionStorage.setItem(KEY, 'b');

    removePersistedToken(KEY);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
