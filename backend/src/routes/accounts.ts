import { Router } from 'express';
import { actorOf, authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Account } from '../models/Account';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound } from '../utils/errors';
import { isObjectId } from '../services/access';
import {
  addContactBody,
  createAccountBody,
  idParam,
  listAccountsQuery,
  updateAccountBody,
} from '../validators/schemas';

export const accountsRouter = Router();
accountsRouter.use(authenticate);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

accountsRouter.get(
  '/',
  validate({ query: listAccountsQuery }),
  asyncHandler(async (req, res) => {
    const { search, page, limit } = req.query as unknown as { search?: string; page: number; limit: number };
    const filter = search ? { name: new RegExp(escapeRegex(search), 'i') } : {};
    const [items, total] = await Promise.all([
      Account.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Account.countDocuments(filter),
    ]);
    res.json({ items: items.map((a) => a.toJSON()), total, page, limit });
  }),
);

accountsRouter.post(
  '/',
  validate({ body: createAccountBody }),
  asyncHandler(async (req, res) => {
    const account = await Account.create({ ...req.body, createdBy: actorOf(req).id });
    res.status(201).json({ account: account.toJSON() });
  }),
);

accountsRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const account = isObjectId(req.params.id) ? await Account.findById(req.params.id) : null;
    if (!account) throw notFound('ACCOUNT_NOT_FOUND', 'Account not found');
    res.json({ account: account.toJSON() });
  }),
);

accountsRouter.patch(
  '/:id',
  requireRole('manager', 'admin'),
  validate({ params: idParam, body: updateAccountBody }),
  asyncHandler(async (req, res) => {
    const account = await Account.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!account) throw notFound('ACCOUNT_NOT_FOUND', 'Account not found');
    res.json({ account: account.toJSON() });
  }),
);

accountsRouter.post(
  '/:id/contacts',
  validate({ params: idParam, body: addContactBody }),
  asyncHandler(async (req, res) => {
    const account = await Account.findByIdAndUpdate(req.params.id, { $push: { contacts: req.body } }, { new: true });
    if (!account) throw notFound('ACCOUNT_NOT_FOUND', 'Account not found');
    res.status(201).json({ account: account.toJSON() });
  }),
);
