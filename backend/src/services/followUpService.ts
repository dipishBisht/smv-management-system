import { Types } from "mongoose";
import type { Actor } from "../middleware/auth";
import { FollowUp, type FollowUpDoc } from "../models/FollowUp";
import type { MeetingDoc } from "../models/Meeting";
import { User } from "../models/User";
import { assertFutureDueDate } from "../domain/meetingRules";
import { loadAccessibleMeeting, isObjectId, visibleUserIds } from "./access";
import { conflict, forbidden, notFound, unprocessable } from "../utils/errors";
import { now } from "../utils/clock";

export interface FollowUpInput {
  ownerId: string;
  dueDate: Date;
  description: string;
}

/**
 * A follow-up owner must be someone who can legitimately act on the meeting:
 * the assigned employee, that employee's manager, or an admin.
 */
async function assertOwnerAllowed(
  ownerId: string,
  meeting: MeetingDoc,
): Promise<void> {
  const owner = await User.findById(ownerId);
  if (!owner || !owner.isActive)
    throw unprocessable(
      "OWNER_NOT_FOUND",
      "Follow-up owner not found or inactive",
    );
  const assignee = await User.findById(meeting.assignedTo);
  const allowed =
    owner.id === String(meeting.assignedTo) ||
    (assignee?.managerId && owner.id === String(assignee.managerId)) ||
    owner.role === "admin";
  if (!allowed) {
    throw unprocessable(
      "OWNER_NOT_ALLOWED",
      "Follow-up owner must be the assigned employee, their manager, or an admin",
    );
  }
}

export async function validateFollowUpInput(
  input: FollowUpInput,
  meeting: MeetingDoc,
  at: Date,
) {
  assertFutureDueDate(input.dueDate, at);
  await assertOwnerAllowed(input.ownerId, meeting);
}

export async function createFollowUp(
  actor: Actor,
  meeting: MeetingDoc,
  input: FollowUpInput,
  source: "outcome" | "manual",
  completionNo: number,
): Promise<FollowUpDoc> {
  return FollowUp.create({
    meetingId: meeting._id,
    accountId: meeting.accountId,
    ownerId: input.ownerId,
    createdBy: actor.id,
    description: input.description,
    dueDate: input.dueDate,
    source,
    completionNo,
  });
}

/** Manually add a follow-up to an existing (non-cancelled) meeting. */
export async function createManualFollowUp(
  actor: Actor,
  meetingId: string,
  input: FollowUpInput,
) {
  const meeting = await loadAccessibleMeeting(actor, meetingId);
  if (meeting.status === "cancelled") {
    throw conflict(
      "MEETING_CANCELLED",
      "Cannot add a follow-up to a cancelled meeting",
    );
  }
  await validateFollowUpInput(input, meeting, now());
  return createFollowUp(
    actor,
    meeting,
    input,
    "manual",
    meeting.completionCount,
  );
}

async function scope(actor: Actor): Promise<Record<string, unknown>> {
  const ids = await visibleUserIds(actor);
  if (ids === "all") return {};
  return { $or: [{ ownerId: { $in: ids } }, { createdBy: { $in: ids } }] };
}

async function loadScoped(actor: Actor, id: string): Promise<FollowUpDoc> {
  if (!isObjectId(id))
    throw notFound("FOLLOW_UP_NOT_FOUND", "Follow-up not found");
  const fu = await FollowUp.findOne({ _id: id, ...(await scope(actor)) });
  if (!fu) throw notFound("FOLLOW_UP_NOT_FOUND", "Follow-up not found");
  return fu;
}

const withOverdue = (fu: FollowUpDoc, at: Date) => ({
  ...fu.toJSON(),
  overdue: fu.status === "open" && fu.dueDate.getTime() < at.getTime(),
});

export async function listFollowUps(
  actor: Actor,
  q: {
    status?: string;
    overdue?: boolean;
    ownerId?: string;
    meetingId?: string;
    page: number;
    limit: number;
  },
) {
  const at = now();
  const filter: Record<string, unknown> = { ...(await scope(actor)) };
  const and: Record<string, unknown>[] = [];
  if (q.status) filter.status = q.status;
  if (q.ownerId) and.push({ ownerId: q.ownerId });
  if (q.meetingId) filter.meetingId = q.meetingId;
  if (q.overdue) {
    filter.status = "open";
    filter.dueDate = { $lt: at };
  }
  if (and.length) filter.$and = and;
  const [items, total] = await Promise.all([
    FollowUp.find(filter)
      .sort({ dueDate: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
    FollowUp.countDocuments(filter),
  ]);
  return {
    items: items.map((f) => withOverdue(f, at)),
    total,
    page: q.page,
    limit: q.limit,
  };
}

export async function getFollowUp(actor: Actor, id: string) {
  return withOverdue(await loadScoped(actor, id), now());
}

export async function updateFollowUp(
  actor: Actor,
  id: string,
  patch: { dueDate?: Date; description?: string; ownerId?: string },
) {
  const fu = await loadScoped(actor, id);
  if (fu.status !== "open")
    throw conflict("FOLLOW_UP_CLOSED", `Follow-up is already ${fu.status}`);
  const at = now();
  if (patch.dueDate) {
    assertFutureDueDate(patch.dueDate, at);
    fu.dueDate = patch.dueDate;
  }
  if (patch.ownerId && patch.ownerId !== String(fu.ownerId)) {
    const meeting = await loadAccessibleMeeting(actor, String(fu.meetingId));
    await assertOwnerAllowed(patch.ownerId, meeting);
    fu.ownerId = new Types.ObjectId(patch.ownerId);
  }
  if (patch.description) fu.description = patch.description;
  await fu.save();
  return withOverdue(fu, at);
}

export async function completeFollowUp(
  actor: Actor,
  id: string,
  note?: string,
) {
  const fu = await loadScoped(actor, id);
  const isOwner = String(fu.ownerId) === actor.id;
  if (!isOwner && actor.role === "employee") {
    throw forbidden(
      "Only the owner (or a manager/admin) can complete a follow-up",
    );
  }
  const at = now();
  const updated = await FollowUp.findOneAndUpdate(
    { _id: fu._id, status: "open" },
    {
      $set: {
        status: "done",
        completedAt: at,
        ...(note ? { completionNote: note } : {}),
      },
    },
    { new: true },
  );
  if (!updated)
    throw conflict("FOLLOW_UP_CLOSED", "Follow-up is no longer open");
  return withOverdue(updated, at);
}

export async function cancelFollowUp(actor: Actor, id: string, reason: string) {
  const fu = await loadScoped(actor, id);
  const isCreator = String(fu.createdBy) === actor.id;
  if (actor.role === "employee" && !isCreator) {
    throw forbidden(
      "Only the creator (or a manager/admin) can cancel a follow-up",
    );
  }
  const at = now();
  const updated = await FollowUp.findOneAndUpdate(
    { _id: fu._id, status: "open" },
    { $set: { status: "cancelled", cancelledAt: at, cancelReason: reason } },
    { new: true },
  );
  if (!updated)
    throw conflict("FOLLOW_UP_CLOSED", "Follow-up is no longer open");
  return withOverdue(updated, at);
}
