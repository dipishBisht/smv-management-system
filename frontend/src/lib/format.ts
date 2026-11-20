import type { MeetingStatus, Outcome } from "./types";

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_progress: "In progress",
  on_hold: "Awaiting return",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const OUTCOME_LABEL: Record<Outcome, string> = {
  interested: "Interested",
  follow_up_required: "Follow-up required",
  proposal_requested: "Proposal requested",
  not_interested: "Not interested",
  unable_to_meet: "Unable to meet",
};

export const fmtTime = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtDay = (iso: string | number | Date) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
export const fmtDateTime = (iso: string | number | Date) =>
  `${fmtDay(iso)}, ${fmtTime(iso)}`;
export const dayKey = (iso: string) => new Date(iso).toDateString();

export const fmtDuration = (mins: number) => {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Date -> value for <input type="datetime-local"> (local time). */
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** datetime-local value -> ISO string with timezone (what the API requires). */
export const fromLocalInput = (v: string) => new Date(v).toISOString();

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const addHours = (d: Date, h: number) =>
  new Date(d.getTime() + h * 3_600_000);
export const roundUpToQuarter = (d: Date) => {
  const q = 15 * 60_000;
  return new Date(Math.ceil(d.getTime() / q) * q);
};

export const ACTION_LABEL: Record<string, string> = {
  created: "Meeting scheduled",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  check_in: "Checked in",
  return_check_in: "Checked in for return visit",
  start: "Meeting started",
  check_out_return_later: "Checked out, coming back later",
  check_out_complete: "Checked out and completed",
  complete_without_visit: "Completed without a visit",
  reopened: "Reopened",
};
