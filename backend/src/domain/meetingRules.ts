/**
 * Pure business rules for the meeting lifecycle. No DB, no Express, no clock access:
 * everything receives `now` explicitly so the rules are trivially unit-testable.
 */
import type { MeetingStatus, Outcome } from './constants';
import { conflict, unprocessable } from '../utils/errors';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const RULES = {
  /** Earliest a (first or return) visit may check in before its expected time. */
  CHECK_IN_EARLY_MS: 30 * MIN,
  /** First check-in is refused this long after the scheduled end; the meeting must be rescheduled. */
  CHECK_IN_LATE_MS: 2 * HOUR,
  /** Tolerance for creating a meeting that starts "now" (clock skew / form latency). */
  CREATE_GRACE_MS: 5 * MIN,
  MAX_DURATION_MS: 8 * HOUR,
  MAX_RETURN_AHEAD_MS: 14 * DAY,
  /** Managers may reopen only recently-completed meetings; admins are not limited. */
  REOPEN_WINDOW_MS: 30 * DAY,
  MAX_FOLLOW_UP_AHEAD_MS: 365 * DAY,
};

/** Allowed lifecycle transitions. Anything not listed is rejected with 409. */
const TRANSITIONS: Record<MeetingStatus, readonly MeetingStatus[]> = {
  scheduled: ['confirmed', 'cancelled'],
  // confirmed -> scheduled = reschedule (needs re-confirmation)
  // confirmed -> completed = only "unable to meet" (customer no-show), see assertCanComplete
  confirmed: ['checked_in', 'scheduled', 'completed', 'cancelled'],
  checked_in: ['in_progress', 'on_hold', 'completed'],
  in_progress: ['on_hold', 'completed'],
  // on_hold -> checked_in = the return visit
  on_hold: ['checked_in', 'completed', 'cancelled'],
  // completed -> on_hold = manager reopen
  completed: ['on_hold'],
  cancelled: [],
};

export const canTransition = (from: MeetingStatus, to: MeetingStatus) => TRANSITIONS[from].includes(to);

export function assertTransition(from: MeetingStatus, to: MeetingStatus): void {
  if (!canTransition(from, to)) {
    throw conflict('INVALID_TRANSITION', `A meeting cannot move from "${from}" to "${to}"`, { from, to });
  }
}

export function assertValidWindow(start: Date, end: Date): void {
  if (!(end.getTime() > start.getTime())) {
    throw unprocessable('INVALID_TIME_WINDOW', 'Scheduled end must be after scheduled start');
  }
  if (end.getTime() - start.getTime() > RULES.MAX_DURATION_MS) {
    throw unprocessable('MEETING_TOO_LONG', 'A meeting cannot be longer than 8 hours');
  }
}

export function assertNotInPast(start: Date, now: Date): void {
  if (start.getTime() < now.getTime() - RULES.CREATE_GRACE_MS) {
    throw unprocessable('START_IN_PAST', 'A meeting cannot be scheduled in the past');
  }
}

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();

export interface CheckInSubject {
  status: MeetingStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  nextVisitAt?: Date | null;
  visitCount: number;
}

/**
 * Decides whether a check-in is allowed right now and computes the lateness vs. what was expected:
 *  - first visit: expected at scheduledStart
 *  - return visit: expected at the agreed return time (nextVisitAt), falling back to scheduledStart
 */
