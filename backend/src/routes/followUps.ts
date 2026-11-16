import { Router } from "express";
import { actorOf, authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as svc from "../services/followUpService";
import { asyncHandler } from "../utils/asyncHandler";
import {
  cancelFollowUpBody,
  completeFollowUpBody,
  createFollowUpBody,
  idParam,
  listFollowUpsQuery,
  updateFollowUpBody,
} from "../validators/schemas";

export const followUpsRouter = Router();

followUpsRouter.use(authenticate);

followUpsRouter.get(
  "/",
  validate({ query: listFollowUpsQuery }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listFollowUps(actorOf(req), req.query as any));
  }),
);

followUpsRouter.post(
  "/",
  validate({ body: createFollowUpBody }),
  asyncHandler(async (req, res) => {
    const { meetingId, ...input } = req.body;

    const fu = await svc.createManualFollowUp(actorOf(req), meetingId, input);

    res.status(201).json({
      followUp: await svc.getFollowUp(actorOf(req), fu.id),
    });
  }),
);

followUpsRouter.get(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    res.json({
      followUp: await svc.getFollowUp(actorOf(req), id),
    });
  }),
);

followUpsRouter.patch(
  "/:id",
  validate({ params: idParam, body: updateFollowUpBody }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    res.json({
      followUp: await svc.updateFollowUp(actorOf(req), id, req.body),
    });
  }),
);

followUpsRouter.post(
  "/:id/complete",
  validate({ params: idParam, body: completeFollowUpBody }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    res.json({
      followUp: await svc.completeFollowUp(actorOf(req), id, req.body.note),
    });
  }),
);

followUpsRouter.post(
  "/:id/cancel",
  validate({ params: idParam, body: cancelFollowUpBody }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    res.json({
      followUp: await svc.cancelFollowUp(actorOf(req), id, req.body.reason),
    });
  }),
);
