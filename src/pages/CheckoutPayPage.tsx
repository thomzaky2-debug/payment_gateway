import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  ArrowRight,
  RefreshCw,
} from 'lucide-react'

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
  note?: string | null
}

export function CheckoutPayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [checkout, setCheckout] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  // Fetch Checkout Session
  useEffect(() => {
    if (!sessionId) return

    fetch(`/api/checkout/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.checkout) {
          setCheckout(data.checkout)
          setTimeLeft(data.checkout.secondsRemaining)
          if (data.checkout.status === 'CONFIRMED') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
          }
        } else {
          setError(data.error || 'Checkout session not found')
        }
      })
      .catch((err) => {
        setError('Failed to connect to checkout gateway')
      })
      .finally(() => setLoading(false))
  }, [sessionId])

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
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Securing checkout session...</p>
      </div>
    )
  }

  if (error || !checkout) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Checkout Error</h2>
          <p className="text-slate-400 text-sm mb-6">{error || 'Session is invalid or has expired'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
            IP
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">InstaPay Payment</h1>
            <p className="text-xs text-slate-400">Direct Merchant Transfer</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>256-bit Encrypted</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto w-full my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Top Status Banner */}
          {checkout.status === 'CONFIRMED' ? (
            <div className="text-center py-6">
              <div className="h-20 w-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-400 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Payment Confirmed!</h2>
              <p className="text-emerald-400 font-medium text-sm mb-6">
                Receipt detected and verified automatically via official InstaPay notification
              </p>
              <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800/80 text-left space-y-3 mb-6">
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
          ) : checkout.status === 'EXPIRED' ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                <Clock className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Session Expired</h2>
              <p className="text-slate-400 text-sm mb-6">
                This checkout session has expired. If you already transferred the funds, please contact the merchant.
              </p>
            </div>
          ) : (
            <div>
              {/* Payment Details Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <span className="text-xs uppercase font-medium tracking-wider text-slate-400">Paying To</span>
                  <h3 className="text-xl font-bold text-white">{checkout.businessName}</h3>
                  {checkout.note && <p className="text-xs text-slate-400 mt-0.5">{checkout.note}</p>}
                </div>
                <div className="sm:text-right">
                  <span className="text-xs uppercase font-medium tracking-wider text-slate-400">Total Due</span>
                  <div className="text-3xl font-extrabold text-emerald-400">
                    {checkout.amountEgp.toFixed(2)} <span className="text-lg text-emerald-300/80">EGP</span>
                  </div>
                </div>
              </div>

              {/* Timer Bar */}
              <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 my-6">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Awaiting your InstaPay transfer</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              </div>

              {/* Step 1: Transfer target */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Send exact amount to:</span>
                    <span className="text-emerald-400 font-medium">InstaPay Address</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl">
                    <span className="font-mono text-sm sm:text-base font-semibold text-white">
                      {checkout.recipientHandle}
                    </span>
                    <button
                      onClick={() => copyToClipboard(checkout.recipientHandle, 'handle')}
                      className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copied === 'handle' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl">
                    <span className="text-xs text-slate-400">
                      Amount: <strong className="text-white font-mono text-sm">{checkout.amountEgp.toFixed(2)} EGP</strong>
                    </span>
                    <button
                      onClick={() => copyToClipboard(checkout.amountEgp.toString(), 'amount')}
                      className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copied === 'amount' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Open InstaPay App Button */}
                <a
                  href={checkout.deepLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Open InstaPay App</span>
                  <ExternalLink className="h-4 w-4 ml-1" />
                </a>

                {/* Instructions */}
                <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs text-slate-400 space-y-1.5">
                  <p className="font-semibold text-slate-300">How to pay:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open your official InstaPay mobile app</li>
                    <li>
                      Transfer exactly <strong>{checkout.amountEgp.toFixed(2)} EGP</strong> to{' '}
                      <strong>{checkout.recipientHandle}</strong>
                    </li>
                    <li>Make sure you send from <strong>{checkout.senderHandle}</strong></li>
                    <li>This screen will automatically confirm within seconds of sending!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-xl mx-auto w-full text-center py-4 text-xs text-slate-500">
        Powered by InstaPay Gateway • Real-time Notification Engine
      </footer>
    </div>
  )
}