export function evaluateCheckIn(m: CheckInSubject, now: Date): { expectedAt: Date; lateMinutes: number; isReturn: boolean } {
  if (m.status !== 'confirmed' && m.status !== 'on_hold') {
    throw conflict(
      'INVALID_TRANSITION',
      m.status === 'scheduled'
        ? 'The meeting must be confirmed before you can check in'
        : `A meeting in status "${m.status}" cannot be checked in to`,
      { from: m.status, to: 'checked_in' },
    );
  }
  const isReturn = m.visitCount > 0;
  const expectedAt = isReturn && m.nextVisitAt ? m.nextVisitAt : m.scheduledStart;

  if (now.getTime() < expectedAt.getTime() - RULES.CHECK_IN_EARLY_MS) {
    throw unprocessable('TOO_EARLY_TO_CHECK_IN', 'Check-in opens 30 minutes before the expected start', {
      opensAt: new Date(expectedAt.getTime() - RULES.CHECK_IN_EARLY_MS).toISOString(),
    });
  }
  // A stale, never-started meeting must be rescheduled rather than checked into days later.
  if (m.status === 'confirmed' && now.getTime() > m.scheduledEnd.getTime() + RULES.CHECK_IN_LATE_MS) {
    throw unprocessable('CHECK_IN_WINDOW_EXPIRED', 'The check-in window has passed; reschedule the meeting');
  }
  const lateMinutes = Math.max(0, Math.floor((now.getTime() - expectedAt.getTime()) / MIN));
  return { expectedAt, lateMinutes, isReturn };
}

/**
 * Completion rules:
 *  - normal completion requires the meeting to be In Progress
 *  - "unable to meet" is the one outcome that may be recorded without ever starting the meeting
 *    (customer no-show), but not before the scheduled start time
 */
export function assertCanComplete(
  from: MeetingStatus,
  outcome: Outcome,
  ctx: { now: Date; scheduledStart: Date },
): void {
  assertTransition(from, 'completed');
  if (from === 'in_progress') return;
  if (outcome !== 'unable_to_meet') {
    throw conflict(
      'MEETING_NOT_STARTED',
      'Start the meeting before completing it (only "Unable to meet" can be recorded without starting)',
      { from, outcome },
    );
  }
  if (from === 'confirmed' && ctx.now.getTime() < ctx.scheduledStart.getTime()) {
    throw unprocessable('TOO_EARLY_TO_MARK_UNABLE', 'Cannot record "Unable to meet" before the scheduled start');
  }
}

/** "Follow-up required" is meaningless without an owner and due date. */
export function assertFollowUpPresence(outcome: Outcome, hasFollowUp: boolean): void {
  if (outcome === 'follow_up_required' && !hasFollowUp) {
    throw unprocessable('FOLLOW_UP_REQUIRED', 'Outcome "follow_up_required" needs a follow-up with an owner and due date');
  }
}

export function assertFutureDueDate(due: Date, now: Date): void {
  if (due.getTime() <= now.getTime()) {
    throw unprocessable('DUE_DATE_IN_PAST', 'Follow-up due date must be in the future');
  }
  if (due.getTime() > now.getTime() + RULES.MAX_FOLLOW_UP_AHEAD_MS) {
    throw unprocessable('DUE_DATE_TOO_FAR', 'Follow-up due date cannot be more than a year away');
  }
}

export function assertReturnAt(returnAt: Date, now: Date): void {
  if (returnAt.getTime() <= now.getTime()) {
    throw unprocessable('RETURN_TIME_IN_PAST', 'The agreed return time must be in the future');
  }
  if (returnAt.getTime() > now.getTime() + RULES.MAX_RETURN_AHEAD_MS) {
    throw unprocessable('RETURN_TIME_TOO_FAR', 'A return visit cannot be more than 14 days away; reschedule instead');
  }
}

export function assertWithinReopenWindow(completedAt: Date | undefined, now: Date): void {
  if (completedAt && now.getTime() - completedAt.getTime() > RULES.REOPEN_WINDOW_MS) {
    throw unprocessable('REOPEN_WINDOW_EXPIRED', 'Meetings completed more than 30 days ago can only be reopened by an admin');
  }
}

export interface VisitLike {
  checkInAt: Date;
  checkOutAt?: Date | null;
}

/** Total time on site across all visits. An open visit counts up to `now` if provided. */
export function computeOnSiteMs(visits: VisitLike[], now?: Date): number {
  return visits.reduce((sum, v) => {
    const end = v.checkOutAt ?? now;
    return end ? sum + Math.max(0, end.getTime() - v.checkInAt.getTime()) : sum;
  }, 0);
}
