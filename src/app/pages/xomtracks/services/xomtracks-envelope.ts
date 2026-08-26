/**
 * Unwraps the Xomtracks API envelope.
 *
 * Every Xomtracks endpoint returns `{ data, error }`. The services used to map
 * straight to `res.data`, which means an error response yielded `null` — and
 * the UI rendered that as a perfectly ordinary empty state. "No shares yet" and
 * "the request failed" are not the same thing, and showing the first when the
 * second happened is how a broken feature looks like a working one.
 *
 * Typed structurally rather than against a shared interface: each service
 * declares its own `XtApiEnvelope<T>` with slightly different nullability, and
 * unifying them is a separate change from making errors surface.
 */
export function unwrapEnvelope<T>(response: { data: T; error?: unknown }): T {
  const error = response?.error;
  if (error) {
    // The shape varies by service: some return a bare string, others
    // `{ message, status }`. `String(error)` on the latter yields
    // "[object Object]", which is worse than no message at all.
    const message =
      typeof error === 'string'
        ? error
        : (error as { message?: string })?.message ?? 'Request failed';
    throw new Error(message);
  }
  return response?.data;
}
