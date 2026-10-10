import React, { useState, useEffect } from 'react';
import {
  BookOpen, Shield, Code2, Terminal, Check, Copy, ExternalLink,
  Lock, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Server, Zap, Clock, Send, FileCode2, ArrowRight, ShieldCheck,
  Eye, EyeOff, Layers, Hash, Info, Play, CheckCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { calculateHmacSha256 } from '../utils/cryptoUtils';

interface DocumentationSectionProps {
  apiKey?: string;
  webhookSecret?: string;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

type TabType = 'quickstart' | 'endpoints' | 'webhook' | 'tester' | 'code' | 'events' | 'errors';

export function DocumentationSection({ apiKey, webhookSecret, showToast }: DocumentationSectionProps) {
  const { isDark } = useTheme();
  const { lang, isRtl } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabType>('quickstart');
  const [useRealKeys, setUseRealKeys] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'create' | 'status' | 'snippets'>('create');
  const [codeType, setCodeType] = useState<'webhook' | 'create'>('webhook');
  const [selectedLang, setSelectedLang] = useState<'node' | 'python' | 'php' | 'go' | 'curl'>('node');
  const [selectedEvent, setSelectedEvent] = useState<'confirmed' | 'underpaid' | 'overpaid' | 'subscription'>('confirmed');

  // Interactive Webhook Signature Tester State
  const [testPayload, setTestPayload] = useState('{\n  "event": "payment.confirmed",\n  "transaction": {\n    "sessionId": "cmt_8f1b2c3d4e5f6a7b",\n    "amountEgp": 150.00,\n    "status": "PAID"\n  }\n}');
  const [testTimestamp, setTestTimestamp] = useState(Math.floor(Date.now() / 1000).toString());
  const [testSecret, setTestSecret] = useState(webhookSecret || 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0');
  const [calculatedBaseString, setCalculatedBaseString] = useState('');
  const [calculatedSignature, setCalculatedSignature] = useState('');
  const [verifyInputSig, setVerifyInputSig] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.4)' : '#e2e8f0';

  // Secure credential display: only show real keys if they match expected live prefixes
  const isValidApiKey = typeof apiKey === 'string' && apiKey.startsWith('egp_');
  const isValidWebhookSecret = typeof webhookSecret === 'string' && webhookSecret.startsWith('whsec_');

  const displayApiKey = useRealKeys && isValidApiKey ? apiKey : 'egp_live_9a7b3c2d1e0f8a4b6c8d0e2f';
  const displayWebhookSecret = useRealKeys && isValidWebhookSecret ? webhookSecret : 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0';
  const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';

  // Update tester secret when real secret is received
  useEffect(() => {
    if (isValidWebhookSecret && webhookSecret) {
      setTestSecret(webhookSecret);
    }
  }, [isValidWebhookSecret, webhookSecret]);

  // Compute live HMAC-SHA256 signature in browser using hybrid Web Crypto API + Pure JS Fallback
  const calculateTestSignature = async () => {
    try {
      const ts = testTimestamp.trim();
      const body = testPayload.trim();
      const secret = testSecret.trim();

      const baseString = `${ts}.${body}`;
      setCalculatedBaseString(baseString);

      if (!secret) {
        setCalculatedSignature('');
        setVerifyResult(null);
        return;
      }

      const hexSignature = await calculateHmacSha256(secret, baseString);
      setCalculatedSignature(hexSignature);

      if (verifyInputSig.trim()) {
        const cleanInput = verifyInputSig.trim().replace(/^v1=/, '');
        setVerifyResult(cleanInput.toLowerCase() === hexSignature.toLowerCase());
      } else {
        setVerifyResult(null);
      }
    } catch (err) {
      console.warn('HMAC signature calculation error:', err);
    }
  };

  useEffect(() => {
    calculateTestSignature();
  }, [testPayload, testTimestamp, testSecret, verifyInputSig]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (showToast) {
      showToast('success', isRtl ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
    }
  };

  const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => {
    const { padding, borderRadius, ...rest } = extra || {};
    return {
      backgroundColor: isDark ? '#111827' : '#ffffff',
      borderRadius: borderRadius || '14px',
      border: `1px solid ${borderColor}`,
      boxShadow: isDark
        ? '0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.25)'
        : '0 4px 16px rgba(0,0,0,0.05)',
      padding: padding ? (typeof padding === 'string' && padding.includes('clamp') ? padding : 'clamp(12px, 3.5vw, 22px)') : 'clamp(12px, 3.5vw, 22px)',
      ...rest,
    };
  };

  const codeBox = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#070b14' : '#0f172a',
    borderRadius: '12px',
    border: isDark ? '1px solid #1e293b' : 'none',
    overflow: 'hidden',
    ...extra,
  });

  /* ──────────────── Webhook Verification Code Snippets ──────────────── */
  const nodeVerificationCode = `import express from 'express';
import crypto from 'crypto';

const app = express();
const WEBHOOK_SECRET = process.env.INSTAPAY_WEBHOOK_SECRET || '${displayWebhookSecret}';

// IMPORTANT: Capture raw unparsed body for HMAC-SHA256 signature verification
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = req.headers['x-instapay-signature'] as string;
  const timestamp = req.headers['x-instapay-timestamp'] as string;
  const rawBody = req.body.toString('utf8');

  if (!signatureHeader || !timestamp) {
    return res.status(400).send('Missing X-Instapay-Signature or X-Instapay-Timestamp');
  }

  // 1. Anti-Replay: Verify timestamp is valid and within 300 seconds (5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(currentTime - ts) > 300) {
    return res.status(400).send('Webhook timestamp invalid or outside 5-minute tolerance');
  }

  // 2. Extract hex digest from 'v1=<signature>' header
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
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const computedBuffer = Buffer.from(computedSignature, 'utf8');

  if (
    signatureBuffer.length !== 64 ||
    computedBuffer.length !== 64 ||
    !crypto.timingSafeEqual(signatureBuffer, computedBuffer)
  ) {
    console.error('Invalid InstaPay webhook signature');
    return res.status(401).send('Signature verification failed');
  }

  // 6. Signature verified! Safely parse and process transaction payload
  const payload = JSON.parse(rawBody);
  const { event, transaction } = payload;
  console.log(\`Verified event \${event} for Session \${transaction.sessionId}\`);

  // IDEMPOTENCY: Check if transaction.sessionId has already been processed in your DB
  if (event === 'payment.confirmed') {
    // Exact payment matched: Fulfill order
    // e.g. fulfillOrder(transaction.sessionId, transaction.amountEgp, transaction.detectedRef);
  } else if (event === 'payment.underpaid') {
    // Customer paid less than amountEgp: notify customer of remaining balance
  } else if (event === 'payment.overpaid') {
    // Customer paid more than amountEgp: confirm order and issue customer credit
  }

  // Acknowledge receipt with HTTP 200 within 10 seconds to stop gateway retry attempts
  return res.status(200).json({ received: true });
});

app.listen(8080, () => console.log('Webhook server listening on port 8080'));`;

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
    try:
        ts = int(timestamp_header)
        if abs(int(time.time()) - ts) > 300:
            return jsonify({"error": "Timestamp outside tolerance window"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid timestamp format"}), 400

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

    # 6. Payload is authentic! Process event idempotently
    payload = json.loads(raw_body)
    event_type = payload.get("event")
    tx = payload.get("transaction", {})

    print(f"Verified event: {event_type} - Session ID: {tx.get('sessionId')}")

    # Return HTTP 200 within 10s to acknowledge receipt
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

// 2. Anti-Replay check: 300 second (5 min) tolerance window
$currentTime = time();
if (!is_numeric($timestampHeader) || abs($currentTime - intval($timestampHeader)) > 300) {
    http_response_code(400);
    exit('Timestamp invalid or outside 5-minute tolerance window');
}

// 3. Extract v1 signature
$signature = str_replace('v1=', '', $signatureHeader);

// 4. Construct base string and calculate HMAC-SHA256
$baseString        = $timestampHeader . '.' . $rawBody;
$computedSignature = hash_hmac('sha256', $baseString, $webhookSecret);

// 5. Constant-time string comparison (timing attack protection)
if (!hash_equals($signature, $computedSignature)) {
    http_response_code(401);
    exit('Webhook signature verification failed');
}

// 6. Process verified payload
$data = json_decode($rawBody, true);
$event = $data['event'] ?? '';
$tx = $data['transaction'] ?? [];

// Acknowledge receipt with 200 OK
http_response_code(200);
echo json_encode(['received' => true]);`;

  const goVerificationCode = `package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const webhookSecret = "${displayWebhookSecret}"

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	sigHeader := r.Header.Get("X-Instapay-Signature")
	tsHeader := r.Header.Get("X-Instapay-Timestamp")
	if sigHeader == "" || tsHeader == "" {
		http.Error(w, "Missing required signature headers", http.StatusBadRequest)
		return
	}

	// 1. Anti-Replay: 300 second (5 min) tolerance window
	timestamp, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil || math.Abs(float64(time.Now().Unix()-timestamp)) > 300 {
		http.Error(w, "Timestamp outside 5-minute tolerance", http.StatusBadRequest)
		return
	}

	// 2. Read raw unparsed body bytes
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}

	// 3. Compute HMAC-SHA256 over "<timestamp>.<rawBody>"
	baseString := append([]byte(tsHeader+"."), rawBody...)
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(baseString)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	incomingSig := strings.TrimPrefix(sigHeader, "v1=")

	// 4. Constant-time comparison (prevents timing attacks)
	if subtle.ConstantTimeCompare([]byte(incomingSig), []byte(expectedSig)) != 1 {
		http.Error(w, "Signature mismatch", http.StatusUnauthorized)
		return
	}

	// 5. Signature verified! Parse and process event idempotently
	var payload map[string]interface{}
	if err := json.Unmarshal(rawBody, &payload); err == nil {
		fmt.Printf("Verified Event: %v\\n", payload["event"])
	}

	// Acknowledge receipt with 200 OK within 10 seconds
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(\`{"received":true}\`))
}

func main() {
	http.HandleFunc("/api/webhook", webhookHandler)
	fmt.Println("Listening for InstaPay webhooks on :8080...")
	http.ListenAndServe(":8080", nil)
}`;

  const curlVerificationCode = `# Simulate an inbound signed webhook delivery to your local endpoint:
TIMESTAMP=$(date +%s)
SECRET="${displayWebhookSecret}"
PAYLOAD='{"event":"payment.confirmed","transaction":{"sessionId":"cmt_test_8f1b2c","amountEgp":150.00,"status":"CONFIRMED","detectedRef":"REF20261010"}}'

# Compute HMAC-SHA256 signature over "<timestamp>.<rawJsonBody>"
SIG=$(echo -n "\${TIMESTAMP}.\${PAYLOAD}" | openssl dgst -sha256 -hmac "\${SECRET}" | sed 's/^.* //')

# Dispatch webhook test request:
curl -X POST "http://localhost:8080/api/webhook" \\
  -H "Content-Type: application/json" \\
  -H "X-Instapay-Timestamp: \${TIMESTAMP}" \\
  -H "X-Instapay-Signature: v1=\${SIG}" \\
  -H "X-Instapay-Event-Id: evt_manual_test_01" \\
  -d "\${PAYLOAD}"`;

  /* ──────────────── Checkout Creation Code Snippets ──────────────── */
  const nodeCreateCode = `import axios from 'axios';

const API_KEY = process.env.INSTAPAY_API_KEY || '${displayApiKey}';
const BASE_URL = '${baseUrl}';

async function createCheckoutSession(amountEgp, orderId, customerHandle) {
  try {
    const response = await axios.post(
      \`\${BASE_URL}/api/v1/checkout/create\`,
      {
        amountEgp: Number(amountEgp),
        senderHandle: customerHandle || 'customer@instapay',
        note: \`Order #\${orderId}\`,
      },
      {
        headers: {
          'Authorization': \`Bearer \${API_KEY}\`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const { checkout } = response.data;
    console.log('Session Created:', checkout.sessionId);
    console.log('Customer Payment URL:', checkout.checkoutUrl);
    console.log('Direct InstaPay App Deep Link:', checkout.deepLinkUrl);

    // Redirect customer to checkout.checkoutUrl
    return checkout;
  } catch (error) {
    console.error('Failed to create checkout:', error.response?.data || error.message);
    throw error;
  }
}`;

  const pythonCreateCode = `import requests

API_KEY = "${displayApiKey}"
BASE_URL = "${baseUrl}"

def create_checkout_session(amount_egp, order_id, customer_handle="customer@instapay"):
    url = f"{BASE_URL}/api/v1/checkout/create"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "amountEgp": float(amount_egp),
        "senderHandle": customer_handle,
        "note": f"Order #{order_id}"
    }

    response = requests.post(url, json=payload, headers=headers, timeout=10)
    response.raise_for_status()

    data = response.json()
    checkout = data["checkout"]
    print("Session ID:", checkout["sessionId"])
    print("Checkout URL:", checkout["checkoutUrl"])
    return checkout`;

  const phpCreateCode = `<?php
function createCheckoutSession($amountEgp, $orderId, $customerHandle = 'customer@instapay') {
    $apiKey  = '${displayApiKey}';
    $baseUrl = '${baseUrl}';

    $payload = json_encode([
        'amountEgp'    => floatval($amountEgp),
        'senderHandle' => $customerHandle,
        'note'         => 'Order #' . $orderId,
    ]);

    $ch = curl_init("$baseUrl/api/v1/checkout/create");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 201) {
        throw new Exception("Checkout creation failed with HTTP $httpCode: $response");
    }

    $result = json_decode($response, true);
    return $result['checkout'];
}`;

  const goCreateCode = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const apiKey = "${displayApiKey}"
const baseURL = "${baseUrl}"

type CreateCheckoutRequest struct {
	AmountEgp    float64 \`json:"amountEgp"\`
	SenderHandle string  \`json:"senderHandle"\`
	Note         string  \`json:"note"\`
}

type CheckoutResponse struct {
	Ok       bool \`json:"ok"\`
	Checkout struct {
		SessionId   string  \`json:"sessionId"\`
		CheckoutUrl string  \`json:"checkoutUrl"\`
		DeepLinkUrl string  \`json:"deepLinkUrl"\`
		AmountEgp   float64 \`json:"amountEgp"\`
	} \`json:"checkout"\`
}

func createCheckout(amount float64, orderID string) (*CheckoutResponse, error) {
	reqBody, _ := json.Marshal(CreateCheckoutRequest{
		AmountEgp:    amount,
		SenderHandle: "customer@instapay",
		Note:         "Order #" + orderID,
	})

	req, err := http.NewRequest("POST", baseURL+"/api/v1/checkout/create", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result CheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func main() {
	res, err := createCheckout(150.00, "1042")
	if err != nil {
		panic(err)
	}
	fmt.Printf("Payment URL: %s\\n", res.Checkout.CheckoutUrl)
}`;

  const curlCreateCode = `# Create a new checkout session using cURL:
curl -X POST "${baseUrl}/api/v1/checkout/create" \\
  -H "Authorization: Bearer ${displayApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'

# Query checkout status:
# curl -X GET "${baseUrl}/api/v1/checkout/status?sessionId=cmt_..." \\
#   -H "Authorization: Bearer ${displayApiKey}"`;

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
      {/* ─── Main Section Header Banner ─── */}
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

            <a
              href="/api/docs/integration-guide"
              target="_blank"
              rel="noopener noreferrer"
              download="InstaPay_Gateway_API_Integration_Guide.md"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer',
                backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : '#e0f2fe',
                color: isDark ? '#38bdf8' : '#0284c7',
                border: isDark ? '1px solid rgba(56,189,248,0.3)' : '1px solid #bae6fd',
                transition: 'all 0.2s ease',
              }}
              title={isRtl ? 'تحميل دليل التكامل الشامل بصيغة Markdown' : 'Download Complete API Integration Guide (.md)'}
            >
              <ExternalLink size={14} />
              <span>{isRtl ? 'دليل التكامل الشامل (.md)' : 'Full Integration Guide (.md)'}</span>
            </a>
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
            { id: 'endpoints', label: isRtl ? 'نقاط API (Checkout)' : 'Checkout Endpoints', icon: Code2 },
            { id: 'webhook', label: isRtl ? 'التحقق من التوقيع (HMAC)' : 'HMAC-SHA256 Webhook', icon: ShieldCheck },
            { id: 'tester', label: isRtl ? 'مختبر التوقيع الحي' : 'Live Signature Tester', icon: Play },
            { id: 'code', label: isRtl ? 'نماذج الشيفرة (SDK)' : 'Code Examples (SDK)', icon: Terminal },
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
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
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
                <Icon size={13} />
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

          {/* Security & Production Checklist Card */}
          <div style={{
            ...cardStyle({ padding: '24px' }),
            background: isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(56,189,248,0.05))'
              : 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
            border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #bbf7d0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <ShieldCheck size={20} color="#10b981" />
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? 'قائمة الأمان وأفضل ممارسات الإنتاج' : 'Security & Production Best Practices Checklist'}
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {[
                { title: isRtl ? 'حفظ المفاتيح على الخادم فقط' : 'Server-Side Secret Storage', desc: isRtl ? 'لا تضع مفتاح API أو سر الويب هوك أبداً في كود الواجهة الأمامية أو تطبيقات الهاتف.' : 'Never expose API Keys or Webhook Secrets in frontend code or mobile applications.' },
                { title: isRtl ? 'إلزامية HTTPS للإنتاج' : 'Mandatory HTTPS in Production', desc: isRtl ? 'يجب أن يكون رابط الويب هوك في بيئة الإنتاج مشفراً بـ HTTPS وبشهادة صالحة.' : 'Webhook callback URLs must use valid TLS/HTTPS in production. HTTP is restricted to localhost.' },
                { title: isRtl ? 'منع المعالجة المكررة (Idempotency)' : 'Idempotent Webhook Handling', desc: isRtl ? 'احفظ معرّف الحدث X-Instapay-Event-Id وتأكد من عدم تنفيذ الطلب أكثر من مرة عند إعادة الإرسال.' : 'Track X-Instapay-Event-Id to ensure duplicate retried webhooks do not double-fulfill orders.' },
                { title: isRtl ? 'الرد الفوري بكود 200' : 'Acknowledge Within 10 Seconds', desc: isRtl ? 'أرسل كود HTTP 200 فور التحقق من التوقيع ثم نفذ المهام الثقيلة في الخلفية لتجنب انتهاء المهلة.' : 'Return HTTP 200 within 10s. Offload heavy processing to background worker queues.' },
              ].map((item, idx) => (
                <div key={idx} style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? '#162033' : '#ffffff',
                  border: `1px solid ${borderColor}`,
                }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
                    ✓ {item.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: textSecondary, lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
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
                          checkoutUrl: `${baseUrl}/pay/cmt_8f1b2c3d4e5f6a7b`,
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
                    ? 'تحقق من ترويسة X-Instapay-Timestamp واشترط أن يكون الفارق الزمني أقل من 300 ثانية (5 دقائق) ورقمياً صالحاً لمنع المهاجمين من إعادة إرسال طلبات قديمة.'
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
                    ? 'استخدم دالة مقارنة ثابتة التوقيت مثل crypto.timingSafeEqual أو hmac.compare_digest لمنع هجمات التحليل الزمني (Timing Attacks).'
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

      {/* ─── Tab 4: Live Webhook Signature Tester & Debugger ─── */}
      {activeTab === 'tester' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ ...cardStyle({ padding: 'clamp(14px, 3.5vw, 24px)' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Play size={18} color="white" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'مختبر وحاسبة التوقيع اللحظي (HMAC-SHA256 Tester)' : 'Live Webhook Signature Calculator & Validator'}
                </h4>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0', lineHeight: 1.4 }}>
                  {isRtl ? 'احسب التوقيع فورياً وتحقق من تطابق كود الخادم الخاص بك مع محرك البوابة' : 'Compute and test HMAC signatures live in browser to verify your integration against the gateway.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px', marginBottom: '18px' }}>
              {/* Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'مفتاح الويب هوك السري (Webhook Secret)' : 'Webhook Secret'}
                  </label>
                  <input
                    type="text"
                    value={testSecret}
                    onChange={(e) => setTestSecret(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1px solid ${borderColor}`,
                      color: textPrimary,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>
                      {isRtl ? 'الطابع الزمني (Unix Timestamp)' : 'Timestamp (Unix seconds)'}
                    </label>
                    <button
                      onClick={() => setTestTimestamp(Math.floor(Date.now() / 1000).toString())}
                      style={{ fontSize: '11px', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {isRtl ? 'الآن (Now)' : 'Set to Now'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={testTimestamp}
                    onChange={(e) => setTestTimestamp(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1px solid ${borderColor}`,
                      color: textPrimary,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'نص الطلب الخام (Raw JSON Body)' : 'Raw JSON Body'}
                  </label>
                  <textarea
                    rows={6}
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1px solid ${borderColor}`,
                      color: textPrimary,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              {/* Live Output */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '6px' }}>
                    {isRtl ? 'النص الأساسي للتوقيع (Base String):' : 'Constructed Base String:'}
                  </span>
                  <div style={{
                    ...codeBox({ padding: '10px 14px' }),
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontFamily: "'JetBrains Mono', monospace",
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '90px',
                    overflowY: 'auto',
                  }}>
                    {calculatedBaseString}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>
                      {isRtl ? 'التوقيع المحسوب (Computed X-Instapay-Signature):' : 'Computed X-Instapay-Signature Header:'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(`v1=${calculatedSignature}`, 'calculatedsig')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    >
                      {copiedId === 'calculatedsig' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                      <span>{copiedId === 'calculatedsig' ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                    </button>
                  </div>
                  <div style={{
                    ...codeBox({ padding: '12px 14px' }),
                    fontSize: '11.5px',
                    color: '#4ade80',
                    fontFamily: "'JetBrains Mono', monospace",
                    wordBreak: 'break-all',
                  }}>
                    v1={calculatedSignature || '...'}
                  </div>
                </div>

                {/* Match checker */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'اختبار تطابق توقيع خارجي (Compare incoming signature):' : 'Paste signature to test match:'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="v1=..."
                      value={verifyInputSig}
                      onChange={(e) => setVerifyInputSig(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 'min(100%, 180px)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: "'JetBrains Mono', monospace",
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        border: `1px solid ${borderColor}`,
                        color: textPrimary,
                        outline: 'none',
                      }}
                    />
                    {verifyResult !== null && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: verifyResult
                          ? (isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7')
                          : (isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2'),
                        color: verifyResult ? '#10b981' : '#ef4444',
                        whiteSpace: 'nowrap',
                      }}>
                        {verifyResult ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                        <span>{verifyResult ? (isRtl ? 'متطابق بنجاح ✓' : 'MATCH ✓') : (isRtl ? 'غير متطابق ✕' : 'MISMATCH ✕')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 5: Multi-Language Integration & Verification Code (SDK) ─── */}
      {activeTab === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ ...cardStyle({ padding: '24px' }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                  <button
                    onClick={() => setCodeType('webhook')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: codeType === 'webhook' ? 700 : 500,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: codeType === 'webhook' ? (isDark ? '#8b5cf6' : '#7c3aed') : 'transparent',
                      color: codeType === 'webhook' ? '#ffffff' : textSecondary,
                    }}
                  >
                    {isRtl ? 'التحقق من الويب هوك (HMAC)' : 'Verify Webhook'}
                  </button>
                  <button
                    onClick={() => setCodeType('create')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: codeType === 'create' ? 700 : 500,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: codeType === 'create' ? (isDark ? '#8b5cf6' : '#7c3aed') : 'transparent',
                      color: codeType === 'create' ? '#ffffff' : textSecondary,
                    }}
                  >
                    {isRtl ? 'إنشاء جلسة دفع (Checkout)' : 'Create Checkout'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'node', label: 'Node.js' },
                    { id: 'python', label: 'Python' },
                    { id: 'php', label: 'PHP' },
                    { id: 'go', label: 'Go' },
                    { id: 'curl', label: 'cURL (CLI)' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedLang(l.id as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: selectedLang === l.id ? 700 : 500,
                        cursor: 'pointer',
                        border: selectedLang === l.id ? `1px solid ${isDark ? '#8b5cf6' : '#7c3aed'}` : `1px solid ${borderColor}`,
                        backgroundColor: selectedLang === l.id ? (isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe') : 'transparent',
                        color: selectedLang === l.id ? (isDark ? '#c084fc' : '#6d28d9') : textSecondary,
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  let code = '';
                  if (codeType === 'webhook') {
                    if (selectedLang === 'node') code = nodeVerificationCode;
                    else if (selectedLang === 'python') code = pythonVerificationCode;
                    else if (selectedLang === 'php') code = phpVerificationCode;
                    else if (selectedLang === 'go') code = goVerificationCode;
                    else if (selectedLang === 'curl') code = curlVerificationCode;
                  } else {
                    if (selectedLang === 'node') code = nodeCreateCode;
                    else if (selectedLang === 'python') code = pythonCreateCode;
                    else if (selectedLang === 'php') code = phpCreateCode;
                    else if (selectedLang === 'go') code = goCreateCode;
                    else if (selectedLang === 'curl') code = curlCreateCode;
                  }
                  copyToClipboard(code, `code_${codeType}_${selectedLang}`);
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
                  color: copiedId === `code_${codeType}_${selectedLang}` ? '#34d399' : textPrimary,
                }}
              >
                {copiedId === `code_${codeType}_${selectedLang}` ? <Check size={14} /> : <Copy size={14} />}
                <span>
                  {copiedId === `code_${codeType}_${selectedLang}`
                    ? (isRtl ? 'تم نسخ الشيفرة!' : 'Code Copied!')
                    : (isRtl ? 'نسخ الشيفرة بالكامل' : 'Copy Full Snippet')}
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
              {codeType === 'webhook' && selectedLang === 'node' && nodeVerificationCode}
              {codeType === 'webhook' && selectedLang === 'python' && pythonVerificationCode}
              {codeType === 'webhook' && selectedLang === 'php' && phpVerificationCode}
              {codeType === 'webhook' && selectedLang === 'go' && goVerificationCode}
              {codeType === 'webhook' && selectedLang === 'curl' && curlVerificationCode}
              {codeType === 'create' && selectedLang === 'node' && nodeCreateCode}
              {codeType === 'create' && selectedLang === 'python' && pythonCreateCode}
              {codeType === 'create' && selectedLang === 'php' && phpCreateCode}
              {codeType === 'create' && selectedLang === 'go' && goCreateCode}
              {codeType === 'create' && selectedLang === 'curl' && curlCreateCode}
            </pre>
          </div>
        </div>
      )}

      {/* ─── Tab 6: Events & Payloads ─── */}
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

      {/* ─── Tab 7: Lifecycle & Error Codes ─── */}
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
