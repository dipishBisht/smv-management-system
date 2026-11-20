import { Router } from "express";
import { actorOf, authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { login } from "../services/authService";
import { User } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";
import { loginBody } from "../validators/schemas";

export const authRouter = Router();

authRouter.post(
  "/login",
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    res.json(await login(req.body.email, req.body.password));
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: (await User.findById(actorOf(req).id))!.toJSON() });
  }),
);
