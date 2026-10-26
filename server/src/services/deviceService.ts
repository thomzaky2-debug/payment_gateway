import crypto from 'crypto'
import { db } from '../db.js'
import { hashToken } from './authService.js'
import type { Client, DetectorDevice } from '@prisma/client'

export interface EnrollDeviceInput {
  clientId: string
  deviceId: string
  name?: string | null
  appVersion?: string | null
  androidVersion?: string | null
  requestIp?: string | null
}

export interface EnrolledDeviceOutput {
  id: string
  deviceId: string
  name: string | null
  deviceToken: string
}

export interface DeviceListItem {
  id: string
  deviceId: string
  name: string
  appVersion: string | null
  androidVersion: string | null
  lastSeenAt: Date
  status: 'ACTIVE' | 'IDLE' | 'REVOKED'
  revokedAt: Date | null
}

export type DeviceAuthResult =
  | { success: true; client: Client; device: DetectorDevice }
  | { success: false; error: 'DEVICE_REVOKED' | 'MERCHANT_INACTIVE' | 'INVALID_TOKEN'; device?: DetectorDevice }

/**
 * Enrolls a detector device, generating an individual high-entropy device token.
 * Plaintext deviceToken is returned ONCE and never logged or stored unhashed.
 */
export async function enrollDetectorDevice(
  input: EnrollDeviceInput
): Promise<EnrolledDeviceOutput> {
  const { clientId, deviceId, name, appVersion, androidVersion, requestIp } = input
  const cleanDeviceId = (deviceId || '').trim().slice(0, 128)
  if (!cleanDeviceId || cleanDeviceId.length < 3) {
    throw new Error('deviceId is required and must be at least 3 characters')
  }

  const deviceToken = `npdt_${crypto.randomBytes(32).toString('base64url')}`
  const credentialHash = hashToken(deviceToken)
  const now = new Date()

  const device = await db.detectorDevice.upsert({
    where: {
      clientId_deviceId: {
        clientId,
        deviceId: cleanDeviceId,
      },
    },
    create: {
      clientId,
      deviceId: cleanDeviceId,
      name: name?.trim().slice(0, 128) || null,
      credentialHash,
      revokedAt: null,
      appVersion: appVersion?.trim().slice(0, 64) || null,
      androidVersion: androidVersion?.trim().slice(0, 64) || null,
      lastIp: requestIp || null,
      lastSeenAt: now,
    },
    update: {
      name: name?.trim().slice(0, 128) || undefined,
      credentialHash,
      revokedAt: null,
      appVersion: appVersion?.trim().slice(0, 64) || undefined,
      androidVersion: androidVersion?.trim().slice(0, 64) || undefined,
      lastIp: requestIp || null,
      lastSeenAt: now,
    },
  })

  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.name,
    deviceToken,
  }
}

/**
 * Lists all registered detector devices for a merchant with last seen and status.
 */
export async function listMerchantDevices(clientId: string): Promise<DeviceListItem[]> {
  const devices = await db.detectorDevice.findMany({
    where: { clientId },
    orderBy: { lastSeenAt: 'desc' },
  })

  const now = Date.now()
  return devices.map((d) => ({
    id: d.id,
    deviceId: d.deviceId,
    name: d.name || d.deviceId,
    appVersion: d.appVersion,
    androidVersion: d.androidVersion,
    lastSeenAt: d.lastSeenAt,
    status: d.revokedAt ? 'REVOKED' : now - d.lastSeenAt.getTime() < 5 * 60 * 1000 ? 'ACTIVE' : 'IDLE',
    revokedAt: d.revokedAt,
  }))
}

/**
 * Revokes a single device by ID or deviceId, taking effect immediately.
 * Also revokes any active AuthSessions bound to this device.
 */
export async function revokeDetectorDevice(
  clientId: string,
  idOrDeviceId: string
): Promise<boolean> {
  const device = await db.detectorDevice.findFirst({
    where: {
      clientId,
      OR: [{ id: idOrDeviceId }, { deviceId: idOrDeviceId }],
    },
  })

  if (!device) return false

  const now = new Date()
  await db.detectorDevice.update({
    where: { id: device.id },
    data: { revokedAt: now },
  })

  // Revoke active sessions associated with this device
  await db.authSession.updateMany({
    where: {
      clientId,
      deviceId: device.deviceId,
      revokedAt: null,
    },
    data: { revokedAt: now },
  })

  return true
}

/**
 * Authenticates an incoming device token for webhook ingestion.
 * Returns the merchant client if valid, or a descriptive failure error.
 */
export async function authenticateByDeviceToken(
  rawToken: string,
  requestIp?: string | null
): Promise<DeviceAuthResult> {
  const cleanToken = (rawToken || '').replace(/^Bearer\s+/i, '').trim()
  if (!cleanToken) return { success: false, error: 'INVALID_TOKEN' }

  const tokenHash = hashToken(cleanToken)
  const device = await db.detectorDevice.findUnique({
    where: { credentialHash: tokenHash },
    include: { client: true },
  })

  if (!device) return { success: false, error: 'INVALID_TOKEN' }

  if (device.revokedAt !== null) {
    return { success: false, error: 'DEVICE_REVOKED', device }
  }

  if (!device.client || !device.client.isActive || device.client.approvalStatus !== 'APPROVED') {
    return { success: false, error: 'MERCHANT_INACTIVE', device }
  }

  // Record heartbeat asynchronously
  void db.detectorDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      lastIp: requestIp || device.lastIp,
    },
  }).catch(() => {})

  return { success: true, client: device.client, device }
}
