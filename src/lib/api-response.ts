export function resolveErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
