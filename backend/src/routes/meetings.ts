import { Router } from "express";
import { actorOf, authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as svc from "../services/meetingService";
import { asyncHandler } from "../utils/asyncHandler";
import {
  checkInBody,
  checkOutBody,
  completeWithoutVisitBody,
  createMeetingBody,
  idParam,
  listMeetingsQuery,
  reasonBody,
  rescheduleBody,
  updateMeetingBody,
} from "../validators/schemas";

export const meetingsRouter = Router();

meetingsRouter.use(authenticate);

const getId = (req: { params: { id?: string | string[] } }): string => {
  const id = req.params.id;

  if (typeof id !== "string") {
    throw new Error("Invalid meeting ID");
  }

  return id;
};

const view = async (req: any, id: string) => ({
  meeting: await svc.getMeeting(actorOf(req), id),
});

meetingsRouter.get(
  "/",
  validate({ query: listMeetingsQuery }),
  asyncHandler(async (req, res) => {
    const query = res.locals.validatedQuery as svc.ListQuery;

    const result = await svc.listMeetings(actorOf(req), query);

    res.json(result);
  }),
);

meetingsRouter.post(
  "/",
  validate({ body: createMeetingBody }),
  asyncHandler(async (req, res) => {
    const m = await svc.createMeeting(actorOf(req), req.body);
    res.status(201).json(await view(req, m.id));
  }),
);

meetingsRouter.get(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await view(req, getId(req)));
  }),
);

meetingsRouter.patch(
  "/:id",
  validate({ params: idParam, body: updateMeetingBody }),
  asyncHandler(async (req, res) => {
    const id = getId(req);

    await svc.updateDetails(actorOf(req), id, req.body);

    res.json(await view(req, id));
  }),
);

// ---- Lifecycle transitions

const transition = (
  path: string,
  schema: any,
  handler: (req: any, id: string) => Promise<unknown>,
) =>
  meetingsRouter.post(
    `/:id/${path}`,
    validate({
      params: idParam,
      ...(schema ? { body: schema } : {}),
    }),
    asyncHandler(async (req, res) => {
      const id = getId(req);

      const extra = (await handler(req, id)) as
        | Record<string, unknown>
        | undefined;

      res.json({
        ...(await view(req, id)),
        ...(extra ?? {}),
      });
    }),
  );

transition("confirm", null, (req, id) => svc.confirmMeeting(actorOf(req), id));

transition("reschedule", rescheduleBody, (req, id) =>
  svc.rescheduleMeeting(actorOf(req), id, req.body),
);

transition("cancel", reasonBody, (req, id) =>
  svc.cancelMeeting(actorOf(req), id, req.body.reason),
);

transition("check-in", checkInBody, (req, id) =>
  svc.checkIn(actorOf(req), id, req.body.location),
);

transition("start", null, (req, id) => svc.startMeeting(actorOf(req), id));

transition("check-out", checkOutBody, async (req, id) => {
  const { followUp } = await svc.checkOut(actorOf(req), id, req.body);

  return { followUp };
});

transition("complete", completeWithoutVisitBody, async (req, id) => {
  const { followUp } = await svc.completeWithoutVisit(
    actorOf(req),
    id,
    req.body,
  );

  return { followUp };
});

transition("reopen", reasonBody, (req, id) =>
  svc.reopenMeeting(actorOf(req), id, req.body.reason),
);
