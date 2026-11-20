import { z } from "zod";
import {
  MEETING_STATUSES,
  OUTCOMES,
  ROLES,
  FOLLOW_UP_STATUSES,
} from "../domain/constants";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const idParam = z.object({ id: objectId });

/** ISO-8601 with timezone offset (e.g. 2026-11-16T10:00:00+05:30 or ...Z) -> Date. */
export const isoDate = z
  .string()
  .datetime({
    offset: true,
    message:
      "Must be an ISO-8601 datetime with timezone, e.g. 2026-11-16T10:00:00Z",
  })
  .transform((s) => new Date(s));

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const geoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
});

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// ---- auth / users
export const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserBody = z.object({
  name: text(2, 100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(ROLES),
  managerId: objectId.optional(),
});

export const updateUserBody = z
  .object({
    name: text(2, 100).optional(),
    role: z.enum(ROLES).optional(),
    managerId: objectId.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");

// ---- accounts
const contactBody = z.object({
  name: text(2, 100),
  designation: text(1, 100).optional(),
  email: z.string().email().optional(),
  phone: text(5, 30).optional(),
});
export const createAccountBody = z.object({
  name: text(2, 150),
  address: text(1, 300).optional(),
  industry: text(1, 100).optional(),
  contacts: z.array(contactBody).max(20).default([]),
});
export const updateAccountBody = z
  .object({
    name: text(2, 150).optional(),
    address: text(1, 300).optional(),
    industry: text(1, 100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const addContactBody = contactBody;
export const listAccountsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  ...pagination,
});

// ---- follow-ups
export const followUpInput = z.object({
  ownerId: objectId,
  dueDate: isoDate,
  description: text(3, 500),
});

export const createFollowUpBody = followUpInput.extend({ meetingId: objectId });
export const updateFollowUpBody = z
  .object({
    ownerId: objectId.optional(),
    dueDate: isoDate.optional(),
    description: text(3, 500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
export const completeFollowUpBody = z.object({ note: text(1, 500).optional() });
export const cancelFollowUpBody = z.object({ reason: text(3, 300) });
export const listFollowUpsQuery = z.object({
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
  overdue: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  ownerId: objectId.optional(),
  meetingId: objectId.optional(),
  ...pagination,
});

// ---- meetings
export const createMeetingBody = z.object({
  accountId: objectId,
  contactId: objectId,
  purpose: text(3, 300),
  scheduledStart: isoDate,
  scheduledEnd: isoDate,
  location: text(1, 200),
  assignedTo: objectId.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMeetingBody = z
  .object({
    purpose: text(3, 300).optional(),
    location: text(1, 200).optional(),
    notes: z.string().trim().max(2000).optional(),
    contactId: objectId.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");

export const rescheduleBody = z.object({
  scheduledStart: isoDate,
  scheduledEnd: isoDate,
  reason: text(3, 300).optional(),
});

export const reasonBody = z.object({ reason: text(3, 300) });
export const checkInBody = z.object({ location: geoPoint });

export const checkOutBody = z.discriminatedUnion("disposition", [
  z.object({
    disposition: z.literal("complete"),
    location: geoPoint,
    outcome: z.enum(OUTCOMES),
    outcomeNotes: z.string().trim().max(2000).optional(),
    followUp: followUpInput.optional(),
  }),
  z.object({
    disposition: z.literal("return_later"),
    location: geoPoint,
    returnAt: isoDate,
    reason: text(3, 300).optional(),
  }),
]);

export const completeWithoutVisitBody = z.object({
  outcome: z.enum(OUTCOMES),
  outcomeNotes: z.string().trim().max(2000).optional(),
  followUp: followUpInput.optional(),
});

export const listMeetingsQuery = z.object({
  status: z.enum(MEETING_STATUSES).optional(),
  assignedTo: objectId.optional(),
  accountId: objectId.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  ...pagination,
});
