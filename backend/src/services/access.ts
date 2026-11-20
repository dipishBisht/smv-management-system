/**
 * Visibility rules (who may SEE what) in one place:
 *  - employee: own meetings
 *  - manager : own meetings + meetings of employees whose managerId is them
 *  - admin   : everything
 * Meetings outside a caller's scope are reported as 404, not 403, so ids can't be probed.
 */
import { Types } from "mongoose";
import type { Actor } from "../middleware/auth";
import { Meeting, type MeetingDoc } from "../models/Meeting";
import { User } from "../models/User";
import { notFound } from "../utils/errors";

export const isObjectId = (s: unknown): s is string =>
  typeof s === "string" &&
  Types.ObjectId.isValid(s) &&
  /^[a-f\d]{24}$/i.test(s);

export async function teamMemberIds(managerId: string): Promise<string[]> {
  const users = await User.find({ managerId }).select("_id").lean();
  return users.map((u) => String(u._id));
}

/** Ids of users whose data this actor may see (always includes the actor). */
export async function visibleUserIds(actor: Actor): Promise<string[] | "all"> {
  if (actor.role === "admin") return "all";
  if (actor.role === "manager")
    return [actor.id, ...(await teamMemberIds(actor.id))];
  return [actor.id];
}

export async function meetingScope(
  actor: Actor,
): Promise<Record<string, unknown>> {
  const ids = await visibleUserIds(actor);
  return ids === "all" ? {} : { assignedTo: { $in: ids } };
}

export async function loadAccessibleMeeting(
  actor: Actor,
  id: string,
): Promise<MeetingDoc> {
  if (!isObjectId(id)) throw notFound("MEETING_NOT_FOUND", "Meeting not found");
  const meeting = await Meeting.findOne({
    _id: id,
    ...(await meetingScope(actor)),
  });
  if (!meeting) throw notFound("MEETING_NOT_FOUND", "Meeting not found");
  return meeting;
}
