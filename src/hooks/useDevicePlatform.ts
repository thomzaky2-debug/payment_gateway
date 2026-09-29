import { useState, useEffect } from 'react'

export type PlatformType = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other'
export type DeviceType = 'mobile' | 'tablet' | 'desktop'
export type BrowserType = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other'

export interface DevicePlatformInfo {
  platform: PlatformType
  deviceType: DeviceType
  browser: BrowserType
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isSafari: boolean
  isTouch: boolean
  isStandalone: boolean
  supportsWebShare: boolean
  platformLabel: string
  browserLabel: string
  instapayStoreUrl: string
  instapayStoreLabel: string
}

export function useDevicePlatform(): DevicePlatformInfo {
  const [info, setInfo] = useState<DevicePlatformInfo>(() => detectPlatform())

  useEffect(() => {
    const handleResize = () => {
      setInfo(detectPlatform())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return info
}

function detectPlatform(): DevicePlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'other',
      deviceType: 'desktop',
      browser: 'other',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isTouch: false,
      isStandalone: false,
      supportsWebShare: false,
      platformLabel: 'Desktop',
      browserLabel: 'Browser',
      instapayStoreUrl: 'https://www.instapay.eg',
      instapayStoreLabel: 'InstaPay Website',
    }
  }

  const ua = navigator.userAgent || ''
  const vendor = navigator.vendor || ''
  const width = window.innerWidth

  // 1. Detect Platform
  let platform: PlatformType = 'other'
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    platform = 'ios'
  } else if (/Android/i.test(ua)) {
    platform = 'android'
  } else if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua)) {
    platform = 'macos'
  } else if (/Win32|Win64|Windows|WinCE/i.test(ua)) {
    platform = 'windows'
  } else if (/Linux/i.test(ua)) {
    platform = 'linux'
  }

  // 2. Detect Device Type
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  let deviceType: DeviceType = 'desktop'

  if (platform === 'ios') {
    deviceType = /iPad/.test(ua) || (width >= 768 && isTouch) ? 'tablet' : 'mobile'
  } else if (platform === 'android') {
    deviceType = /Mobile/i.test(ua) ? 'mobile' : 'tablet'
  } else if (width < 768 && isTouch) {
    deviceType = 'mobile'
  } else if (width <= 1024 && isTouch) {
    deviceType = 'tablet'
  }

  // 3. Detect Browser
  let browser: BrowserType = 'other'
  if (/SamsungBrowser/i.test(ua)) {
    browser = 'samsung'
  } else if (/Edg\//i.test(ua)) {
    browser = 'edge'
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'firefox'
  } else if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'chrome'
  } else if (/Safari/i.test(ua) && /Apple Computer/i.test(vendor)) {
    browser = 'safari'
  }

  const isIOS = platform === 'ios'
  const isAndroid = platform === 'android'
  const isMobile = deviceType === 'mobile'
  const isTablet = deviceType === 'tablet'
  const isDesktop = deviceType === 'desktop'

  // Standalone PWA detection
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  const supportsWebShare = typeof navigator.share === 'function'

  // Labels
  let platformLabel = 'Desktop'
  if (isIOS) platformLabel = deviceType === 'tablet' ? 'iPad' : 'iPhone (iOS)'
  else if (isAndroid) platformLabel = deviceType === 'tablet' ? 'Android Tablet' : 'Android'
  else if (platform === 'macos') platformLabel = 'macOS'
  else if (platform === 'windows') platformLabel = 'Windows'
  else if (platform === 'linux') platformLabel = 'Linux'

  const browserNames: Record<BrowserType, string> = {
    safari: 'Apple Safari',
    chrome: 'Google Chrome',
    firefox: 'Mozilla Firefox',
    edge: 'Microsoft Edge',
    samsung: 'Samsung Internet',
    other: 'Web Browser',
  }
  const browserLabel = browserNames[browser] || 'Browser'

  // Store URLs
  let instapayStoreUrl = 'https://www.instapay.eg'
  let instapayStoreLabel = 'InstaPay Website'
  if (isIOS) {
    instapayStoreUrl = 'https://apps.apple.com/eg/app/instapay-egypt/id1592109205'
    instapayStoreLabel = 'Apple App Store'
  } else if (isAndroid) {
    instapayStoreUrl = 'https://play.google.com/store/apps/details?id=com.egyptianbanks.instapay'
    instapayStoreLabel = 'Google Play Store'
  }

  return {
    platform,
    deviceType,
    browser,
    isMobile,
    isTablet,
    isDesktop,
    isIOS,
    isAndroid,
    isSafari: browser === 'safari',
    isTouch,
    isStandalone,
    supportsWebShare,
    platformLabel,
    browserLabel,
    instapayStoreUrl,
    instapayStoreLabel,
  }
}
