import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../domain/constants";
import { User } from "../models/User";
import { forbidden, unauthorized } from "../utils/errors";
import { asyncHandler } from "../utils/asyncHandler";

export interface Actor {
  id: string;
  name: string;
  role: Role;
  managerId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    let sub: string;
    try {
      sub = (jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload)
        .sub as string;
    } catch {
      throw unauthorized("Invalid or expired token");
    }
    // Re-load on every request so deactivated users / role changes take effect immediately.
    const user = await User.findById(sub);
    if (!user || !user.isActive)
      throw unauthorized("Account not found or deactivated");
    req.actor = {
      id: user.id,
      name: user.name,
      role: user.role as Role,
      managerId: user.managerId ? String(user.managerId) : null,
    };
    next();
  },
);

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || !roles.includes(req.actor.role)) return next(forbidden());
    next();
  };

export const actorOf = (req: Request): Actor => req.actor!;
