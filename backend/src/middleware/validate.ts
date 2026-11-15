import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const validate =
  (schemas: { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params)
        req.params = schemas.params.parse(req.params) as Request["params"];
      if (schemas.query)
        req.query = schemas.query.parse(req.query) as Request["params"];
      if (schemas.body)
        req.body = schemas.body.parse(req.body) as Request["params"];
      next();
    } catch (e) {
      next(e); // ZodError handled in errorHandler -> 400
    }
  };
