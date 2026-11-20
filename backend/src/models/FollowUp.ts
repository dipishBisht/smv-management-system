import { type HydratedDocument, Schema, Types, model } from "mongoose";
import { FOLLOW_UP_STATUSES, type FollowUpStatus } from "../domain/constants";

export interface IFollowUp {
  meetingId: Types.ObjectId;
  accountId: Types.ObjectId;
  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;
  description: string;
  dueDate: Date;
  status: FollowUpStatus;
  /** 'outcome' = created while recording a meeting outcome; 'manual' = added later by a user. */
  source: "outcome" | "manual";
  /** Which completion of the meeting produced it; lets a reopen cancel only the stale ones. */
  completionNo: number;
  completedAt?: Date;
  completionNote?: string;
  cancelledAt?: Date;
  cancelReason?: string;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: FOLLOW_UP_STATUSES, default: "open" },
    source: { type: String, enum: ["outcome", "manual"], required: true },
    completionNo: { type: Number, default: 0 },
    completedAt: Date,
    completionNote: String,
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

FollowUpSchema.index({ ownerId: 1, status: 1, dueDate: 1 });

export type FollowUpDoc = HydratedDocument<IFollowUp>;
export const FollowUp = model<IFollowUp>("FollowUp", FollowUpSchema);
