export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error', error, context);
  }
  // Production: intentionally silent here. A future phase may forward this
  // to a real error-reporting service; until then, swallowing avoids noisy
  // production console output while keeping one call site to change later.
}
