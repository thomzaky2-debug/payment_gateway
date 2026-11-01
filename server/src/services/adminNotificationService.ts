import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { emitMerchantNotification } from './notificationService.js'

export const NOTIFICATION_BATCH_SIZE = 500
export class NotificationInputError extends Error {
  constructor(message: string, public status = 400, public code = 'INVALID_NOTIFICATION') { super(message) }
}
export interface NotificationInput {
  title: string; message: string; severity: 'INFO' | 'WARNING' | 'ALERT';
  clientId?: string; requestId?: string; expectedCount?: number
}
export function validateNotification(input: unknown): NotificationInput {
  const body = input as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NotificationInputError('A notification object is required.')
  if (typeof body.title !== 'string' || typeof body.message !== 'string') throw new NotificationInputError('Title and message must be text.')
  const title = body.title.trim(), message = body.message.trim()
  if (!title || !message) throw new NotificationInputError('Title and message are required.')
  if (title.length > 150 || message.length > 2000) throw new NotificationInputError('Title must be at most 150 characters and message at most 2000 characters.')
  const severity = body.severity ?? 'INFO'
  if (!['INFO', 'WARNING', 'ALERT'].includes(String(severity)) || typeof severity !== 'string') throw new NotificationInputError('Invalid notification severity.')
  if (body.target !== undefined && body.target !== 'ALL') throw new NotificationInputError('Choose all active approved merchants or a specific merchant.')
  if (body.clientId !== undefined && (typeof body.clientId !== 'string' || !body.clientId.trim() || body.clientId.length > 128)) throw new NotificationInputError('Invalid merchant ID.')
  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.requestId))) throw new NotificationInputError('Invalid send request identifier.')
  if (body.expectedCount !== undefined && (!Number.isSafeInteger(body.expectedCount) || Number(body.expectedCount) < 1)) throw new NotificationInputError('Expected recipient count must be a positive integer.')
  return { title, message, severity: severity as NotificationInput['severity'],
    ...(body.clientId ? {clientId: String(body.clientId).trim()} : {}),
    ...(body.requestId ? {requestId: String(body.requestId)} : {}),
    ...(body.expectedCount !== undefined ? {expectedCount: Number(body.expectedCount)} : {}) }
}
interface BroadcastMetadata {
  version: 1; summary: string; title: string; severity: string; clientId?: string;
  sentCount: number; payloadHash: string; batchPrefix: string
}
export function parseBroadcastMetadata(details: string): BroadcastMetadata | null {
  try {
    const value = JSON.parse(details)
    return value?.version === 1 && typeof value.summary === 'string' && typeof value.payloadHash === 'string'
      && typeof value.batchPrefix === 'string' && Number.isSafeInteger(value.sentCount) ? value : null
  } catch { return null }
}
export function presentNotificationAudit<T extends {action: string; details: string}>(row: T) {
  const meta = row.action === 'BROADCAST_NOTIFICATION' ? parseBroadcastMetadata(row.details) : null
  return meta ? {...row, details: meta.summary, notification: {
    title: meta.title, severity: meta.severity, clientId: meta.clientId, sentCount: meta.sentCount,
  }} : row
}
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex')
export async function sendAdminNotification(raw: unknown, database: any = db) {
  const input = validateNotification(raw)
  const payloadHash = hash(JSON.stringify([input.title, input.message, input.severity, input.clientId || 'ALL']))
  const auditId = `notification_${hash(input.requestId || crypto.randomUUID()).slice(0, 40)}`
  const batchPrefix = `${auditId}_`
  const replay = (details: string) => {
    const meta = parseBroadcastMetadata(details)
    if (!meta || meta.payloadHash !== payloadHash) throw new NotificationInputError('This send request was already used for different content.', 409, 'SEND_REQUEST_CONFLICT')
    return {sentCount: meta.sentCount, replayed: true, batchPrefix, input}
  }
  try {
    return await database.$transaction(async (tx: any) => {
      const existing = await tx.auditLog.findUnique({where:{id:auditId}, select:{details:true}})
      if (existing) return replay(existing.details)
      const where = {isActive:true, approvalStatus:'APPROVED', ...(input.clientId ? {id:input.clientId} : {})}
      const total = await tx.client.count({where})
      if (!total) throw new NotificationInputError('No active approved merchants match this audience.', 404, 'NO_RECIPIENTS')
      if (input.expectedCount !== undefined && total !== input.expectedCount) throw new NotificationInputError('The audience changed. Refresh recipients and review the message again.', 409, 'AUDIENCE_CHANGED')
      let cursor: string | undefined
      let sentCount = 0
      while (true) {
        const clients: Array<{id:string}> = await tx.client.findMany({where, select:{id:true}, orderBy:{id:'asc'}, take:NOTIFICATION_BATCH_SIZE,
          ...(cursor ? {cursor:{id:cursor}, skip:1} : {})})
        if (!clients.length) break
        await tx.merchantNotification.createMany({data: clients.map(client => ({
          id: `${batchPrefix}${hash(client.id).slice(0, 24)}`, clientId:client.id,
          title:input.title, message:input.message, severity:input.severity,
        }))})
        sentCount += clients.length
        cursor = clients[clients.length - 1].id
        if (clients.length < NOTIFICATION_BATCH_SIZE) break
      }
      if (sentCount !== total) throw new Error('Notification audience snapshot was inconsistent')
      const meta: BroadcastMetadata = {version:1, summary:`Sent "${input.title}" (${input.severity}) to ${sentCount} active approved merchant(s)`,
        title:input.title, severity:input.severity, ...(input.clientId ? {clientId:input.clientId} : {}), sentCount, payloadHash, batchPrefix}
      await tx.auditLog.create({data:{id:auditId, action:'BROADCAST_NOTIFICATION', details:JSON.stringify(meta)}})
      return {sentCount, replayed:false, batchPrefix, input}
    }, {isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead, maxWait:5000, timeout:30000})
  } catch (error: any) {
    // A concurrent retry can lose the unique-ID race; its transaction rolls back.
    if (error?.code === 'P2002' || error?.code === 'P2034') {
      const existing = await database.auditLog.findUnique({where:{id:auditId}, select:{details:true}})
      if (existing) return replay(existing.details)
    }
    throw error
  }
}

/** Best-effort live updates after commit. The persisted inbox is authoritative. */
export async function emitAdminNotificationBatch(result: Awaited<ReturnType<typeof sendAdminNotification>>) {
  if (result.replayed) return
  let cursor: string | undefined
  while (true) {
    const rows = await db.merchantNotification.findMany({where:{id:{startsWith:result.batchPrefix}},
      select:{id:true, clientId:true, createdAt:true}, orderBy:{id:'asc'}, take:NOTIFICATION_BATCH_SIZE,
      ...(cursor ? {cursor:{id:cursor}, skip:1} : {})})
    if (!rows.length) break
    for (const row of rows) emitMerchantNotification(row.clientId, {
      id:row.id, title:result.input.title, message:result.input.message,
      severity:result.input.severity, createdAt:row.createdAt.toISOString(),
    })
    cursor = rows[rows.length - 1].id
    if (rows.length < NOTIFICATION_BATCH_SIZE) break
    await new Promise<void>(resolve => setImmediate(resolve))
  }
}
