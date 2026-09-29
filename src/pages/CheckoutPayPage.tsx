import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import confetti from 'canvas-confetti'
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  AlertCircle,
  QrCode,
  Smartphone,
  Laptop,
  Share2,
  Download,
  RefreshCw,
  User,
  UserCheck,
  Edit2,
  Check,
} from 'lucide-react'
import { useDevicePlatform } from '../hooks/useDevicePlatform'

interface CheckoutData {
  sessionId: string
  businessName: string
  recipientHandle: string
  senderHandle: string
  amountEgp: number
  currency: string
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'UNDERPAID'
  deepLinkUrl: string
  expiresAt: string
  secondsRemaining: number
  detectedRef?: string | null
  detectedAt?: string | null
  detectedAmountEgp?: number | null
  note?: string | null
}

export function CheckoutPayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const device = useDevicePlatform()
  const [checkout, setCheckout] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [showQrModal, setShowQrModal] = useState<boolean>(false)

  // Customer InstaPay Sender Handle state
  const [senderInput, setSenderInput] = useState<string>('')
  const [isEditingSender, setIsEditingSender] = useState<boolean>(false)
  const [isSavingSender, setIsSavingSender] = useState<boolean>(false)
  const [senderSaveSuccess, setSenderSaveSuccess] = useState<boolean>(false)
  const [senderSaveError, setSenderSaveError] = useState<string | null>(null)

  const handleSaveSender = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = senderInput.trim()
    if (!sessionId || !trimmed) {
      setSenderSaveError('Please enter your InstaPay username')
      return
    }

    setIsSavingSender(true)
    setSenderSaveError(null)

    try {
      const res = await fetch(`/api/checkout/${sessionId}/sender`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderHandle: trimmed }),
      })
      const data = await res.json()
      if (data.ok && data.senderHandle) {
        setCheckout((prev) => (prev ? { ...prev, senderHandle: data.senderHandle } : null))
        setSenderInput(data.senderHandle)
        setIsEditingSender(false)
        setSenderSaveSuccess(true)
        setTimeout(() => setSenderSaveSuccess(false), 4000)
      } else {
        setSenderSaveError(data.error || 'Failed to update InstaPay username')
      }
    } catch {
      setSenderSaveError('Connection error while updating username')
    } finally {
      setIsSavingSender(false)
    }
  }

  // Fetch Checkout Session
  useEffect(() => {
    if (!sessionId) return

    fetch(`/api/checkout/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.checkout) {
          setCheckout(data.checkout)
          setTimeLeft(data.checkout.secondsRemaining)
          if (data.checkout.senderHandle && data.checkout.senderHandle !== 'pending@instapay') {
            setSenderInput(data.checkout.senderHandle)
          }
          if (data.checkout.status === 'CONFIRMED') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
          }
        } else {
          setError(data.error || 'Checkout session not found')
        }
      })
      .catch(() => {
        setError('Failed to connect to checkout gateway')
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  // Polling fallback to ensure confirmation even if WebSockets are interrupted
  useEffect(() => {
    if (!sessionId || checkout?.status === 'CONFIRMED' || checkout?.status === 'EXPIRED') return

    const poll = setInterval(() => {
      fetch(`/api/checkout/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.checkout) {
            setCheckout((prev) => {
              if (!prev || prev.status !== data.checkout.status) {
                if (data.checkout.status === 'CONFIRMED') {
                  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
                }
                return { ...prev, ...data.checkout }
              }
              return prev
            })
          }
        })
        .catch(() => {})
    }, 4000)

    return () => clearInterval(poll)
  }, [sessionId, checkout?.status])

  // Socket.IO Real-time updates
  useEffect(() => {
    if (!sessionId) return

    const socket: Socket = io()

    socket.on('connect', () => {
      socket.emit('checkout:join', sessionId)
    })

    socket.on('checkout:update', (payload: any) => {
      if (payload.sessionId === sessionId) {
        setCheckout((prev) =>
          prev
            ? {
                ...prev,
                status: payload.status,
                detectedRef: payload.detectedRef,
                detectedAt: payload.detectedAt,
                detectedAmountEgp: payload.detectedAmountEgp,
              }
            : null
        )

        if (payload.status === 'CONFIRMED') {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          })
        }
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [sessionId])

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || checkout?.status !== 'PENDING') return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setCheckout((curr) => (curr ? { ...curr, status: 'EXPIRED' } : null))
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, checkout?.status])

  const copyToClipboard = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleShare = async () => {
    if (device.supportsWebShare && checkout) {
      try {
        await navigator.share({
          title: `InstaPay Payment to ${checkout.businessName}`,
          text: `Pay ${checkout.amountEgp.toFixed(2)} EGP to ${checkout.recipientHandle} via InstaPay`,
          url: window.location.href,
        })
      } catch {
        // User cancelled share
      }
    } else {
      copyToClipboard(window.location.href, 'link')
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-white p-4">
        <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Securing checkout session...</p>
      </div>
    )
  }

  if (error || !checkout) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Checkout Error</h2>
          <p className="text-slate-400 text-sm mb-6">{error || 'Session is invalid or has expired'}</p>
        </div>
      </div>
    )
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(
    checkout.recipientHandle
  )}`

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 pt-safe pb-safe font-sans selection:bg-emerald-500 selection:text-black">
      {/* ─── Top Header Bar ──────────────────────────────────────── */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-3 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-base shadow-lg shadow-emerald-500/20">
            IP
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold text-white tracking-wide">InstaPay Payment</h1>
            <p className="text-xs text-slate-400">Direct Merchant Transfer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Platform & Browser Badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
            {device.isDesktop ? (
              <Laptop className="h-3.5 w-3.5 text-blue-400" />
            ) : (
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>{device.platformLabel} • {device.browserLabel}</span>
          </div>

          {/* Share Button (Web Share API) */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-full border border-slate-700/60 transition"
            title="Share checkout session"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{copied === 'link' ? 'Copied!' : 'Share'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden md:inline">256-bit Verified</span>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto w-full my-auto">
        {/* Status Confirmation View */}
        {checkout.status === 'CONFIRMED' ? (
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center max-w-xl mx-auto">
            <div className="h-20 w-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Payment Confirmed!</h2>
            <p className="text-emerald-400 font-medium text-sm mb-6">
              Receipt detected and verified automatically via official InstaPay notification
            </p>
            <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800 text-left space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="text-white font-semibold">{checkout.amountEgp.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Merchant:</span>
                <span className="text-white font-medium">{checkout.businessName}</span>
              </div>
              {checkout.detectedRef && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Reference:</span>
                  <span className="font-mono text-emerald-300">{checkout.detectedRef}</span>
                </div>
              )}
              {checkout.detectedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Time:</span>
                  <span className="text-slate-300">{new Date(checkout.detectedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
        ) : checkout.status === 'UNDERPAID' ? (
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center max-w-xl mx-auto">
            <div className="h-16 w-16 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Underpayment Detected</h2>
            <p className="text-amber-400 text-sm mb-5">
              Received {(checkout.detectedAmountEgp || 0).toFixed(2)} EGP, but {checkout.amountEgp.toFixed(2)} EGP was required.
            </p>
            <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Required:</span>
                <span className="text-white font-medium">{checkout.amountEgp.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount Received:</span>
                <span className="text-amber-300 font-medium">{(checkout.detectedAmountEgp || 0).toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-800 pt-2 font-semibold">
                <span className="text-red-400">Remaining Balance:</span>
                <span className="text-red-400">
                  {Math.max(0, checkout.amountEgp - (checkout.detectedAmountEgp || 0)).toFixed(2)} EGP
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Please transfer the remaining balance to <strong>{checkout.recipientHandle}</strong> to complete your order.
            </p>
          </div>
        ) : checkout.status === 'EXPIRED' ? (
          <div className="bg-slate-900/90 border border-red-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center max-w-xl mx-auto">
            <div className="h-16 w-16 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
              <Clock className="h-8 w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Session Expired</h2>
            <p className="text-slate-400 text-sm mb-6">
              This checkout session has timed out. If you already sent the transfer, please contact the merchant with your reference number.
            </p>
          </div>
        ) : (
          /* ─── Active PENDING State: Platform-Adaptive Layout ─── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ─── Left Column (Desktop QR Station or Mobile Scan Card) ─── */}
            <div className={`lg:col-span-5 ${device.isDesktop ? 'block' : 'hidden lg:block'}`}>
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Scan to Transfer</span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">Instant Phone Scanner</h3>
                <p className="text-xs text-slate-400 mb-5">Open camera or banking app to pay immediately</p>

                {/* QR Code with scanning frame */}
                <div className="p-3 bg-white rounded-2xl shadow-xl inline-block mb-5 relative group">
                  <img
                    src={qrImageUrl}
                    alt="InstaPay QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-lg"
                  />
                  <div className="absolute inset-0 border-2 border-emerald-500/40 rounded-2xl pointer-events-none group-hover:border-emerald-500 transition-colors" />
                </div>

                <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800/80 text-left flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Address</span>
                    <span className="font-mono text-xs text-white font-semibold truncate block">
                      {checkout.recipientHandle}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(checkout.recipientHandle, 'qr-handle')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
                    title="Copy Handle"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Right Column (Order Summary, Form, & Mobile Deep Links) ─── */}
            <div className={device.isDesktop ? 'lg:col-span-7' : 'w-full'}>
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
                {/* Header & Total Due */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <span className="text-xs uppercase font-medium tracking-wider text-slate-400">Paying To</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">{checkout.businessName}</h3>
                    {checkout.note && <p className="text-xs text-slate-400 mt-1">{checkout.note}</p>}
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs uppercase font-medium tracking-wider text-slate-400">Total Due</span>
                    <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                      {checkout.amountEgp.toFixed(2)} <span className="text-lg text-emerald-300/80 font-bold">EGP</span>
                    </div>
                  </div>
                </div>

                {/* Countdown Timer Bar */}
                <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 my-6">
                  <div className="flex items-center gap-2.5 text-xs text-slate-300">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Awaiting your InstaPay transfer</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTimer(timeLeft)}</span>
                  </div>
                </div>

                {/* ─── Step 1: Customer Sender Handle Input / Confirmation ─── */}
                <div className="mb-5">
                  {checkout.senderHandle && checkout.senderHandle !== 'pending@instapay' && !isEditingSender ? (
                    <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                              Sending From
                            </span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                              Verified for Auto-Match
                            </span>
                          </div>
                          <div className="font-mono text-white font-bold text-sm sm:text-base mt-0.5">
                            {checkout.senderHandle}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSenderInput(checkout.senderHandle)
                          setIsEditingSender(true)
                        }}
                        className="flex items-center justify-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition border border-slate-700/80 shrink-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Change Account</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white">Enter Your InstaPay Account Username</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Type the username you will send money from so our automated engine instantly matches your payment.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveSender} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm font-mono">
                              @
                            </div>
                            <input
                              type="text"
                              value={senderInput}
                              onChange={(e) => {
                                setSenderInput(e.target.value)
                                if (senderSaveError) setSenderSaveError(null)
                              }}
                              placeholder="yourname or yourname@instapay"
                              className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                              autoFocus={checkout.senderHandle === 'pending@instapay'}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={isSavingSender || !senderInput.trim()}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition shrink-0"
                            >
                              {isSavingSender ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              <span>{isSavingSender ? 'Saving...' : 'Confirm Handle'}</span>
                            </button>
                            {isEditingSender && checkout.senderHandle && checkout.senderHandle !== 'pending@instapay' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingSender(false)
                                  setSenderSaveError(null)
                                }}
                                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>

                        {senderSaveError && (
                          <div className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{senderSaveError}</span>
                          </div>
                        )}

                        {senderSaveSuccess && (
                          <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>InstaPay username saved successfully!</span>
                          </div>
                        )}
                      </form>
                    </div>
                  )}
                </div>

                {/* Target Transfer Information */}
                <div className="space-y-3.5">
                  <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Send exact amount to:</span>
                      <span className="text-emerald-400 font-medium">InstaPay Address (IPA)</span>
                    </div>

                    {/* Recipient Handle Box */}
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3.5 py-3 rounded-xl">
                      <span className="font-mono text-sm sm:text-base font-semibold text-white break-all">
                        {checkout.recipientHandle}
                      </span>
                      <button
                        onClick={() => copyToClipboard(checkout.recipientHandle, 'handle')}
                        className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition shrink-0 ml-2"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copied === 'handle' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Amount Box */}
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3.5 py-3 rounded-xl">
                      <span className="text-xs text-slate-400">
                        Exact Amount:{' '}
                        <strong className="text-white font-mono text-sm sm:text-base">{checkout.amountEgp.toFixed(2)} EGP</strong>
                      </span>
                      <button
                        onClick={() => copyToClipboard(checkout.amountEgp.toString(), 'amount')}
                        className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition shrink-0 ml-2"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copied === 'amount' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ─── Platform-Specific Action Buttons ─── */}
                  <div className="space-y-2 pt-2">
                    {/* Primary Deep Link: Open InstaPay App */}
                    <a
                      href={checkout.deepLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] text-sm sm:text-base"
                    >
                      <Smartphone className="h-5 w-5" />
                      <span>
                        {device.isIOS
                          ? 'Open in InstaPay (iPhone)'
                          : device.isAndroid
                          ? 'Open in InstaPay (Android)'
                          : 'Open InstaPay App'}
                      </span>
                      <ExternalLink className="h-4 w-4 ml-0.5" />
                    </a>

                    {/* Secondary Actions for Mobile / Tablet */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Mobile QR Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowQrModal((prev) => !prev)}
                        className="lg:hidden flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl border border-slate-700 transition text-xs"
                      >
                        <QrCode className="h-4 w-4 text-emerald-400" />
                        <span>{showQrModal ? 'Hide QR Code' : 'Show QR Code'}</span>
                      </button>

                      {/* Native Store Fallback Button */}
                      {(device.isIOS || device.isAndroid) && (
                        <a
                          href={device.instapayStoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl border border-slate-700/80 transition text-xs"
                        >
                          <Download className="h-3.5 w-3.5 text-slate-400" />
                          <span>Get on {device.instapayStoreLabel}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Inline Mobile QR Code (shown on mobile toggle) */}
                  {showQrModal && (
                    <div className="lg:hidden p-4 bg-white rounded-2xl flex flex-col items-center justify-center space-y-2 text-center my-4 animate-scaleIn">
                      <img
                        src={qrImageUrl}
                        alt="InstaPay QR Code"
                        className="w-48 h-48 rounded-lg"
                      />
                      <p className="text-slate-900 font-mono text-xs font-bold">{checkout.recipientHandle}</p>
                      <p className="text-slate-500 text-[11px]">Scan with any banking app supporting InstaPay</p>
                    </div>
                  )}

                  {/* Step-by-Step Instructions */}
                  <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/60 text-xs text-slate-400 space-y-1.5 mt-4">
                    <p className="font-semibold text-slate-300">Quick steps:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>
                        {checkout.senderHandle && checkout.senderHandle !== 'pending@instapay' ? (
                          <span>
                            Sending account set to <strong className="text-emerald-300">{checkout.senderHandle}</strong>
                          </span>
                        ) : (
                          <span className="text-amber-300 font-semibold">
                            Enter your InstaPay username above before sending
                          </span>
                        )}
                      </li>
                      <li>Open your InstaPay app on your phone</li>
                      <li>Transfer <strong>{checkout.amountEgp.toFixed(2)} EGP</strong> to <strong>{checkout.recipientHandle}</strong></li>
                      <li>This screen updates automatically within seconds!</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800/40 mt-8">
        <div>Powered by InstaPay Gateway • Real-time Automated Engine</div>
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span>Viewing on {device.platformLabel} ({device.browserLabel})</span>
        </div>
      </footer>
    </div>
  )
}
