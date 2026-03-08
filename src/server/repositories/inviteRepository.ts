/**
 * Invites repository. Invite codes are stored hashed (codeHash); never store raw code.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import type { Invite } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { hashInviteCode } from '../lib/authCrypto';

const COL = MONGO_COLLECTIONS.INVITES;

export async function findInviteByCodeHash(codeHash: string): Promise<Invite | null> {
  const db = await getDb();
  const doc = await db.collection(COL).findOne({ codeHash });
  if (!doc) return null;
  return doc as unknown as Invite;
}

export async function createInvite(params: {
  householdId: string;
  codeHash: string;
  role: 'admin' | 'member';
  maxUses: number;
  expiresAt: string;
  createdByUserId: string;
}): Promise<Invite> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const doc = {
    _id: id,
    householdId: params.householdId,
    codeHash: params.codeHash,
    role: params.role,
    maxUses: params.maxUses,
    uses: 0,
    expiresAt: params.expiresAt,
    createdAt: now,
    createdByUserId: params.createdByUserId,
  };
  await db.collection(COL).insertOne(doc as any);
  return doc as unknown as Invite;
}

/** Create invite from raw code (hashes before storing). Returns the invite and the raw code to return once to caller. */
export async function createInviteWithCode(params: {
  householdId: string;
  role: 'admin' | 'member';
  maxUses: number;
  expiresAt: string;
  createdByUserId: string;
  rawCode: string;
}): Promise<{ invite: Invite; rawCode: string }> {
  const codeHash = hashInviteCode(params.rawCode);
  const invite = await createInvite({
    householdId: params.householdId,
    codeHash,
    role: params.role,
    maxUses: params.maxUses,
    expiresAt: params.expiresAt,
    createdByUserId: params.createdByUserId,
  });
  return { invite, rawCode: params.rawCode };
}

export async function incrementInviteUses(inviteId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COL).updateOne(
    { _id: inviteId } as any,
    { $inc: { uses: 1 } }
  );
}

export async function revokeInvite(inviteId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection(COL).updateOne(
    { _id: inviteId } as any,
    { $set: { revokedAt: new Date().toISOString() } }
  );
  return result.matchedCount > 0;
}

export async function findInviteById(inviteId: string): Promise<Invite | null> {
  const db = await getDb();
  const doc = await db.collection(COL).findOne({ _id: inviteId } as any);
  if (!doc) return null;
  return doc as unknown as Invite;
}

export async function listInvitesByHousehold(householdId: string): Promise<Invite[]> {
  const db = await getDb();
  const docs = await db.collection(COL).find({ householdId }).sort({ createdAt: -1 }).toArray();
  return docs as unknown as Invite[];
}
