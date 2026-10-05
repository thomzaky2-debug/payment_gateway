import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

export const apkRouter = Router()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const apksDir = path.join(rootDir, 'apks')

apkRouter.use((_req: Request, res: Response, next) => {
  if (process.env.ENABLE_APK_DOWNLOADS !== 'true') {
    return res.status(503).json({
      ok: false,
      error: 'APK downloads are disabled until current release-signed artifacts are published.',
    })
  }
  next()
})

// ─── Download Detector APK ──────────────────────────────────────────

apkRouter.get('/detector', (_req: Request, res: Response) => {
  const filePath = path.join(apksDir, 'InstaPay-Detector.apk')
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'Detector APK binary not found.' })
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive')
  res.setHeader('Content-Disposition', 'attachment; filename="InstaPay-Detector.apk"')
  return res.sendFile(filePath)
})

// ─── Download Admin APK ─────────────────────────────────────────────

apkRouter.get('/admin', (_req: Request, res: Response) => {
  const filePath = path.join(apksDir, 'InstaPay-Admin.apk')
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'Admin APK binary not found.' })
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive')
  res.setHeader('Content-Disposition', 'attachment; filename="InstaPay-Admin.apk"')
  return res.sendFile(filePath)
})
