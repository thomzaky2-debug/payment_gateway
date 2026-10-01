import React, { useState } from 'react';
import {
  BookOpen, Shield, Code2, Terminal, Check, Copy, ExternalLink,
  Lock, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Server, Zap, Clock, Send, FileCode2, ArrowRight, ShieldCheck,
  Eye, EyeOff, Layers, Hash, Info
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface DocumentationSectionProps {
  apiKey?: string;
  webhookSecret?: string;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

type TabType = 'quickstart' | 'endpoints' | 'webhook' | 'code' | 'events' | 'errors';

export function DocumentationSection({ apiKey, webhookSecret, showToast }: DocumentationSectionProps) {
  const { isDark } = useTheme();
  const { lang, isRtl } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabType>('quickstart');
  const [useRealKeys, setUseRealKeys] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'create' | 'status' | 'snippets'>('create');
  const [selectedLang, setSelectedLang] = useState<'node' | 'python' | 'php'>('node');
  const [selectedEvent, setSelectedEvent] = useState<'confirmed' | 'underpaid' | 'overpaid' | 'subscription'>('confirmed');

  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.4)' : '#e2e8f0';

  const displayApiKey = useRealKeys && apiKey ? apiKey : 'egp_live_9a7b3c2d1e0f8a4b6c8d0e2f';
  const displayWebhookSecret = useRealKeys && webhookSecret ? webhookSecret : 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0';
  const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (showToast) {
      showToast('success', isRtl ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
    }
  };

  const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderRadius: '16px',
    border: `1px solid ${borderColor}`,
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.25)'
      : '0 4px 16px rgba(0,0,0,0.05)',
    ...extra,
  });

  const codeBox = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#070b14' : '#0f172a',
    borderRadius: '12px',
    border: isDark ? '1px solid #1e293b' : 'none',
    overflow: 'hidden',
    ...extra,
  });

  /* ──────────────── Code Snippets for Webhook Verification ──────────────── */
  const nodeVerificationCode = `import express from 'express';
import crypto from 'crypto';

const app = express();
const WEBHOOK_SECRET = process.env.INSTAPAY_WEBHOOK_SECRET || '${displayWebhookSecret}';

// IMPORTANT: Retain raw body buffer for HMAC-SHA256 signature verification
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = req.headers['x-instapay-signature'] as string;
  const timestamp = req.headers['x-instapay-timestamp'] as string;
  const rawBody = req.body.toString('utf8');

  if (!signatureHeader || !timestamp) {
    return res.status(400).send('Missing X-Instapay-Signature or X-Instapay-Timestamp');
  }

  // 1. Anti-Replay: Verify timestamp is within 300 seconds (5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - Number(timestamp)) > 300) {
    return res.status(400).send('Webhook timestamp outside tolerance window');
  }

  // 2. Extract hex signature from 'v1=<signature>' header
  const signature = signatureHeader.startsWith('v1=') 
    ? signatureHeader.slice(3) 
    : signatureHeader;

  // 3. Construct base string: "<timestamp>.<rawBody>"
  const baseString = \`\${timestamp}.\${rawBody}\`;

  // 4. Compute expected HMAC-SHA256 hex digest
  const computedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(baseString)
    .digest('hex');

  // 5. Timing-safe comparison to prevent side-channel timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const computedBuffer = Buffer.from(computedSignature, 'hex');

  if (signatureBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, computedBuffer)) {
    console.error('Invalid InstaPay webhook signature');
    return res.status(401).send('Signature verification failed');
  }

  // 6. Signature verified! Safely parse and process transaction payload
  const payload = JSON.parse(rawBody);
  console.log(\`Received \${payload.event} for Session \${payload.transaction.sessionId}\`);

  if (payload.event === 'payment.confirmed') {
    // Exact payment matched: Fulfill customer order
    // payload.transaction.amountEgp, payload.transaction.detectedRef
  } else if (payload.event === 'payment.underpaid') {
    // Underpaid: Alert customer of remaining balance
  } else if (payload.event === 'payment.overpaid') {
    // Overpaid: Confirm order and record merchant credit
  }

  // Acknowledge receipt with 2xx status within 10 seconds to stop retry attempts
  return res.status(200).json({ received: true });
});

app.listen(8080, () => console.log('Webhook receiver active on port 8080'));`;

  const pythonVerificationCode = `import hmac
import hashlib
import time
import json
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = "${displayWebhookSecret}"

@app.route("/api/webhook", methods=["POST"])
def instapay_webhook():
    signature_header = request.headers.get("X-Instapay-Signature", "")
    timestamp_header = request.headers.get("X-Instapay-Timestamp", "")
    raw_body = request.get_data(as_text=True)

    if not signature_header or not timestamp_header:
        return jsonify({"error": "Missing signature headers"}), 400

    # 1. Anti-Replay: Verify timestamp freshness (within 5 minutes)
    current_time = int(time.time())
    if abs(current_time - int(timestamp_header)) > 300:
        return jsonify({"error": "Timestamp outside tolerance window"}), 400

    # 2. Extract hex signature from 'v1=<hex>'
    signature = signature_header[3:] if signature_header.startswith("v1=") else signature_header

    # 3. Construct base string: "<timestamp>.<rawBody>"
    base_string = f"{timestamp_header}.{raw_body}".encode("utf-8")

    # 4. Compute HMAC-SHA256 signature
    computed_signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        base_string,
        hashlib.sha256
    ).hexdigest()

    # 5. Timing-safe comparison to prevent timing attacks
    if not hmac.compare_digest(signature, computed_signature):
        return jsonify({"error": "Signature mismatch"}), 401

    # 6. Payload is authentic! Process event
    payload = json.loads(raw_body)
    event_type = payload.get("event")
    tx = payload.get("transaction", {})

    print(f"Verified event: {event_type} - Session ID: {tx.get('sessionId')}")

    # Return HTTP 200 within 10s
    return jsonify({"received": True}), 200

if __name__ == "__main__":
    app.run(port=8080)`;

  const phpVerificationCode = `<?php
// Retrieve merchant webhook secret
$webhookSecret = '${displayWebhookSecret}';

// 1. Read inbound headers & raw request body directly from php://input
$signatureHeader = $_SERVER['HTTP_X_INSTAPAY_SIGNATURE'] ?? '';
$timestampHeader = $_SERVER['HTTP_X_INSTAPAY_TIMESTAMP'] ?? '';
$rawBody         = file_get_contents('php://input');

if (empty($signatureHeader) || empty($timestampHeader)) {
    http_response_code(400);
    exit('Missing signature headers');
}

// 2. Anti-Replay check: 300 second tolerance
$currentTime = time();
if (abs($currentTime - intval($timestampHeader)) > 300) {
    http_response_code(400);
    exit('Timestamp outside 5-minute tolerance window');
}

// 3. Extract v1 signature
$signature = str_replace('v1=', '', $signatureHeader);

// 4. Construct base string and calculate HMAC-SHA256
$baseString        = $timestampHeader . '.' . $rawBody;
$computedSignature = hash_hmac('sha256', $baseString, $webhookSecret);

// 5. Constant-time string comparison
if (!hash_equals($signature, $computedSignature)) {
    http_response_code(401);
    exit('Webhook signature verification failed');
}

// 6. Process verified payload
$data = json_decode($rawBody, true);
$event = $data['event'] ?? '';
$tx = $data['transaction'] ?? [];

// Return 200 OK
http_response_code(200);
echo json_encode(['received' => true]);`;

  /* ──────────────── Webhook Payloads ──────────────── */
  const webhookPayloadExamples = {
    confirmed: {
      event: 'payment.confirmed',
      clientId: 'clnt_9f8e7d6c5b4a',
      businessName: 'Cairo Digital Store',
      transaction: {
        sessionId: 'cmt_8f1b2c3d4e5f6a7b',
        senderHandle: 'customer@instapay',
        recipientHandle: 'merchant@instapay',
        amountEgp: 150.00,
        detectedAmountEgp: 150.00,
        currency: 'EGP',
        status: 'PAID',
        detectedRef: 'REF20261002987654',
        detectedAt: '2026-10-02T00:37:12.000Z',
        note: 'Order #1042',
        createdAt: '2026-10-02T00:35:00.000Z'
      }
    },
    underpaid: {
      event: 'payment.underpaid',
      clientId: 'clnt_9f8e7d6c5b4a',
      businessName: 'Cairo Digital Store',
      transaction: {
        sessionId: 'cmt_8f1b2c3d4e5f6a7b',
        senderHandle: 'customer@instapay',
        recipientHandle: 'merchant@instapay',
        amountEgp: 150.00,
        detectedAmountEgp: 100.00,
        currency: 'EGP',
        status: 'UNDERPAID',
        detectedRef: 'REF20261002987655',
        detectedAt: '2026-10-02T00:37:15.000Z',
        note: 'Order #1042',
        createdAt: '2026-10-02T00:35:00.000Z'
      }
    },
    overpaid: {
      event: 'payment.overpaid',
      clientId: 'clnt_9f8e7d6c5b4a',
      businessName: 'Cairo Digital Store',
      transaction: {
        sessionId: 'cmt_8f1b2c3d4e5f6a7b',
        senderHandle: 'customer@instapay',
        recipientHandle: 'merchant@instapay',
        amountEgp: 150.00,
        detectedAmountEgp: 200.00,
        currency: 'EGP',
        status: 'OVERPAID',
        detectedRef: 'REF20261002987656',
        detectedAt: '2026-10-02T00:37:20.000Z',
        note: 'Order #1042',
        createdAt: '2026-10-02T00:35:00.000Z'
      }
    },
    subscription: {
      event: 'subscription.payment_confirmed',
      clientId: 'clnt_9f8e7d6c5b4a',
      businessName: 'Cairo Digital Store',
      transaction: {
        sessionId: 'cmt_sub_7e6d5c4b3a2f',
        senderHandle: 'merchant@instapay',
        recipientHandle: 'admin@instapay',
        amountEgp: 499.00,
        detectedAmountEgp: 499.00,
        currency: 'EGP',
        status: 'PAID',
        detectedRef: 'SUB_REF20261002',
        detectedAt: '2026-10-02T00:40:00.000Z',
        note: 'Subscription Plan Renewal',
        createdAt: '2026-10-02T00:39:00.000Z'
      }
    }
  };

  return (
    <div style={{ marginTop: '36px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Main Section Banner / Header ─── */}
      <div style={{
        ...cardStyle({ padding: '24px 28px' }),
        background: isDark
          ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(56,189,248,0.08))'
          : 'linear-gradient(135deg, #f5f3ff, #f0f9ff)',
        border: isDark ? '1px solid rgba(139,92,246,0.3)' : '1px solid #ddd6fe',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
              flexShrink: 0,
            }}>
              <BookOpen size={24} color="white" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'التوثيق ودعم التكامل' : 'Documentation & Integration Support'}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  backgroundColor: isDark ? 'rgba(56,189,248,0.2)' : '#e0f2fe',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: isDark ? '1px solid rgba(56,189,248,0.3)' : '1px solid #bae6fd',
                }}>
                  v1.0 REST
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7',
                  color: isDark ? '#34d399' : '#15803d',
                  border: isDark ? '1px solid rgba(16,185,129,0.3)' : '1px solid #bbf7d0',
                }}>
                  HMAC-SHA256 Signed
                </span>
              </div>
              <p style={{ fontSize: '13px', color: textSecondary, margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {isRtl
                  ? 'جميع استدعاءات API موثقة بأمثلة كاملة. تحقق من التوقيعات باستخدام HMAC-SHA256 مع مفتاح الويب هوك أعلاه.'
                  : 'All API calls are documented with full examples. Verify webhook signatures using HMAC-SHA256 with your webhook secret above.'}
              </p>
            </div>
          </div>

          {/* Quick toggle to show real keys in documentation examples */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setUseRealKeys(!useRealKeys)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: useRealKeys
                  ? (isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7')
                  : (isDark ? '#1e293b' : '#ffffff'),
                color: useRealKeys ? (isDark ? '#34d399' : '#15803d') : textSecondary,
                border: useRealKeys
                  ? '1px solid #10b981'
                  : `1px solid ${borderColor}`,
                transition: 'all 0.2s ease',
              }}
              title={useRealKeys ? (isRtl ? 'إخفاء المفاتيح الحقيقية' : 'Hide live keys') : (isRtl ? 'عرض مفاتيحي الحقيقية في الأمثلة' : 'Insert my live keys into code')}
            >
              {useRealKeys ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>
                {useRealKeys
                  ? (isRtl ? 'استخدام مفاتيحي الحقيقية (مفعّل)' : 'Using My Live Keys')
                  : (isRtl ? 'إدراج مفاتيحي الحقيقية في الكود' : 'Insert My Live Keys')}
              </span>
            </button>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '20px',
          overflowX: 'auto',
          paddingBottom: '4px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
        }}>
          {[
            { id: 'quickstart', label: isRtl ? 'البداية السريعة والمصادقة' : 'Quickstart & Auth', icon: Zap },
            { id: 'endpoints', label: isRtl ? 'واجهات API (Checkout)' : 'Checkout Endpoints', icon: Code2 },
            { id: 'webhook', label: isRtl ? 'التحقق من الويب هوك (HMAC)' : 'HMAC-SHA256 Webhook', icon: ShieldCheck },
            { id: 'code', label: isRtl ? 'أكواد التحقق حسب اللغة' : 'Verification Code (SDK)', icon: Terminal },
            { id: 'events', label: isRtl ? 'الأحداث والحمولات (Events)' : 'Events & Payloads', icon: Layers },
            { id: 'errors', label: isRtl ? 'دورة الحياة والأخطاء' : 'Lifecycle & Errors', icon: AlertCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: isActive
                    ? (isDark ? '#8b5cf6' : '#7c3aed')
                    : 'transparent',
                  color: isActive ? '#ffffff' : textSecondary,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab 1: Quickstart & Authentication ─── */}
      {activeTab === 'quickstart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: '0 0 10px 0' }}>
              {isRtl ? 'نظرة عامة على بوابة الدفع' : 'Payment Gateway Overview'}
            </h4>
            <p style={{ fontSize: '13px', color: textSecondary, lineHeight: 1.6, margin: 0 }}>
              {isRtl
                ? 'توفر بوابة إنستاباي تكاملاً سلساً لقبول التحويلات اللحظية المباشرة في مصر بالجنيه المصري (EGP). يقوم نظامنا بمطابقة الإشعارات تلقائياً بدقة متناهية وإرسال ردود ويب هوك موقّعة بتشفير HMAC-SHA256 إلى خادم متجرك فور تأكيد التحويل.'
                : 'InstaPay Gateway provides direct, real-time Egyptian Pound (EGP) payment acceptance for online merchants. Our companion detector verifies receipts in real-time, matches sessions, and dispatches HMAC-SHA256 cryptographically signed webhook notifications directly to your server.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#162033' : '#f8fafc',
                border: `1px solid ${borderColor}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Server size={16} color="#38bdf8" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                    {isRtl ? 'عنوان الخادم الأساسي (Base URL)' : 'Base Server URL'}
                  </span>
                </div>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  color: '#38bdf8',
                  backgroundColor: isDark ? '#070b14' : '#0f172a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>{baseUrl}</span>
                  <button
                    onClick={() => copyToClipboard(baseUrl, 'baseurl')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    {copiedId === 'baseurl' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#162033' : '#f8fafc',
                border: `1px solid ${borderColor}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Lock size={16} color="#4ade80" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                    {isRtl ? 'ترويسة المصادقة (Auth Header)' : 'Authorization Header'}
                  </span>
                </div>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  color: '#4ade80',
                  backgroundColor: isDark ? '#070b14' : '#0f172a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>Authorization: Bearer {displayApiKey.slice(0, 14)}...</span>
                  <button
                    onClick={() => copyToClipboard(`Authorization: Bearer ${displayApiKey}`, 'authheader')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    {copiedId === 'authheader' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Key Formats Guide */}
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: textPrimary, marginBottom: '14px' }}>
              {isRtl ? 'صيغ المعرّفات والمفاتيح' : 'Credential & Identifier Prefixes'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {[
                { prefix: 'egp_live_', desc: isRtl ? 'مفتاح API الخاص بالتاجر لإجراء طلبات إنشاء ومتابعة الجلسات' : 'Merchant Live API Key for REST endpoints', color: '#38bdf8' },
                { prefix: 'whsec_', desc: isRtl ? 'مفتاح توقيع HMAC السري للتحقق من سلامة وصحة إشعارات الويب هوك' : 'Webhook HMAC Secret for inbound signature verification', color: '#f59e0b' },
                { prefix: 'cmt_', desc: isRtl ? 'معرّف جلسة الدفع الفريد لكل معاملة دفع ينشئها المتجر' : 'Unique Checkout Session ID generated per transaction', color: '#a78bfa' },
                { prefix: 'evt_', desc: isRtl ? 'معرّف الحدث الفريد المرسل في ترويسة X-Instapay-Event-Id' : 'Unique Event ID dispatched in X-Instapay-Event-Id header', color: '#ec4899' },
              ].map((item, idx) => (
                <div key={idx} style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? '#162033' : '#f8fafc',
                  border: `1px solid ${borderColor}`,
                }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: item.color,
                  }}>
                    {item.prefix}
                  </span>
                  <p style={{ fontSize: '11.5px', color: textSecondary, margin: '4px 0 0 0' }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 2: Endpoints Reference ─── */}
      {activeTab === 'endpoints' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub-selector for endpoints */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'create', method: 'POST', path: '/api/v1/checkout/create', title: isRtl ? 'إنشاء جلسة دفع' : 'Create Checkout Session' },
              { id: 'status', method: 'GET', path: '/api/v1/checkout/status', title: isRtl ? 'فحص حالة الجلسة' : 'Check Session Status' },
              { id: 'snippets', method: 'GET', path: '/api/v1/checkout/snippets', title: isRtl ? 'أمثلة الشيفرة' : 'Snippets Generator' },
            ].map((ep) => (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpoint(ep.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: selectedEndpoint === ep.id
                    ? (isDark ? '#1e293b' : '#e2e8f0')
                    : 'transparent',
                  border: selectedEndpoint === ep.id
                    ? `1px solid ${isDark ? '#475569' : '#cbd5e1'}`
                    : `1px solid ${borderColor}`,
                  cursor: 'pointer',
                  color: textPrimary,
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: ep.method === 'POST' ? '#059669' : '#2563eb',
                  color: '#ffffff',
                }}>
                  {ep.method}
                </span>
                <span>{ep.path}</span>
              </button>
            ))}
          </div>

          {/* Endpoint Details */}
          {selectedEndpoint === 'create' && (
            <div style={{ ...cardStyle({ padding: '24px' }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                    POST /api/v1/checkout/create
                  </h4>
                  <p style={{ fontSize: '13px', color: textSecondary, margin: '4px 0 0 0' }}>
                    {isRtl ? 'إنشاء جلسة دفع جديدة والحصول على رابط الدفع السريع والعميق' : 'Creates an InstaPay payment session with dynamic checkout & deep link URLs.'}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7', padding: '4px 10px', borderRadius: '20px' }}>
                  201 Created
                </span>
              </div>

              {/* Request Parameters Table */}
              <div style={{ marginBottom: '20px' }}>
                <h5 style={{ fontSize: '13px', fontWeight: 700, color: textPrimary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isRtl ? 'معاملات الطلب (JSON Body)' : 'Request Body Parameters'}
                </h5>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}`, color: textMuted, textAlign: isRtl ? 'right' : 'left' }}>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'الحقل' : 'Field'}</th>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'النوع' : 'Type'}</th>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'إلزامي؟' : 'Required'}</th>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'الوصف' : 'Description'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', fontWeight: 600 }}>amountEgp</td>
                        <td style={{ padding: '10px 12px', color: textSecondary }}>Number</td>
                        <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 700 }}>{isRtl ? 'نعم' : 'Yes'}</td>
                        <td style={{ padding: '10px 12px', color: textSecondary }}>
                          {isRtl ? 'المبلغ بالجنيه المصري (يجب أن يكون أكبر من صفر)' : 'Amount in Egyptian Pounds (must be greater than 0)'}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', fontWeight: 600 }}>senderHandle</td>
                        <td style={{ padding: '10px 12px', color: textSecondary }}>String</td>
                        <td style={{ padding: '10px 12px', color: textMuted }}>{isRtl ? 'اختياري' : 'Optional'}</td>
                        <td style={{ padding: '10px 12px', color: textSecondary }}>
                          {isRtl ? 'معرّف إنستاباي للعميل (الافتراضي: pending@instapay)' : 'Customer InstaPay handle / IPA (defaults to pending@instapay)'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', fontWeight: 600 }}>note</td>
                        <td style={{ padding: '10px 12px', color: textSecondary }}>String</td>
                        <td style={{ padding: '10px 12px', color: textMuted }}>{isRtl ? 'اختياري' : 'Optional'}</td>
                        <td style={{ padding: '10px 12px', color: textSecondary }}>
                          {isRtl ? 'ملاحظة أو رقم طلب في متجرك (يظهر في إيصال الدفع)' : 'Order reference or memo shown on invoice'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* cURL and Response side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                      cURL Example
                    </span>
                    <button
                      onClick={() => copyToClipboard(`curl -X POST ${baseUrl}/api/v1/checkout/create \\\n  -H "Authorization: Bearer ${displayApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "amountEgp": 150.00,\n    "senderHandle": "customer@instapay",\n    "note": "Order #1042"\n  }'`, 'curlcreate')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      {copiedId === 'curlcreate' ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                      <span>{copiedId === 'curlcreate' ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                    </button>
                  </div>
                  <pre style={{
                    ...codeBox({ padding: '14px 16px' }),
                    fontSize: '11.5px',
                    color: '#e2e8f0',
                    fontFamily: "'JetBrains Mono', monospace",
                    margin: 0,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                  }}>
                    <span style={{ color: '#fbbf24' }}>curl</span> -X POST {baseUrl}/api/v1/checkout/create \{'\n'}
                    {'  '}-H <span style={{ color: '#fb923c' }}>"Authorization: Bearer {displayApiKey}"</span> \{'\n'}
                    {'  '}-H <span style={{ color: '#fb923c' }}>"Content-Type: application/json"</span> \{'\n'}
                    {'  '}-d <span style={{ color: '#a78bfa' }}>'{"{"}\n    "amountEgp": 150.00,\n    "senderHandle": "customer@instapay",\n    "note": "Order #1042"\n  {"}"}'</span>
                  </pre>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                      Response 201 Created
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({
                        ok: true,
                        checkout: {
                          sessionId: 'cmt_8f1b2c3d4e5f6a7b',
                          status: 'PENDING',
                          amountEgp: 150.0,
                          currency: 'EGP',
                          deepLinkUrl: 'instapay://pay?handle=merchant@instapay&amount=150.00&ref=cmt_8f1b2c3d4e5f6a7b',
                          checkoutUrl: 'http://localhost:3000/pay/cmt_8f1b2c3d4e5f6a7b',
                          recipientHandle: 'merchant@instapay',
                          senderHandle: 'customer@instapay',
                          expiresAt: '2026-10-02T00:45:00.000Z'
                        }
                      }, null, 2), 'rescreate')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      {copiedId === 'rescreate' ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                      <span>{copiedId === 'rescreate' ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                    </button>
                  </div>
                  <pre style={{
                    ...codeBox({ padding: '14px 16px' }),
                    fontSize: '11.5px',
                    color: '#e2e8f0',
                    fontFamily: "'JetBrains Mono', monospace",
                    margin: 0,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                  }}>
                    {`{\n  "ok": true,\n  "checkout": {\n    "sessionId": "cmt_8f1b2c3d4e5f6a7b",\n    "status": "PENDING",\n    "amountEgp": 150.0,\n    "currency": "EGP",\n    "deepLinkUrl": "instapay://pay?...",\n    "checkoutUrl": "${baseUrl}/pay/cmt_...",\n    "recipientHandle": "merchant@instapay",\n    "senderHandle": "customer@instapay",\n    "expiresAt": "2026-10-02T00:45:00.000Z"\n  }\n}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {selectedEndpoint === 'status' && (
            <div style={{ ...cardStyle({ padding: '24px' }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                    GET /api/v1/checkout/status?sessionId=cmt_...
                  </h4>
                  <p style={{ fontSize: '13px', color: textSecondary, margin: '4px 0 0 0' }}>
                    {isRtl ? 'الاستعلام عن حالة جلسة الدفع ومعرفة المرجع البنكي والمبلغ المطابق' : 'Polls the status of a checkout session. Also performs auto-expiry when past expiresAt.'}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : '#e0f2fe', padding: '4px 10px', borderRadius: '20px' }}>
                  200 OK
                </span>
              </div>

              {/* Query Param */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                  {isRtl ? 'المعامل المطلوب:' : 'Required Query Parameter:'}
                </span>
                <div style={{ display: 'inline-block', marginLeft: '8px', marginRight: '8px' }}>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", backgroundColor: isDark ? '#1e293b' : '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: '#f59e0b' }}>
                    sessionId=cmt_8f1b2c3d4e5f6a7b
                  </code>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                      cURL Example
                    </span>
                    <button
                      onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api/v1/checkout/status?sessionId=cmt_8f1b2c3d4e5f6a7b" \\\n  -H "Authorization: Bearer ${displayApiKey}"`, 'curlstatus')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      {copiedId === 'curlstatus' ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                      <span>{copiedId === 'curlstatus' ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                    </button>
                  </div>
                  <pre style={{
                    ...codeBox({ padding: '14px 16px' }),
                    fontSize: '11.5px',
                    color: '#e2e8f0',
                    fontFamily: "'JetBrains Mono', monospace",
                    margin: 0,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                  }}>
                    <span style={{ color: '#fbbf24' }}>curl</span> -X GET <span style={{ color: '#38bdf8' }}>"{baseUrl}/api/v1/checkout/status?sessionId=cmt_8f1b2c3d4e5f6a7b"</span> \{'\n'}
                    {'  '}-H <span style={{ color: '#fb923c' }}>"Authorization: Bearer {displayApiKey}"</span>
                  </pre>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                      Response 200 OK (Paid Example)
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({
                        ok: true,
                        checkout: {
                          sessionId: 'cmt_8f1b2c3d4e5f6a7b',
                          status: 'PAID',
                          amountEgp: 150.0,
                          currency: 'EGP',
                          senderHandle: 'customer@instapay',
                          recipientHandle: 'merchant@instapay',
                          detectedRef: 'REF20261002987654',
                          detectedAt: '2026-10-02T00:37:12.000Z',
                          detectedAmountEgp: 150.0,
                          createdAt: '2026-10-02T00:35:00.000Z',
                          expiresAt: '2026-10-02T00:45:00.000Z'
                        }
                      }, null, 2), 'resstatus')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      {copiedId === 'resstatus' ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                      <span>{copiedId === 'resstatus' ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                    </button>
                  </div>
                  <pre style={{
                    ...codeBox({ padding: '14px 16px' }),
                    fontSize: '11.5px',
                    color: '#e2e8f0',
                    fontFamily: "'JetBrains Mono', monospace",
                    margin: 0,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                  }}>
                    {`{\n  "ok": true,\n  "checkout": {\n    "sessionId": "cmt_8f1b2c3d4e5f6a7b",\n    "status": "PAID",\n    "amountEgp": 150.0,\n    "currency": "EGP",\n    "senderHandle": "customer@instapay",\n    "recipientHandle": "merchant@instapay",\n    "detectedRef": "REF20261002987654",\n    "detectedAt": "2026-10-02T00:37:12.000Z",\n    "detectedAmountEgp": 150.0,\n    "createdAt": "2026-10-02T00:35:00.000Z",\n    "expiresAt": "2026-10-02T00:45:00.000Z"\n  }\n}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {selectedEndpoint === 'snippets' && (
            <div style={{ ...cardStyle({ padding: '24px' }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                    GET /api/v1/checkout/snippets
                  </h4>
                  <p style={{ fontSize: '13px', color: textSecondary, margin: '4px 0 0 0' }}>
                    {isRtl ? 'توليد عينات الكود برمجياً ومخصصة لحساب التاجر الحالي' : 'Dynamically generates tailored integration snippets directly from the server.'}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : '#e0f2fe', padding: '4px 10px', borderRadius: '20px' }}>
                  200 OK
                </span>
              </div>

              <p style={{ fontSize: '13px', color: textSecondary, lineHeight: 1.6 }}>
                {isRtl
                  ? 'هذه النقطة تُعيد نصوص برمجية جاهزة للتشغيل بلغات cURL و Node.js (Axios) و Python (Requests) محقونة تلقائياً بعنوان الخادم الحالي ومفتاح API التابع لحسابك.'
                  : 'This endpoint returns pre-configured, ready-to-execute scripts in cURL, Node.js (Axios), and Python (Requests) pre-populated with your active API key and base host.'}
              </p>

              <pre style={{
                ...codeBox({ padding: '14px 16px' }),
                fontSize: '11.5px',
                color: '#e2e8f0',
                fontFamily: "'JetBrains Mono', monospace",
                margin: 0,
                lineHeight: 1.6,
                overflowX: 'auto',
              }}>
                <span style={{ color: '#fbbf24' }}>curl</span> -X GET {baseUrl}/api/v1/checkout/snippets \{'\n'}
                {'  '}-H <span style={{ color: '#fb923c' }}>"Authorization: Bearer {displayApiKey}"</span>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 3: HMAC-SHA256 Webhook Verification ─── */}
      {activeTab === 'webhook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key verification algorithm highlight */}
          <div style={{
            ...cardStyle({ padding: '24px' }),
            background: isDark
              ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(16,185,129,0.05))'
              : 'linear-gradient(135deg, #fffbeb, #f0fdf4)',
            border: isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fde68a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
              }}>
                <ShieldCheck size={20} color="white" />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'آلية التوقيع المشفرة HMAC-SHA256' : 'Cryptographic HMAC-SHA256 Signature Algorithm'}
                </h4>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                  {isRtl ? 'كيف يتحقق خادمك من أن الإشعار وارد فعلاً من بوابة إنستاباي ولم يتم تعديله' : 'Ensure inbound webhook notifications originate authentically from InstaPay Gateway'}
                </p>
              </div>
            </div>

            {/* Formula display */}
            <div style={{
              ...codeBox({ padding: '16px 20px' }),
              marginBottom: '16px',
            }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isRtl ? 'معادلة التوقيع (Base String & Algorithm)' : 'Signature Formula'}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#4ade80', lineHeight: 1.6 }}>
                baseString = <span style={{ color: '#38bdf8' }}>`$&#123;timestamp&#125;.$&#123;rawBody&#125;`</span>{'\n'}
                expectedSignature = <span style={{ color: '#f59e0b' }}>HMAC_SHA256</span>(secret: <span style={{ color: '#fb923c' }}>webhookSecret</span>, data: baseString).digest(<span style={{ color: '#a78bfa' }}>'hex'</span>){'\n'}
                headerValue = <span style={{ color: '#ec4899' }}>`v1=$&#123;expectedSignature&#125;`</span>
              </div>
            </div>

            {/* Crucial Integration Guidelines */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff', border: `1px solid ${borderColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <AlertCircle size={15} />
                  <span>{isRtl ? 'استخدم النص الخام للطلب (Raw Body)' : 'Use Raw Unparsed Body'}</span>
                </div>
                <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
                  {isRtl
                    ? 'يجب حساب التوقيع على نص JSON الخام كما وصل من الشبكة بالضبط. إذا قمت بتحليله ثم إعادة تحويله عبر JSON.stringify قد تختلف المسافات وترتيب الحقول مما يؤدي لفشل التحقق.'
                    : 'The signature must be calculated on the raw, unparsed request body string/buffer directly. Re-serializing parsed JSON changes spacing and key ordering, failing verification.'}
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff', border: `1px solid ${borderColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <Clock size={15} />
                  <span>{isRtl ? 'الحماية من هجمات إعادة الإرسال (Replay)' : 'Replay Attack Prevention'}</span>
                </div>
                <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
                  {isRtl
                    ? 'تحقق من ترويسة X-Instapay-Timestamp واشترط أن يكون الفارق الزمني أقل من 300 ثانية (5 دقائق) لمنع المهاجمين من إعادة إرسال طلبات قديمة.'
                    : 'Compare X-Instapay-Timestamp against current system time with a 300-second (5 minute) tolerance window to reject stale or replayed webhook requests.'}
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff', border: `1px solid ${borderColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <Shield size={15} />
                  <span>{isRtl ? 'مقارنة آمنة زمنياً (Timing Safe)' : 'Timing-Safe Comparison'}</span>
                </div>
                <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
                  {isRtl
                    ? 'استخدم دالة مقارنة ثابتة التوقيت مثل crypto.timingSafeEqual أو hmac.compare_digest لمنع هجمات التحليل الزمني.'
                    : 'Always compare signature digests using a constant-time comparison helper like crypto.timingSafeEqual or hmac.compare_digest to prevent side-channel timing leaks.'}
                </p>
              </div>
            </div>
          </div>

          {/* Webhook Headers Table */}
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: textPrimary, marginBottom: '14px' }}>
              {isRtl ? 'الترويسات المرسلة مع كل إشعار ويب هوك' : 'Inbound Webhook HTTP Headers Dispatched to Your Server'}
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}`, color: textMuted, textAlign: isRtl ? 'right' : 'left' }}>
                    <th style={{ padding: '8px 12px' }}>{isRtl ? 'الترويسة' : 'Header Name'}</th>
                    <th style={{ padding: '8px 12px' }}>{isRtl ? 'مثال' : 'Example Value'}</th>
                    <th style={{ padding: '8px 12px' }}>{isRtl ? 'الغرض' : 'Purpose'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b', fontWeight: 600 }}>X-Instapay-Signature</td>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: textSecondary }}>v1=a1b2c3d4e5f6... (64 hex)</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'التوقيع المشفر HMAC-SHA256 المسبوق بـ v1=' : 'The computed HMAC-SHA256 signature prefixed with v1='}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', fontWeight: 600 }}>X-Instapay-Timestamp</td>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: textSecondary }}>1790807769</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'الطابع الزمني بالثواني (Unix epoch seconds) لحظة إرسال الطلب' : 'Unix epoch timestamp in seconds when the webhook was generated'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#a78bfa', fontWeight: 600 }}>X-Instapay-Event-Id</td>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: textSecondary }}>evt_3f8b1c2d4e5a6f...</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'معرّف فريد للحدث يمكن استخدامه لمنع معالجة الحدث مرتين (Idempotency)' : 'Unique dispatch event identifier useful for idempotent transaction processing'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#4ade80', fontWeight: 600 }}>X-Instapay-Signature-Version</td>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: textSecondary }}>v1</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'إصدار خوارزمية التوقيع المستخدمة' : 'Signature algorithm version (currently v1)'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: textMuted, fontWeight: 600 }}>User-Agent</td>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: textSecondary }}>InstaPay-Gateway-Webhook/2.0</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'معرّف برنامج الإرسال التابع للبوابة' : 'InstaPay Gateway dispatcher user agent string'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery & Retry Policy */}
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: textPrimary, marginBottom: '14px' }}>
              {isRtl ? 'سياسة إعادة الإرسال والمهلات (Retry Policy)' : 'Delivery Timeout & Exponential Backoff Policy'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { attempt: isRtl ? 'المحاولة 1' : 'Attempt 1', delay: '1 min', desc: isRtl ? 'بعد دقيقة واحدة من الفشل' : '1 minute delay' },
                { attempt: isRtl ? 'المحاولة 2' : 'Attempt 2', delay: '5 min', desc: isRtl ? 'بعد 5 دقائق من الفشل' : '5 minutes delay' },
                { attempt: isRtl ? 'المحاولة 3' : 'Attempt 3', delay: '15 min', desc: isRtl ? 'بعد 15 دقيقة من الفشل' : '15 minutes delay' },
                { attempt: isRtl ? 'المحاولة 4' : 'Attempt 4', delay: '1 hour', desc: isRtl ? 'بعد ساعة واحدة' : '1 hour delay' },
                { attempt: isRtl ? 'المحاولة 5' : 'Attempt 5', delay: '6 hours', desc: isRtl ? 'المحاولة الأخيرة' : '6 hours (final)' },
              ].map((r, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? '#162033' : '#f8fafc',
                  border: `1px solid ${borderColor}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>{r.attempt}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: textPrimary, margin: '4px 0' }}>{r.delay}</div>
                  <div style={{ fontSize: '11px', color: textMuted }}>{r.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : '#f0f9ff', border: isDark ? '1px solid rgba(56,189,248,0.2)' : '1px solid #bae6fd', fontSize: '12px', color: isDark ? '#7dd3fc' : '#0369a1' }}>
              💡 {isRtl
                ? 'يجب أن يرد خادمك بكود حالة HTTP بين 200 و 299 خلال 10 ثوانٍ لاعتبار الإشعار مسلّماً بنجاح وإيقاف جدول المحاولات.'
                : 'Your endpoint must acknowledge with an HTTP 2xx status within 10 seconds. Any other code or timeout triggers the automatic retry worker.'}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 4: Multi-Language SDK Snippets ─── */}
      {activeTab === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'node', label: 'Node.js (Express / TypeScript)' },
                  { id: 'python', label: 'Python (Flask / FastAPI)' },
                  { id: 'php', label: 'PHP' },
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLang(l.id as any)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: selectedLang === l.id ? 700 : 500,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: selectedLang === l.id
                        ? (isDark ? '#8b5cf6' : '#7c3aed')
                        : (isDark ? '#1e293b' : '#f1f5f9'),
                      color: selectedLang === l.id ? '#ffffff' : textSecondary,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  const code = selectedLang === 'node'
                    ? nodeVerificationCode
                    : selectedLang === 'python'
                    ? pythonVerificationCode
                    : phpVerificationCode;
                  copyToClipboard(code, `code_${selectedLang}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${borderColor}`,
                  color: copiedId === `code_${selectedLang}` ? '#34d399' : textPrimary,
                }}
              >
                {copiedId === `code_${selectedLang}` ? <Check size={14} /> : <Copy size={14} />}
                <span>
                  {copiedId === `code_${selectedLang}`
                    ? (isRtl ? 'تم نسخ الكود!' : 'Code Copied!')
                    : (isRtl ? 'نسخ كود التحقق بالكامل' : 'Copy Full Verification Code')}
                </span>
              </button>
            </div>

            <pre style={{
              ...codeBox({ padding: '18px 22px' }),
              fontSize: '12px',
              color: '#e2e8f0',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              margin: 0,
              lineHeight: 1.7,
              overflowX: 'auto',
              maxHeight: '520px',
            }}>
              {selectedLang === 'node' && nodeVerificationCode}
              {selectedLang === 'python' && pythonVerificationCode}
              {selectedLang === 'php' && phpVerificationCode}
            </pre>
          </div>
        </div>
      )}

      {/* ─── Tab 5: Events & Payloads ─── */}
      {activeTab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: '0 0 14px 0' }}>
              {isRtl ? 'أنواع أحداث الويب هوك المدعومة' : 'Supported Webhook Event Types'}
            </h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {[
                { id: 'confirmed', label: 'payment.confirmed', color: '#10b981', desc: isRtl ? 'تأكيد الدفع التام بالمبلغ المطلوب' : 'Full payment matched' },
                { id: 'underpaid', label: 'payment.underpaid', color: '#f59e0b', desc: isRtl ? 'تحويل مبلغ أقل من المطلوب' : 'Customer sent less than amount' },
                { id: 'overpaid', label: 'payment.overpaid', color: '#8b5cf6', desc: isRtl ? 'تحويل مبلغ أكبر من المطلوب' : 'Customer sent more than amount' },
                { id: 'subscription', label: 'subscription.payment_confirmed', color: '#38bdf8', desc: isRtl ? 'تجديد اشتراك باقة التاجر' : 'Merchant plan subscription renewed' },
              ].map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev.id as any)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    backgroundColor: selectedEvent === ev.id
                      ? (isDark ? '#1e293b' : '#e2e8f0')
                      : 'transparent',
                    border: selectedEvent === ev.id
                      ? `1px solid ${ev.color}`
                      : `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ev.color }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{ev.label}</span>
                </button>
              ))}
            </div>

            {/* Display selected event JSON */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                  Webhook Payload JSON ({selectedEvent})
                </span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(webhookPayloadExamples[selectedEvent], null, 2), `payload_${selectedEvent}`)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                >
                  {copiedId === `payload_${selectedEvent}` ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                  <span>{copiedId === `payload_${selectedEvent}` ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ JSON' : 'Copy JSON')}</span>
                </button>
              </div>
              <pre style={{
                ...codeBox({ padding: '16px 20px' }),
                fontSize: '12px',
                color: '#e2e8f0',
                fontFamily: "'JetBrains Mono', monospace",
                margin: 0,
                lineHeight: 1.6,
                overflowX: 'auto',
              }}>
                {JSON.stringify(webhookPayloadExamples[selectedEvent], null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 6: Lifecycle & Error Codes ─── */}
      {activeTab === 'errors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status lifecycle */}
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: '0 0 14px 0' }}>
              {isRtl ? 'دورة حياة جلسة الدفع (Transaction Status)' : 'Checkout Session Status Lifecycle'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { status: 'PENDING', desc: isRtl ? 'الجلسة مفتوحة وبانتظار قيام العميل بالتحويل' : 'Awaiting customer transfer', color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7' },
                { status: 'PAID', desc: isRtl ? 'تم استلام المبلغ المطابق وتأكيد الدفع' : 'Exact amount matched & verified', color: '#10b981', bg: isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7' },
                { status: 'UNDERPAID', desc: isRtl ? 'قام العميل بتحويل مبلغ أقل من المطلوب' : 'Received amount is less than expected', color: '#f97316', bg: isDark ? 'rgba(249,115,22,0.15)' : '#ffedd5' },
                { status: 'OVERPAID', desc: isRtl ? 'قام العميل بتحويل مبلغ أكبر من المطلوب' : 'Received amount exceeds expected', color: '#8b5cf6', bg: isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe' },
                { status: 'EXPIRED', desc: isRtl ? 'انتهت مدة صلاحية الجلسة قبل الدفع' : 'Session timed out before receipt', color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2' },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: s.bg,
                  border: `1px solid ${s.color}30`,
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: s.color,
                    marginBottom: '4px',
                  }}>
                    {s.status}
                  </div>
                  <div style={{ fontSize: '11.5px', color: isDark ? '#cbd5e1' : '#475569' }}>
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HTTP Error Codes */}
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: '0 0 14px 0' }}>
              {isRtl ? 'رموز استجابة HTTP وتفسيرها' : 'API HTTP Error Codes & Meanings'}
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}`, color: textMuted, textAlign: isRtl ? 'right' : 'left' }}>
                    <th style={{ padding: '8px 12px' }}>{isRtl ? 'الكود' : 'HTTP Code'}</th>
                    <th style={{ padding: '8px 12px' }}>{isRtl ? 'الخطأ' : 'Error Reason'}</th>
                    <th style={{ padding: '8px 12px' }}>{isRtl ? 'الحل المقترح' : 'Resolution'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#ef4444', fontWeight: 700 }}>401 Unauthorized</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>Missing Authorization header or invalid API key</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'تحقق من تمرير مفتاح API بصيغة Bearer egp_live_...' : 'Pass Authorization: Bearer <API_KEY> header properly'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b', fontWeight: 700 }}>400 Bad Request</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>amountEgp missing/invalid, quota limit reached, or subscription expired</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'تأكد من إدخال مبلغ صحيح أو قم بترقية وتجديد باقة متجرك' : 'Validate input values or renew/upgrade your merchant subscription'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', fontWeight: 700 }}>404 Not Found</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>Checkout session not found or belongs to another merchant</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'تحقق من صحة معرّف الجلسة sessionId' : 'Verify the sessionId parameter belongs to your account'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", color: '#ec4899', fontWeight: 700 }}>500 Internal Error</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>Unexpected server failure</td>
                    <td style={{ padding: '10px 12px', color: textSecondary }}>
                      {isRtl ? 'تواصل مع الدعم الفني للبوابة' : 'Contact InstaPay Gateway technical support'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
