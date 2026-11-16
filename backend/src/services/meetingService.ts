/**
 * Meeting lifecycle orchestration.
 *
 * Concurrency approach (MongoDB without transactions): every state change is a single atomic
 * findOneAndUpdate whose filter includes the status we validated against ("compare-and-set").
 * If another request changed the meeting in between, the update matches nothing and we answer 409.
 * Cross-collection steps (follow-up creation) use create-then-compensate; see README trade-offs.
 */
import type { QueryFilter, UpdateQuery } from "mongoose";
import { Types } from "mongoose";
import { ACTIVE_STATUSES } from "../domain/constants";
import type {
  MeetingStatus,
  Outcome,
  VisitEndReason,
} from "../domain/constants";
import {
  assertCanComplete,
  assertFollowUpPresence,
  assertNotInPast,
  assertReturnAt,
  assertTransition,
  assertValidWindow,
  assertWithinReopenWindow,
  evaluateCheckIn,
  overlaps,
} from "../domain/meetingRules";
import type { Actor } from "../middleware/auth";
import { Account } from "../models/Account";
import { FollowUp, type FollowUpDoc } from "../models/FollowUp";
import type { GeoPoint, MeetingDoc } from "../models/Meeting";
import { Meeting } from "../models/Meeting";
import { User } from "../models/User";
import { now } from "../utils/clock";
import { conflict, forbidden, notFound, unprocessable } from "../utils/errors";
import { loadAccessibleMeeting, meetingScope } from "./access";
import {
  createFollowUp,
  type FollowUpInput,
  validateFollowUpInput,
} from "./followUpService";

// ---------------------------------------------------------------- helpers

const clean = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const entry = (
  at: Date,
  actor: Actor,
  action: string,
  from: MeetingStatus | null,
  to: MeetingStatus,
  note?: string,
  meta?: Record<string, unknown>,
) => ({
  at,
  by: new Types.ObjectId(actor.id),
  action,
  from,
  to,
  ...(note !== undefined ? { note } : {}),
  ...(meta !== undefined ? { meta } : {}),
});

const isDuplicateKey = (e: any) => e?.code === 11000;

/** Compare-and-set update; 409 if the meeting no longer matches what we validated against. */
async function atomic(
  filter: QueryFilter<any>,
  update: UpdateQuery<any>,
): Promise<MeetingDoc> {
  try {
    const doc = await Meeting.findOneAndUpdate(filter, update, { new: true });
    if (!doc) {
      throw conflict(
        "STALE_STATE",
        "The meeting was changed by someone else. Reload and try again.",
      );
    }
    return doc;
  } catch (e) {
    if (isDuplicateKey(e)) {
      throw conflict(
        "ALREADY_CHECKED_IN",
        "You are already checked in to another meeting. Check out first.",
      );
    }
    throw e;
  }
}

function assertAssignee(actor: Actor, m: MeetingDoc) {
  // Check-in/out carry location evidence, so only the assigned person may perform on-site actions;
  // not even admins or managers can act on someone else's behalf.
  if (String(m.assignedTo) !== actor.id) {
    throw forbidden(
      "Only the assigned sales employee can perform this action",
      "NOT_ASSIGNEE",
    );
  }
}

