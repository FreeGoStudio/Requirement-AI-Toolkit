export class PlatformError extends Error {
  constructor(code, message, status = 409, details) {
    super(message); this.code = code; this.status = status; this.details = details;
  }
}
export function requireThat(condition, code, message, status = 409) {
  if (!condition) throw new PlatformError(code, message, status);
}
