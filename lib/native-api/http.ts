import "server-only";

export type ApiErrorCode =
  | "bad_request"
  | "invalid_credentials"
  | "not_authenticated"
  | "not_found"
  | "conflict"
  | "configuration_error"
  | "internal_error";

export class NativeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NativeApiError";
  }
}

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export function apiData<T>(data: T, init?: ResponseInit): Response {
  return Response.json(
    { data },
    {
      ...init,
      headers: { ...NO_STORE_HEADERS, ...init?.headers },
    },
  );
}

export function apiError(error: unknown): Response {
  if (error instanceof NativeApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: NO_STORE_HEADERS },
    );
  }

  console.error("[native-api] unexpected error", error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500, headers: NO_STORE_HEADERS },
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    throw new NativeApiError(413, "bad_request", "Request body is too large.");
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new NativeApiError(400, "bad_request", "Invalid JSON request body.");
  }
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new NativeApiError(400, "bad_request", `${field} is invalid.`);
  }
  return value.trim();
}

export function optionalString(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new NativeApiError(400, "bad_request", "A text value is invalid.");
  }
  return value.trim() || null;
}
