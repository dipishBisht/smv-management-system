import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { env } from '../config/env';
import { User } from '../models/User';
import { unauthorized } from '../utils/errors';

export async function login(email: string, password: string) {
  const user = await User.findOne({
    email: email.toLowerCase(),
  }).select('+passwordHash');

  const ok =
    user &&
    user.isActive &&
    (await bcrypt.compare(password, user.passwordHash));

  if (!user || !ok) {
    throw unauthorized('Invalid email or password');
  }

  const expiresIn: NonNullable<SignOptions['expiresIn']> =
    (env.jwtExpiresIn ?? '1d') as StringValue;

  const token = jwt.sign(
    { role: user.role },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn,
    },
  );

  return {
    token,
    user: user.toJSON(),
  };
}

export const hashPassword = (plain: string) =>
  bcrypt.hash(plain, 10);