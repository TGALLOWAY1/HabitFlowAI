/**
 * Admin invite management: create, list, revoke.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import {
  createInviteWithCode,
  listInvitesByHousehold,
  findInviteById,
  revokeInvite,
} from '../repositories/inviteRepository';
import { generateInviteCode } from '../lib/authCrypto';

/**
 * POST /api/admin/invites
 * Body: { maxUses, expiresAt, role? }
 * Creates invite for admin's household; returns invite + rawCode (show once).
 */
export async function postCreateInvite(req: Request, res: Response): Promise<void> {
  const { householdId, userId } = getRequestIdentity(req);
  const body = req.body ?? {};
  const maxUses = body.maxUses;
  const expiresAt = body.expiresAt;
  const role = body.role === 'admin' ? 'admin' : 'member';

  if (typeof maxUses !== 'number' || maxUses < 1) {
    res.status(400).json({ error: 'maxUses must be a positive number.' });
    return;
  }
  const expiresAtStr =
    typeof expiresAt === 'string' ? expiresAt : body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  if (!expiresAtStr || Number.isNaN(Date.parse(expiresAtStr))) {
    res.status(400).json({ error: 'expiresAt must be a valid ISO date string.' });
    return;
  }

  const rawCode = generateInviteCode();
  const { invite } = await createInviteWithCode({
    householdId,
    role,
    maxUses,
    expiresAt: expiresAtStr,
    createdByUserId: userId,
    rawCode,
  });

  res.status(201).json({
    invite: {
      id: invite._id,
      householdId: invite.householdId,
      role: invite.role,
      maxUses: invite.maxUses,
      uses: invite.uses,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      createdByUserId: invite.createdByUserId,
    },
    code: rawCode,
  });
}

/**
 * GET /api/admin/invites
 * List invites for admin's household (no raw codes).
 */
export async function getInvites(req: Request, res: Response): Promise<void> {
  const { householdId } = getRequestIdentity(req);
  const invites = await listInvitesByHousehold(householdId);
  res.status(200).json({
    invites: invites.map((inv) => ({
      id: inv._id,
      householdId: inv.householdId,
      role: inv.role,
      maxUses: inv.maxUses,
      uses: inv.uses,
      expiresAt: inv.expiresAt,
      revokedAt: inv.revokedAt,
      createdAt: inv.createdAt,
      createdByUserId: inv.createdByUserId,
    })),
  });
}

/**
 * POST /api/admin/invites/:id/revoke
 */
export async function postRevokeInvite(req: Request, res: Response): Promise<void> {
  const { householdId } = getRequestIdentity(req);
  const inviteId = req.params.id;
  if (!inviteId) {
    res.status(400).json({ error: 'Invite ID required.' });
    return;
  }
  const invite = await findInviteById(inviteId);
  if (!invite) {
    res.status(404).json({ error: 'Invite not found.' });
    return;
  }
  if (invite.householdId !== householdId) {
    res.status(403).json({ error: 'Cannot revoke invite from another household.' });
    return;
  }
  const ok = await revokeInvite(inviteId);
  res.status(200).json({ revoked: ok });
}
