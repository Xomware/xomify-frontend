// persisted-token-storage.ts
//
// Small helper around localStorage for auth-token-style values (Xomify JWT,
// Spotify access/refresh tokens) that must survive a browser restart.
// sessionStorage is wiped when the tab/browser closes, which forced a
// re-login on every new browser session even though the underlying tokens
// were still valid for days — this is the fix.
//
// `read` also migrates forward any value still sitting in the legacy
// sessionStorage slot (from before this migration), so an already-logged-in
// user isn't bounced to a re-login the first time they load a build that
// contains this change.

/** Read a persisted value, migrating it forward from sessionStorage if needed. */
export function readPersistedToken(key: string): string | null {
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal !== null) {
      return fromLocal;
    }
  } catch {
    // localStorage can throw in private-mode/embedded webviews; fall through
    // to the sessionStorage migration check below.
  }

  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession !== null) {
      // One-time migration: move the legacy value into localStorage and
      // drop it from sessionStorage so we don't read it twice.
      writePersistedToken(key, fromSession);
      return fromSession;
    }
  } catch {
    // Best-effort — treat as missing.
  }

  return null;
}

/** Persist a value to localStorage, clearing any stale sessionStorage copy. */
export function writePersistedToken(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[persisted-token-storage] failed to write "${key}"`, err);
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
}

/** Remove a value from both localStorage and any legacy sessionStorage slot. */
export function removePersistedToken(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
}
