export interface ReportErrorOptions {
  scope: string;
  error: unknown;
  meta?: Record<string, unknown>;
}

export function reportError({ scope, error, meta }: ReportErrorOptions): void {
  const normalized = error instanceof Error ? error : new Error(String(error));

  console.error(`[${scope}] ${normalized.message}`, {
    name: normalized.name,
    stack: normalized.stack,
    ...meta,
  });
}
