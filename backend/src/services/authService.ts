import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import { unauthorized } from "../utils/errors";

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );
  // Same error for unknown email / wrong password / inactive: don't leak which accounts exist.
  const ok =
    user &&
    user.isActive &&
    (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw unauthorized("Invalid email or password");
  const token = jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn as NonNullable<SignOptions["expiresIn"]>,
  });
  return { token, user: user.toJSON() };
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
