/** An error with a stable code the app maps to user-facing copy. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const unauthorized = () => new HttpError(401, "unauthorized");
export const forbidden = (code = "forbidden") => new HttpError(403, code);
export const notFound = (what = "not_found") => new HttpError(404, what);
export const conflict = (code: string, message?: string) => new HttpError(409, code, message);
export const badRequest = (code = "bad_request", message?: string) => new HttpError(400, code, message);
export const unavailable = (code: string) => new HttpError(503, code);
