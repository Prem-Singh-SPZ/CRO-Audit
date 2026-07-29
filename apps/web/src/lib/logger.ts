/**
 * Minimal structured logger. Emits single-line JSON so logs are queryable in
 * Vercel / any log drain (grep by scanId, host, stage, provider, duration).
 *
 * Observability hook: if you adopt Sentry (@sentry/nextjs), call
 * `Sentry.captureException` inside `logError` — the shape here already carries
 * the context you'd want attached.
 */
type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields?: Fields) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logEvent = (event: string, fields?: Fields) =>
  emit("info", event, fields);

export const logWarn = (event: string, fields?: Fields) =>
  emit("warn", event, fields);

export function logError(event: string, error: unknown, fields?: Fields) {
  const err =
    error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { message: String(error) };
  emit("error", event, { ...fields, error: err });
  // Placeholder for external error tracking (e.g. Sentry.captureException(error)).
}
