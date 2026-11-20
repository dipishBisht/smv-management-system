import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res
    .status(404)
    .json({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({
        error: { code: err.code, message: err.message, details: err.details },
      });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
  }
  if (err?.code === 11000) {
    return res
      .status(409)
      .json({
        error: {
          code: "DUPLICATE",
          message: "A record with these values already exists",
        },
      });
  }
  if (err?.name === "CastError" || err?.name === "ValidationError") {
    return res
      .status(400)
      .json({ error: { code: "BAD_REQUEST", message: err.message } });
  }
  if (err?.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({
        error: { code: "INVALID_JSON", message: "Malformed JSON body" },
      });
  }
  console.error(err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
