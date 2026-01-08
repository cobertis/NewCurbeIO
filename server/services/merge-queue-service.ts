import { db } from "../db";
import { 
  mergeQueue, 
  canonicalPersons, 
  canonicalContactPoints,
  leadOperational,
  personCompanyRelations,
  contactAttempts,
  users
} from "@shared/schema";
import { eq, and, or, ne, sql, desc, isNull } from "drizzle-orm";

export interface MergeQueueItem {
  id: string;
  companyId: string;
  personIdA: string;
  personIdB: string;
  matchReason: string;
  confidence: number;
  status: string;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  personA?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    state: string | null;
  };
  personB?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    state: string | null;
  };
  resolvedByUser?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export class MergeQueueService {
  
  async detectDuplicates(companyId: string, personId: string): Promise<{
    duplicates: Array<{ personId: string; reason: string; confidence: number }>;
  }> {
    const duplicates: Array<{ personId: string; reason: string; confidence: number }> = [];
    
    const contactPoints = await db.select()
      .from(canonicalContactPoints)
      .where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.personId, personId)
      ));
    
    for (const cp of contactPoints) {
      const matchingPoints = await db.select({
        personId: canonicalContactPoints.personId,
        type: canonicalContactPoints.type,
        value: canonicalContactPoints.value,
      })
      .from(canonicalContactPoints)
      .where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.type, cp.type),
        eq(canonicalContactPoints.value, cp.value),
        ne(canonicalContactPoints.personId, personId),
        sql`${canonicalContactPoints.personId} IS NOT NULL`
      ));
      
      for (const match of matchingPoints) {
        if (match.personId && !duplicates.some(d => d.personId === match.personId)) {
          duplicates.push({
            personId: match.personId,
            reason: cp.type === 'phone' ? 'same_phone' : 'same_email',
            confidence: cp.type === 'phone' ? 90 : 85
          });
        }
      }
    }
    
    return { duplicates };
  }
  
  async queueMerge(
    companyId: string,
    personIdA: string,
    personIdB: string,
    matchReason: string,
    confidence: number = 70
  ): Promise<{ id: string; alreadyExists: boolean }> {
    const [idLower, idHigher] = [personIdA, personIdB].sort();
    
    const existing = await db.select({ id: mergeQueue.id })
      .from(mergeQueue)
      .where(and(
        eq(mergeQueue.companyId, companyId),
        eq(mergeQueue.personIdA, idLower),
        eq(mergeQueue.personIdB, idHigher),
        eq(mergeQueue.status, 'pending')
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return { id: existing[0].id, alreadyExists: true };
    }
    
    const [inserted] = await db.insert(mergeQueue)
      .values({
        companyId,
        personIdA: idLower,
        personIdB: idHigher,
        matchReason,
        confidence,
        status: 'pending'
      })
      .returning({ id: mergeQueue.id });
    
    console.log(`[MergeQueue] Created merge task ${inserted.id}: ${matchReason} (${confidence}% confidence)`);
    
    return { id: inserted.id, alreadyExists: false };
  }
  
  async getMergeQueue(companyId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MergeQueueItem[]; total: number }> {
    const status = options?.status || 'pending';
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(mergeQueue)
      .where(and(
        eq(mergeQueue.companyId, companyId),
        eq(mergeQueue.status, status)
      ));
    
    const items = await db.select()
      .from(mergeQueue)
      .where(and(
        eq(mergeQueue.companyId, companyId),
        eq(mergeQueue.status, status)
      ))
      .orderBy(desc(mergeQueue.createdAt))
      .limit(limit)
      .offset(offset);
    
    const enrichedItems: MergeQueueItem[] = [];
    
    for (const item of items) {
      const [personA] = await db.select({
        id: canonicalPersons.id,
        firstName: canonicalPersons.firstName,
        lastName: canonicalPersons.lastName,
        city: canonicalPersons.city,
        state: canonicalPersons.state,
      })
      .from(canonicalPersons)
      .where(eq(canonicalPersons.id, item.personIdA))
      .limit(1);
      
      const [personB] = await db.select({
        id: canonicalPersons.id,
        firstName: canonicalPersons.firstName,
        lastName: canonicalPersons.lastName,
        city: canonicalPersons.city,
        state: canonicalPersons.state,
      })
      .from(canonicalPersons)
      .where(eq(canonicalPersons.id, item.personIdB))
      .limit(1);
      
      let resolvedByUser: { firstName: string | null; lastName: string | null; email: string } | undefined;
      if (item.resolvedBy) {
        const [user] = await db.select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, item.resolvedBy))
        .limit(1);
        resolvedByUser = user;
      }
      
      enrichedItems.push({
        ...item,
        personA,
        personB,
        resolvedByUser,
      });
    }
    
    return { items: enrichedItems, total: countResult?.count || 0 };
  }
  
  async resolveMerge(
    id: string, 
    action: 'merge' | 'dismiss', 
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const [queueItem] = await db.select()
      .from(mergeQueue)
      .where(eq(mergeQueue.id, id))
      .limit(1);
    
    if (!queueItem) {
      return { success: false, error: 'Merge queue item not found' };
    }
    
    if (queueItem.status !== 'pending') {
      return { success: false, error: `Already resolved with status: ${queueItem.status}` };
    }
    
    if (action === 'dismiss') {
      await db.update(mergeQueue)
        .set({
          status: 'dismissed',
          resolvedBy: userId,
          resolvedAt: new Date()
        })
        .where(eq(mergeQueue.id, id));
      
      console.log(`[MergeQueue] Dismissed merge task ${id}`);
      return { success: true };
    }
    
    if (action === 'merge') {
      const { personIdA, personIdB, companyId } = queueItem;
      const keepPersonId = personIdA;
      const mergePersonId = personIdB;
      
      await db.update(canonicalContactPoints)
        .set({ 
          personId: keepPersonId,
          updatedAt: new Date()
        })
        .where(and(
          eq(canonicalContactPoints.companyId, companyId),
          eq(canonicalContactPoints.personId, mergePersonId)
        ));
      
      await db.update(personCompanyRelations)
        .set({ personId: keepPersonId })
        .where(and(
          eq(personCompanyRelations.companyId, companyId),
          eq(personCompanyRelations.personId, mergePersonId)
        ));
      
      await db.update(contactAttempts)
        .set({ personId: keepPersonId })
        .where(and(
          eq(contactAttempts.companyId, companyId),
          eq(contactAttempts.personId, mergePersonId)
        ));
      
      const [keepOps] = await db.select()
        .from(leadOperational)
        .where(and(
          eq(leadOperational.companyId, companyId),
          eq(leadOperational.personId, keepPersonId)
        ))
        .limit(1);
      
      if (keepOps) {
        await db.delete(leadOperational)
          .where(and(
            eq(leadOperational.companyId, companyId),
            eq(leadOperational.personId, mergePersonId)
          ));
      } else {
        await db.update(leadOperational)
          .set({ personId: keepPersonId })
          .where(and(
            eq(leadOperational.companyId, companyId),
            eq(leadOperational.personId, mergePersonId)
          ));
      }
      
      await db.update(mergeQueue)
        .set({
          status: 'merged',
          resolvedBy: userId,
          resolvedAt: new Date()
        })
        .where(eq(mergeQueue.id, id));
      
      await db.update(mergeQueue)
        .set({
          status: 'dismissed',
          resolvedBy: userId,
          resolvedAt: new Date()
        })
        .where(and(
          eq(mergeQueue.companyId, companyId),
          eq(mergeQueue.status, 'pending'),
          or(
            eq(mergeQueue.personIdA, mergePersonId),
            eq(mergeQueue.personIdB, mergePersonId)
          )
        ));
      
      console.log(`[MergeQueue] Merged person ${mergePersonId} into ${keepPersonId}`);
      return { success: true };
    }
    
    return { success: false, error: 'Invalid action' };
  }
  
  async checkAndQueueDuplicateForContactPoint(
    companyId: string,
    newPersonId: string,
    existingPersonId: string,
    contactPointType: 'phone' | 'email'
  ): Promise<void> {
    if (newPersonId === existingPersonId) return;
    if (!newPersonId || !existingPersonId) return;
    
    const matchReason = contactPointType === 'phone' ? 'same_phone' : 'same_email';
    const confidence = contactPointType === 'phone' ? 90 : 85;
    
    await this.queueMerge(companyId, newPersonId, existingPersonId, matchReason, confidence);
  }
}

export const mergeQueueService = new MergeQueueService();
