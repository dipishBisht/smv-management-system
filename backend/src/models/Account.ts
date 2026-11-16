import { type HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IContact {
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
}

export interface IAccount {
  name: string;
  address?: string;
  industry?: string;
  contacts: Types.DocumentArray<IContact>;
  createdBy: Types.ObjectId;
}

const ContactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  { toJSON: { virtuals: true, versionKey: false } },
);

const AccountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true, trim: true, index: true },
    address: { type: String, trim: true },
    industry: { type: String, trim: true },
    contacts: { type: [ContactSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

export type AccountDoc = HydratedDocument<IAccount>;
export const Account = model<IAccount>('Account', AccountSchema);
