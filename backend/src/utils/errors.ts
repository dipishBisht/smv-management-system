/**
 * HTTP semantics used across the API:
 *  400 malformed input (schema validation)   401 unauthenticated   403 not allowed for role
 *  404 not found / not visible to caller      409 state conflict (invalid transition, stale state)
 *  422 well-formed request that breaks a business rule
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) =>
  new AppError(400, code, msg, details);
export const unauthorized = (msg = "Authentication required") =>
  new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (
  msg = "You are not allowed to perform this action",
  code = "FORBIDDEN",
) => new AppError(403, code, msg);
export const notFound = (code: string, msg: string) =>
  new AppError(404, code, msg);
export const conflict = (code: string, msg: string, details?: unknown) =>
  new AppError(409, code, msg, details);
export const unprocessable = (code: string, msg: string, details?: unknown) =>
  new AppError(422, code, msg, details);
