import { Router } from "express";
import { actorOf, authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { User } from "../models/User";
import { hashPassword } from "../services/authService";
import { visibleUserIds } from "../services/access";
import { asyncHandler } from "../utils/asyncHandler";
import { notFound, unprocessable } from "../utils/errors";
import { createUserBody, idParam, updateUserBody } from "../validators/schemas";

export const usersRouter = Router();
usersRouter.use(authenticate);

/** Users the caller may see: admin = all, manager = self + team, employee = self + own manager. */
usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    const ids = await visibleUserIds(actor);
    const filter =
      ids === "all"
        ? {}
        : {
            _id: {
              $in: [
                ...ids,
                ...(actor.role === "employee" && actor.managerId
                  ? [actor.managerId]
                  : []),
              ],
            },
          };
    res.json({
      items: (await User.find(filter).sort({ name: 1 })).map((u) => u.toJSON()),
    });
  }),
);

async function assertManagerValid(role: string, managerId?: string | null) {
  if (role === "employee" && managerId) {
    const mgr = await User.findById(managerId);
    if (!mgr || mgr.role !== "manager")
      throw unprocessable(
        "INVALID_MANAGER",
        "managerId must reference a manager",
      );
  }
}

usersRouter.post(
  "/",
  requireRole("admin"),
  validate({ body: createUserBody }),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.body;
    await assertManagerValid(rest.role, rest.managerId);
    const user = await User.create({
      ...rest,
      managerId: rest.role === "employee" ? (rest.managerId ?? null) : null,
      passwordHash: await hashPassword(password),
    });
    res.status(201).json({ user: user.toJSON() });
  }),
);

usersRouter.patch(
  "/:id",
  requireRole("admin"),
  validate({ params: idParam, body: updateUserBody }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw notFound("USER_NOT_FOUND", "User not found");
    await assertManagerValid(req.body.role ?? user.role, req.body.managerId);
    Object.assign(user, req.body);
    await user.save();
    res.json({ user: user.toJSON() });
  }),
);
