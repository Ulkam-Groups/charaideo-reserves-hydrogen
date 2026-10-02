/**
 * Resolve non-critical loader data before React Router's stream deadline.
 *
 * React Router aborts unresolved deferred values after 4.95 seconds by
 * default. Returning a fallback first keeps an optional integration from
 * rejecting the entire route after the PDP has already rendered.
 */
export async function settleDeferred<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
