export type Role = "employee" | "manager" | "admin";
export type MeetingStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";
export type Outcome =
  | "interested"
  | "follow_up_required"
  | "proposal_requested"
  | "not_interested"
  | "unable_to_meet";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
  isActive: boolean;
}
export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface Visit {
  checkInAt: string;
  checkInLocation: GeoPoint;
  expectedAt?: string;
  lateMinutes?: number;
  startedAt?: string;
  checkOutAt?: string;
  checkOutLocation?: GeoPoint;
  endReason?: string;
}
export interface HistoryEntry {
  at: string;
  by: string;
  action: string;
  from: MeetingStatus | null;
  to: MeetingStatus;
  note?: string;
  meta?: Record<string, unknown>;
}
export interface Meeting {
  id: string;
  accountId: string;
  contactId: string;
  contactName: string;
  purpose: string;
  scheduledStart: string;
  scheduledEnd: string;
  location: string;
  assignedTo: string;
  notes?: string;
  status: MeetingStatus;
  nextVisitAt?: string;
  visits: Visit[];
  totalOnSiteMinutes: number;
  outcome?: Outcome;
  outcomeNotes?: string;
  completedAt?: string;
  reopenCount: number;
  rescheduleCount: number;
  cancelReason?: string;
  history: HistoryEntry[];
  account: { id: string; name: string | null };
  assignee: { id: string; name: string | null; email: string | null };
  allowedActions: string[];
}
export interface Contact {
  id: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
}
export interface Account {
  id: string;
  name: string;
  address?: string;
  industry?: string;
  contacts: Contact[];
}
export interface FollowUp {
  id: string;
  meetingId: string;
  accountId: string;
  ownerId: string;
  createdBy: string;
  description: string;
  dueDate: string;
  status: "open" | "done" | "cancelled";
  overdue: boolean;
  source: "outcome" | "manual";
  completionNote?: string;
  cancelReason?: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
