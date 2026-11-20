export const ROLES = ["employee", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const MEETING_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "on_hold", // awaiting a return visit (customer asked us to come back, or a manager reopened the meeting)
  "completed",
  "cancelled",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const OUTCOMES = [
  "interested",
  "follow_up_required",
  "proposal_requested",
  "not_interested",
  "unable_to_meet",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const VISIT_END_REASONS = [
  "completed",
  "return_later",
  "unable_to_meet",
] as const;
export type VisitEndReason = (typeof VISIT_END_REASONS)[number];

export const FOLLOW_UP_STATUSES = ["open", "done", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/** Statuses in which a meeting still occupies its scheduled slot in the employee's calendar. */
export const ACTIVE_STATUSES: MeetingStatus[] = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "on_hold",
];
