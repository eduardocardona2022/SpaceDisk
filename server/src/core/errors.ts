export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createAbortError(): Error {
  const error = new Error("Scan cancelled");
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (typeof code === "string") return code;
  }
  return "UNKNOWN";
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
