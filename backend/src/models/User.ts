import { Schema, model } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';
import { ROLES } from '../domain/constants';

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    /** Set for employees: the manager whose team they belong to. */
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_d, ret: any) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof UserSchema>>;
export const User = model('User', UserSchema);