async function assertNoOverlap(
  userId: string | Types.ObjectId,
  start: Date,
  end: Date,
  excludeId?: Types.ObjectId,
) {
  const clash = await Meeting.findOne({
    assignedTo: userId,
    status: { $in: ACTIVE_STATUSES },
    scheduledStart: { $lt: end },
    scheduledEnd: { $gt: start },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  if (clash && overlaps(start, end, clash.scheduledStart, clash.scheduledEnd)) {
    throw unprocessable(
      "MEETING_OVERLAP",
      "The employee already has a meeting in this time slot",
      {
        conflictingMeetingId: String(clash._id),
      },
    );
  }
}

async function resolveAssignee(actor: Actor, requested?: string) {
  const targetId = requested ?? actor.id;
  const user = await User.findById(targetId);
  if (!user || !user.isActive)
    throw unprocessable("ASSIGNEE_NOT_FOUND", "Assignee not found or inactive");
  if (user.role === "admin")
    throw unprocessable(
      "ASSIGNEE_INVALID_ROLE",
      "Meetings can only be assigned to sales staff",
    );
  if (actor.role === "employee" && user.id !== actor.id) {
    throw forbidden("Employees can only schedule meetings for themselves");
  }
  if (
    actor.role === "manager" &&
    user.id !== actor.id &&
    String(user.managerId) !== actor.id
  ) {
    throw forbidden("Managers can only schedule meetings for their own team");
  }
  return user;
}

// ---------------------------------------------------------------- create / read

export interface CreateMeetingInput {
  accountId: string;
  contactId: string;
  purpose: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location: string;
  assignedTo?: string;
  notes?: string;
}

export async function createMeeting(
  actor: Actor,
  input: CreateMeetingInput,
): Promise<MeetingDoc> {
  const t = now();
  assertValidWindow(input.scheduledStart, input.scheduledEnd);
  assertNotInPast(input.scheduledStart, t);

  const account = await Account.findById(input.accountId);
  if (!account) throw notFound("ACCOUNT_NOT_FOUND", "Account not found");
  const contact = account.contacts.id(input.contactId);
  if (!contact)
    throw unprocessable(
      "CONTACT_NOT_IN_ACCOUNT",
      "The contact does not belong to this account",
    );

  const assignee = await resolveAssignee(actor, input.assignedTo);
  await assertNoOverlap(assignee._id, input.scheduledStart, input.scheduledEnd);

  return Meeting.create({
    accountId: account._id,
    contactId: contact._id,
    contactName: contact.name,
    purpose: input.purpose,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    location: input.location,
    assignedTo: assignee._id,
    createdBy: actor.id,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    status: "scheduled",
    history: [entry(t, actor, "created", null, "scheduled")],
  });
}

/** What the *viewer* may do next; lets the UI render buttons without re-implementing the rules. */
function allowedActions(
  m: MeetingDoc,
  actor: Actor,
  assigneeManagerId?: string | null,
): string[] {
  const out: string[] = [];
  const isAssignee = String(m.assignedTo) === actor.id;
  const s = m.status;
  if (s === "scheduled") out.push("confirm");
  if (s === "scheduled" || s === "confirmed") out.push("reschedule");
  if (["scheduled", "confirmed", "on_hold"].includes(s)) out.push("cancel");
  if (s !== "completed" && s !== "cancelled") out.push("update_details");
  if (isAssignee) {
    if (s === "confirmed" || s === "on_hold") out.push("check_in");
    if (s === "checked_in") out.push("start");
    if (s === "checked_in" || s === "in_progress") out.push("check_out");
    if (s === "confirmed" || s === "on_hold")
      out.push("complete_unable_to_meet");
  }
  if (s === "completed") {
    const isManagerOf =
      actor.role === "manager" && !isAssignee && assigneeManagerId === actor.id;
    if (actor.role === "admin" || isManagerOf) out.push("reopen");
  }
  return out;
}

async function present(meetings: MeetingDoc[], actor: Actor) {
  const accountIds = [...new Set(meetings.map((m) => String(m.accountId)))];
  const userIds = [...new Set(meetings.map((m) => String(m.assignedTo)))];
  const [accounts, users] = await Promise.all([
    Account.find({ _id: { $in: accountIds } })
      .select("name")
      .lean(),
    User.find({ _id: { $in: userIds } })
      .select("name email managerId")
      .lean(),
  ]);
  const accMap = new Map(accounts.map((a) => [String(a._id), a.name]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  return meetings.map((m) => {
    const assignee = userMap.get(String(m.assignedTo));
    return {
      ...m.toJSON(),
      account: {
        id: String(m.accountId),
        name: accMap.get(String(m.accountId)) ?? null,
      },
      assignee: {
        id: String(m.assignedTo),
        name: assignee?.name ?? null,
        email: assignee?.email ?? null,
      },
      totalOnSiteMinutes: Math.round(m.totalOnSiteMs / 60000),
      allowedActions: allowedActions(
        m,
        actor,
        assignee?.managerId ? String(assignee.managerId) : null,
      ),
    };
  });
}

export async function getMeeting(actor: Actor, id: string) {
  const m = await loadAccessibleMeeting(actor, id);
  return (await present([m], actor))[0];
}

export interface ListQuery {
  status?: MeetingStatus;
  assignedTo?: string;
  accountId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function listMeetings(actor: Actor, q: ListQuery) {
  const filter: QueryFilter<any> = { ...(await meetingScope(actor)) };
  if (q.assignedTo) {
    // Narrow within scope, never widen it: intersect with whatever the scope already allows.
    const scoped = filter.assignedTo as { $in: string[] } | undefined;
    if (scoped && !scoped.$in.includes(q.assignedTo))
      return { items: [], total: 0, page: q.page, limit: q.limit };
    filter.assignedTo = q.assignedTo;
  }
  if (q.status) filter.status = q.status;
  if (q.accountId) filter.accountId = q.accountId;
  if (q.from || q.to) {
    filter.scheduledStart = {
      ...(q.from ? { $gte: q.from } : {}),
      ...(q.to ? { $lte: q.to } : {}),
    };
  }
  const [docs, total] = await Promise.all([
    Meeting.find(filter)
      .sort({ scheduledStart: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
    Meeting.countDocuments(filter),
  ]);
  return {
    items: await present(docs, actor),
    total,
    page: q.page,
    limit: q.limit,
  };
}

// ---------------------------------------------------------------- editing

export async function updateDetails(
  actor: Actor,
  id: string,
  patch: {
    purpose?: string;
    location?: string;
    notes?: string;
    contactId?: string;
  },
): Promise<MeetingDoc> {
  const m = await loadAccessibleMeeting(actor, id);
  if (m.status === "completed" || m.status === "cancelled") {
    throw conflict(
      "MEETING_LOCKED",
      `A ${m.status} meeting cannot be edited${m.status === "completed" ? " (ask a manager to reopen it)" : ""}`,
    );
  }
  // Notes may change any time while the meeting is open; the "what/where/who" only before anyone is on site.
  const onSite = m.status === "checked_in" || m.status === "in_progress";
  if (onSite && (patch.purpose || patch.location || patch.contactId)) {
    throw conflict(
      "MEETING_ON_SITE",
      "Purpose, location and contact cannot be changed while the meeting is under way",
    );
  }
  const set: Record<string, unknown> = clean({
    purpose: patch.purpose,
    location: patch.location,
    notes: patch.notes,
  });
  if (patch.contactId) {
    const account = await Account.findById(m.accountId);
    const contact = account?.contacts.id(patch.contactId);
    if (!contact)
      throw unprocessable(
        "CONTACT_NOT_IN_ACCOUNT",
        "The contact does not belong to this account",
      );
    set.contactId = contact._id;
    set.contactName = contact.name;
  }
  return atomic({ _id: m._id, status: m.status }, { $set: set });
}

export async function confirmMeeting(
  actor: Actor,
  id: string,
): Promise<MeetingDoc> {
  const m = await loadAccessibleMeeting(actor, id);
  assertTransition(m.status, "confirmed");
  return atomic(
    { _id: m._id, status: m.status },
    {
      $set: { status: "confirmed" },
      $push: {
        history: entry(now(), actor, "confirmed", m.status, "confirmed"),
      },
    },
  );
}

export async function rescheduleMeeting(
  actor: Actor,
  id: string,
  input: { scheduledStart: Date; scheduledEnd: Date; reason?: string },
): Promise<MeetingDoc> {
  const m = await loadAccessibleMeeting(actor, id);
  if (m.status !== "scheduled" && m.status !== "confirmed") {
    throw conflict(
      "INVALID_TRANSITION",
      "Only scheduled or confirmed meetings can be rescheduled; once visited, use the return-visit flow",
      {
        from: m.status,
      },
    );
  }
  const t = now();
  assertValidWindow(input.scheduledStart, input.scheduledEnd);
  assertNotInPast(input.scheduledStart, t);
  await assertNoOverlap(
    m.assignedTo,
    input.scheduledStart,
    input.scheduledEnd,
    m._id,
  );
  // Moving the slot invalidates the customer's earlier confirmation, so we fall back to "scheduled".
  return atomic(
    { _id: m._id, status: m.status },
    {
      $set: {
        status: "scheduled",
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
      },
      $inc: { rescheduleCount: 1 },
      $push: {
        history: entry(
          t,
          actor,
          "rescheduled",
          m.status,
          "scheduled",
          input.reason,
          {
            previousStart: m.scheduledStart,
            previousEnd: m.scheduledEnd,
          },
        ),
      },
    },
  );
}

export async function cancelMeeting(
  actor: Actor,
  id: string,
  reason: string,
): Promise<MeetingDoc> {
  const m = await loadAccessibleMeeting(actor, id);
  assertTransition(m.status, "cancelled"); // checked_in / in_progress / completed cannot be cancelled
  return atomic(
    { _id: m._id, status: m.status },
    {
      $set: { status: "cancelled", cancelReason: reason, onSite: false },
      $unset: { nextVisitAt: 1 },
      $push: {
        history: entry(
          now(),
          actor,
          "cancelled",
          m.status,
          "cancelled",
          reason,
        ),
      },
    },
  );
}

// ---------------------------------------------------------------- on-site flow

export async function checkIn(
  actor: Actor,
  id: string,
  location: GeoPoint,
): Promise<MeetingDoc> {
  const m = await loadAccessibleMeeting(actor, id);
  assertAssignee(actor, m);
  const t = now();
  const { expectedAt, lateMinutes, isReturn } = evaluateCheckIn(
    {
      status: m.status,
      scheduledStart: m.scheduledStart,
      scheduledEnd: m.scheduledEnd,
      nextVisitAt: m.nextVisitAt ?? null,
      visitCount: m.visits.length,
    },
    t,
  );
  // Friendly pre-check; the unique partial index is the real guarantee under concurrency.
  const other = await Meeting.findOne({
    assignedTo: m.assignedTo,
    onSite: true,
    _id: { $ne: m._id },
  }).lean();
  if (other) {
    throw conflict(
      "ALREADY_CHECKED_IN",
      "You are already checked in to another meeting. Check out first.",
      {
        meetingId: String(other._id),
      },
    );
  }
  return atomic(
    { _id: m._id, status: m.status },
    {
      $set: { status: "checked_in", onSite: true },
      $unset: { nextVisitAt: 1 },
      $push: {
        visits: {
          checkInAt: t,
          checkInLocation: clean({ ...location }),
          expectedAt,
          lateMinutes,
        },
        history: entry(
          t,
          actor,
          isReturn ? "return_check_in" : "check_in",
          m.status,
          "checked_in",
          undefined,
          {
            lateMinutes,
            visitNo: m.visits.length + 1,
          },
        ),
      },
    },
  );
}

export async function startMeeting(
  actor: Actor,
  id: string,
): Promise<MeetingDoc> {
  const m = await loadAccessibleMeeting(actor, id);
  assertAssignee(actor, m);
  assertTransition(m.status, "in_progress");
  const t = now();
  const idx = m.visits.length - 1;
  return atomic(
    {
      _id: m._id,
      status: "checked_in",
      [`visits.${idx}.checkOutAt`]: { $exists: false },
    },
    {
      $set: { status: "in_progress", [`visits.${idx}.startedAt`]: t },
      $push: { history: entry(t, actor, "start", "checked_in", "in_progress") },
    },
  );
}

export type CheckOutInput =
  | {
      disposition: "complete";
      location: GeoPoint;
      outcome: Outcome;
      outcomeNotes?: string;
      followUp?: FollowUpInput;
    }
  | {
      disposition: "return_later";
      location: GeoPoint;
      returnAt: Date;
      reason?: string;
    };

export async function checkOut(actor: Actor, id: string, input: CheckOutInput) {
  const m = await loadAccessibleMeeting(actor, id);
  assertAssignee(actor, m);
  if (m.status !== "checked_in" && m.status !== "in_progress") {
    throw conflict("NOT_ON_SITE", "You are not checked in to this meeting", {
      status: m.status,
    });
  }
  const t = now();
  const idx = m.visits.length - 1;
  const visit = m.visits[idx];

  if (!visit) {
    throw conflict(
      "VISIT_NOT_FOUND",
      "No active visit was found for this meeting.",
    );
  }
  const durationMs = Math.max(0, t.getTime() - visit.checkInAt.getTime());
  const visitFilter = { [`visits.${idx}.checkOutAt`]: { $exists: false } };
  const closeVisit = (reason: VisitEndReason) => ({
    [`visits.${idx}.checkOutAt`]: t,
    [`visits.${idx}.checkOutLocation`]: clean({ ...input.location }),
    [`visits.${idx}.endReason`]: reason,
  });

  if (input.disposition === "return_later") {
    // The 10:40 "come back at 3 PM" case: close this visit, remember the agreed time, wait for a return visit.
    assertReturnAt(input.returnAt, t);
    const clash = await Meeting.findOne({
      assignedTo: m.assignedTo,
      _id: { $ne: m._id },
      status: { $in: ACTIVE_STATUSES },
      scheduledStart: { $lte: input.returnAt },
      scheduledEnd: { $gt: input.returnAt },
    }).lean();
    if (clash) {
      throw unprocessable(
        "RETURN_TIME_CONFLICT",
        "You already have another meeting at the agreed return time",
        {
          conflictingMeetingId: String(clash._id),
        },
      );
    }
    const meeting = await atomic(
      { _id: m._id, status: m.status, ...visitFilter },
      {
        $set: {
          status: "on_hold",
          onSite: false,
          nextVisitAt: input.returnAt,
          ...closeVisit("return_later"),
        },
        $inc: { totalOnSiteMs: durationMs },
        $push: {
          history: entry(
            t,
            actor,
            "check_out_return_later",
            m.status,
            "on_hold",
            input.reason,
            {
              returnAt: input.returnAt,
            },
          ),
        },
      },
    );
    return { meeting, followUp: null };
  }

  // disposition === 'complete'
  assertCanComplete(m.status, input.outcome, {
    now: t,
    scheduledStart: m.scheduledStart,
  });
  return finalizeCompletion(actor, m, t, input, {
    set: closeVisit(
      input.outcome === "unable_to_meet" ? "unable_to_meet" : "completed",
    ),
    inc: { totalOnSiteMs: durationMs },
    filter: visitFilter,
    action: "check_out_complete",
  });
}

/** Customer never showed up / could not meet: record "Unable to meet" without any on-site visit. */
export async function completeWithoutVisit(
  actor: Actor,
  id: string,
  input: { outcome: Outcome; outcomeNotes?: string; followUp?: FollowUpInput },
) {
  const m = await loadAccessibleMeeting(actor, id);
  assertAssignee(actor, m);
  if (m.status !== "confirmed" && m.status !== "on_hold") {
    throw conflict(
      "INVALID_TRANSITION",
      "Use check-out to complete a meeting you are checked in to",
      { from: m.status },
    );
  }
  const t = now();
  assertCanComplete(m.status, input.outcome, {
    now: t,
    scheduledStart: m.scheduledStart,
  });
  return finalizeCompletion(actor, m, t, input, {
    action: "complete_without_visit",
  });
}

async function finalizeCompletion(
  actor: Actor,
  m: MeetingDoc,
  t: Date,
  input: { outcome: Outcome; outcomeNotes?: string; followUp?: FollowUpInput },
  extra: {
    set?: Record<string, unknown>;
    inc?: Record<string, unknown>;
    filter?: Record<string, unknown>;
    action: string;
  },
): Promise<{ meeting: MeetingDoc; followUp: FollowUpDoc | null }> {
  assertFollowUpPresence(input.outcome, !!input.followUp);
  const completionNo = m.completionCount + 1;

  let followUp: FollowUpDoc | null = null;
  if (input.followUp) {
    await validateFollowUpInput(input.followUp, m, t);
    followUp = await createFollowUp(
      actor,
      m,
      input.followUp,
      "outcome",
      completionNo,
    );
  }
  try {
    const meeting = await atomic(
      { _id: m._id, status: m.status, ...(extra.filter ?? {}) },
      {
        $set: {
          status: "completed",
          onSite: false,
          outcome: input.outcome,
          ...clean({ outcomeNotes: input.outcomeNotes }),
          completedAt: t,
          ...(extra.set ?? {}),
        },
        $unset: { nextVisitAt: 1 },
        $inc: { completionCount: 1, ...(extra.inc ?? {}) },
        $push: {
          history: entry(
            t,
            actor,
            extra.action,
            m.status,
            "completed",
            input.outcomeNotes,
            {
              outcome: input.outcome,
              followUpId: followUp ? String(followUp._id) : undefined,
            },
          ),
        },
      },
    );
    return { meeting, followUp };
  } catch (e) {
    // Compensate: don't leave an orphan follow-up for a completion that never happened.
    if (followUp) await FollowUp.deleteOne({ _id: followUp._id });
    throw e;
  }
}

// ---------------------------------------------------------------- manager action

export async function reopenMeeting(
  actor: Actor,
  id: string,
  reason: string,
): Promise<MeetingDoc> {
  if (actor.role === "employee")
    throw forbidden("Only a manager or admin can reopen a completed meeting");
  const m = await loadAccessibleMeeting(actor, id);
  if (m.status !== "completed") {
    throw conflict(
      "INVALID_TRANSITION",
      "Only a completed meeting can be reopened",
      { from: m.status },
    );
  }

  if (actor.role === "manager") {
    // Separation of duties: a manager reopens their team's meetings, never their own.
    if (String(m.assignedTo) === actor.id) {
      throw forbidden(
        "You cannot reopen your own meeting; ask another manager or an admin",
        "SELF_REOPEN",
      );
    }
    assertWithinReopenWindow(m.completedAt, now());
  }
  const t = now();
  const meeting = await atomic(
    { _id: m._id, status: "completed" },
    {
      $set: { status: "on_hold", onSite: false },
      $unset: { outcome: 1, outcomeNotes: 1, completedAt: 1, nextVisitAt: 1 },
      $inc: { reopenCount: 1 },
      $push: {
        history: entry(t, actor, "reopened", "completed", "on_hold", reason, {
          previousOutcome: m.outcome,
          previousOutcomeNotes: m.outcomeNotes,
        }),
      },
    },
  );
  // The outcome that justified these follow-ups no longer stands; manual follow-ups are left alone.
  await FollowUp.updateMany(
    {
      meetingId: m._id,
      source: "outcome",
      completionNo: m.completionCount,
      status: "open",
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: t,
        cancelReason: "Meeting was reopened",
      },
    },
  );
  return meeting;
}
