const SECRET_KEY_PATTERN =
  /(password|passwd|secret|token|jwt|api[-_]?key|cookie|authorization)/i;

const REDACTED = "[REDACTED]";

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    event,
    ...(redact(fields) as Record<string, unknown>),
  });
  console.log(line);
}

export function logError(
  event: string,
  error: unknown,
  fields: Record<string, unknown> = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: "error",
    event,
    message,
    ...(redact(fields) as Record<string, unknown>),
  });
  console.error(line);
}
