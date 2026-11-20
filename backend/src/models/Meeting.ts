import { type HydratedDocument, Schema, Types, model } from "mongoose";
import {
  MEETING_STATUSES,
  OUTCOMES,
  VISIT_END_REASONS,
} from "../domain/constants";
import type {
  MeetingStatus,
  Outcome,
  VisitEndReason,
} from "../domain/constants";

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** One continuous stay on site. A meeting can have several (e.g. morning visit + afternoon return). */
export interface Visit {
  checkInAt: Date;
  checkInLocation: GeoPoint;
  /** When we expected this visit to start (scheduledStart or the agreed return time). */
  expectedAt?: Date;
  lateMinutes?: number;
  /** When the conversation actually started (status -> in_progress). */
  startedAt?: Date;
  checkOutAt?: Date;
  checkOutLocation?: GeoPoint;
  endReason?: VisitEndReason;
}

export interface HistoryEntry {
  at: Date;
  by: Types.ObjectId;
  action: string;
  from: MeetingStatus | null;
  to: MeetingStatus;
  note?: string;
  meta?: Record<string, unknown>;
}

export interface IMeeting {
  accountId: Types.ObjectId;
  contactId: Types.ObjectId;
  contactName: string; // snapshot, so history stays readable if the contact is edited later
  purpose: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location: string;
  assignedTo: Types.ObjectId;
  createdBy: Types.ObjectId;
  notes?: string;

  status: MeetingStatus;
  /** True while the employee is physically checked in (checked_in / in_progress). Backs a unique index. */
  onSite: boolean;
  /** Agreed return time after a "come back later" check-out. */
  nextVisitAt?: Date;
  visits: Visit[];
  totalOnSiteMs: number;

  outcome?: Outcome;
  outcomeNotes?: string;
  completedAt?: Date;
  completionCount: number;
  reopenCount: number;
  rescheduleCount: number;
  cancelReason?: string;

  history: HistoryEntry[];
}

const GeoSchema = new Schema<GeoPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: Number,
  },
  { _id: false },
);

const VisitSchema = new Schema<Visit>(
  {
    checkInAt: { type: Date, required: true },
    checkInLocation: { type: GeoSchema, required: true },
    expectedAt: Date,
    lateMinutes: Number,
    startedAt: Date,
    checkOutAt: Date,
    checkOutLocation: GeoSchema,
    endReason: { type: String, enum: VISIT_END_REASONS },
  },
  { toJSON: { virtuals: false, versionKey: false } },
);

const HistorySchema = new Schema<HistoryEntry>(
  {
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    from: { type: String, enum: [...MEETING_STATUSES, null], default: null },
    to: { type: String, enum: MEETING_STATUSES, required: true },
    note: String,
    meta: Schema.Types.Mixed,
  },
  { _id: false },
);

const MeetingSchema = new Schema<IMeeting>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    contactId: { type: Schema.Types.ObjectId, required: true },
    contactName: { type: String, required: true },
    purpose: { type: String, required: true, trim: true, maxlength: 300 },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, maxlength: 2000 },

    status: {
      type: String,
      enum: MEETING_STATUSES,
      default: "scheduled",
      index: true,
    },
    onSite: { type: Boolean, default: false },
    nextVisitAt: Date,
    visits: { type: [VisitSchema], default: [] },
    totalOnSiteMs: { type: Number, default: 0 },

    outcome: { type: String, enum: OUTCOMES },
    outcomeNotes: { type: String, maxlength: 2000 },
    completedAt: Date,
    completionCount: { type: Number, default: 0 },
    reopenCount: { type: Number, default: 0 },
    rescheduleCount: { type: Number, default: 0 },
    cancelReason: String,

    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

MeetingSchema.index({ assignedTo: 1, scheduledStart: 1 });
/**
 * Hard guarantee (even under concurrent requests, without transactions): an employee can be
 * physically checked in to at most ONE meeting at a time.
 */
MeetingSchema.index(
  { assignedTo: 1 },
  {
    unique: true,
    partialFilterExpression: { onSite: true },
    name: "one_active_visit_per_employee",
  },
);

export type MeetingDoc = HydratedDocument<IMeeting>;
export const Meeting = model<IMeeting>("Meeting", MeetingSchema);
