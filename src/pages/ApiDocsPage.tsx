import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Shield, Code2, Terminal, Check, Copy, ExternalLink,
  Lock, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Server, Zap, Clock, Send, FileCode2, ArrowRight, ShieldCheck,
  Eye, EyeOff, Layers, Hash, Info, Play, CheckCircle, Search,
  ArrowLeft, Smartphone, Globe, Sun, Moon, Cpu, Download, Sparkles,
  HelpCircle, CheckSquare, Square, Filter, ChevronRight, Sliders
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { calculateHmacSha256 } from '../utils/cryptoUtils';

interface ApiDocsPageProps {
  inApp?: boolean;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: any) => void;
}

type LangOption = 'node' | 'python' | 'php' | 'go' | 'curl';

export function ApiDocsPage({ inApp = false }: ApiDocsPageProps) {
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, isRtl } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('intro');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // SDK selector state
  const [selectedLang, setSelectedLang] = useState<LangOption>('node');
  const [selectedCodeType, setSelectedCodeType] = useState<'create' | 'webhook'>('create');
  const [selectedEventTab, setSelectedEventTab] = useState<'confirmed' | 'underpaid' | 'overpaid' | 'expired'>('confirmed');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Interactive Live Webhook Tester State
  const defaultPayload = JSON.stringify({
    event: "payment.confirmed",
    event_id: "evt_live_7a8b9c0d1e2f3a4b",
    timestamp: Math.floor(Date.now() / 1000),
    transaction: {
      sessionId: "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
      amountEgp: 150.00,
      status: "CONFIRMED",
      detectedRef: "REF20261010992",
      senderHandle: "customer@instapay",
      confirmedAt: new Date().toISOString()
    }
  }, null, 2);

  const [testerSecret, setTesterSecret] = useState('whsec_e8f2a1b9c3d4e5f6a7b8c9d0');
  const [testerTimestamp, setTesterTimestamp] = useState(Math.floor(Date.now() / 1000).toString());
  const [testerPayload, setTesterPayload] = useState(defaultPayload);
  const [calculatedBaseString, setCalculatedBaseString] = useState('');
  const [calculatedSignature, setCalculatedSignature] = useState('');
  const [verifyInputSig, setVerifyInputSig] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

  // Production Readiness Checklist State
  const [checkedList, setCheckedList] = useState<Record<string, boolean>>({
    tls: true,
    secret_storage: true,
    timing_safe: true,
    drift_tolerance: false,
    raw_body: false,
    idempotency: true,
    retry_handling: false,
    status_polling_fallback: true
  });

  const toggleCheck = (key: string) => {
    setCheckedList(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const checklistProgress = useMemo(() => {
    const total = Object.keys(checkedList).length;
    const completed = Object.values(checkedList).filter(Boolean).length;
    return Math.round((completed / total) * 100);
  }, [checkedList]);

  // Handle URL hash navigation on scroll or mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setActiveSection(hash);
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  // Recalculate HMAC on tester changes
  useEffect(() => {
    try {
      const baseString = `${testerTimestamp.trim()}.${testerPayload.trim()}`;
      setCalculatedBaseString(baseString);
      calculateHmacSha256(testerSecret.trim(), baseString).then((sig) => {
        setCalculatedSignature(sig);
        if (verifyInputSig.trim()) {
          const cleanInput = verifyInputSig.trim().replace(/^v1=/, '');
          setVerifyResult(cleanInput.toLowerCase() === sig.toLowerCase());
        } else {
          setVerifyResult(null);
        }
      });
    } catch {
      setCalculatedSignature('');
    }
  }, [testerSecret, testerTimestamp, testerPayload, verifyInputSig]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
    }
  };

  /* ──────────────── Theme & Style Tokens ──────────────── */
  const bgMain = isDark ? '#0b0f19' : '#f8fafc';
  const bgCard = isDark ? '#111827' : '#ffffff';
  const bgCardHover = isDark ? '#1a2234' : '#f1f5f9';
  const borderCard = isDark ? 'rgba(51, 65, 85, 0.45)' : '#e2e8f0';
  const borderSubtle = isDark ? 'rgba(51, 65, 85, 0.3)' : '#f1f5f9';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const codeBg = isDark ? '#060911' : '#0f172a';
  const codeText = '#e2e8f0';
  const accentSky = '#38bdf8';
  const accentIndigo = '#6366f1';
  const accentEmerald = '#10b981';
  const accentRose = '#f43f5e';
  const accentAmber = '#f59e0b';

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'https://api.yourdomain.com';

  /* ──────────────── Code Snippets ──────────────── */
  const nodeCreateSnippet = `import axios from 'axios';

const API_KEY = process.env.INSTAPAY_API_KEY || 'egp_live_9a7b3c2d1e0f8a4b6c8d0e2f';
const BASE_URL = '${baseUrl}';

export async function createCheckout(amountEgp: number, orderId: string) {
  try {
    const response = await axios.post(
      \`\${BASE_URL}/api/v1/checkout/create\`,
      {
        amountEgp,
        senderHandle: 'customer@instapay',
        note: \`Order #\${orderId}\`,
      },
      {
        headers: {
          'Authorization': \`Bearer \${API_KEY}\`,
          'Content-Type': 'application/json',
          'Idempotency-Key': \`order-\${orderId}-\${Date.now()}\`,
        },
        timeout: 10000,
      }
    );

    const { checkout } = response.data;
    console.log('✓ Payment session created:', checkout.sessionId);
    console.log('🔗 Redirect URL:', checkout.checkoutUrl);
    console.log('📱 Mobile Deep Link:', checkout.deepLinkUrl);
    return checkout;
  } catch (err: any) {
    console.error('Checkout error:', err.response?.data || err.message);
    throw err;
  }
}`;

  const pythonCreateSnippet = `import requests
import uuid

API_KEY = "egp_live_9a7b3c2d1e0f8a4b6c8d0e2f"
BASE_URL = "${baseUrl}"

def create_checkout(amount_egp: float, order_id: str) -> dict:
    url = f"{BASE_URL}/api/v1/checkout/create"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Idempotency-Key": f"order_{order_id}_{uuid.uuid4().hex[:8]}"
    }
    payload = {
        "amountEgp": amount_egp,
        "senderHandle": "customer@instapay",
        "note": f"Order #{order_id}"
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    response.raise_for_status()
    data = response.json()
    return data["checkout"]

# Example:
# session = create_checkout(150.00, "1042")
# print("Checkout URL:", session["checkoutUrl"])`;

  const phpCreateSnippet = `<?php
declare(strict_types=1);

function createCheckoutSession(float $amountEgp, string $orderId): array {
    $apiKey  = getenv('INSTAPAY_API_KEY') ?: 'egp_live_9a7b3c2d1e0f8a4b6c8d0e2f';
    $baseUrl = '${baseUrl}';

    $payload = json_encode([
        'amountEgp'    => $amountEgp,
        'senderHandle' => 'customer@instapay',
        'note'         => "Order #{$orderId}"
    ], JSON_THROW_ON_ERROR);

    $ch = curl_init("{$baseUrl}/api/v1/checkout/create");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer {$apiKey}",
            'Content-Type: application/json',
            'Idempotency-Key: ' . uniqid("order_{$orderId}_", true)
        ],
        CURLOPT_TIMEOUT        => 10,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 201 && $httpCode !== 200) {
        throw new RuntimeException("API Error {$httpCode}: {$response}");
    }

    $result = json_decode($response, true);
    return $result['checkout'];
}`;

  const goCreateSnippet = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const (
	apiKey  = "egp_live_9a7b3c2d1e0f8a4b6c8d0e2f"
	baseURL = "${baseUrl}"
)

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
	req.Header.Set("Idempotency-Key", fmt.Sprintf("order_%s_%d", orderID, time.Now().Unix()))

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
	fmt.Printf("Checkout URL: %s\\n", res.Checkout.CheckoutUrl)
}`;

  const curlCreateSnippet = `# 1. Create a Checkout Session
curl -X POST "${baseUrl}/api/v1/checkout/create" \\
  -H "Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: test_$(date +%s)" \\
  -d '{
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'

# 2. Check Session Status
curl -X GET "${baseUrl}/api/v1/checkout/status?sessionId=cmt_test_8f1b2c" \\
  -H "Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f"`;

  const nodeWebhookSnippet = `import express from 'express';
import crypto from 'crypto';

const app = express();
const WEBHOOK_SECRET = process.env.INSTAPAY_WEBHOOK_SECRET || 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0';

// CRITICAL: Preserve the exact raw body Buffer for HMAC verification
app.post(
  '/api/webhook/instapay',
  express.raw({ type: 'application/json' }),
  (req: express.Request, res: express.Response) => {
    const rawBodyBuffer = req.body as Buffer;
    const rawBody = rawBodyBuffer.toString('utf8');

    const signatureHeader = req.headers['x-instapay-signature'] as string;
    const timestampHeader = req.headers['x-instapay-timestamp'] as string;
    const eventId = req.headers['x-instapay-event-id'] as string;

    if (!signatureHeader || !timestampHeader) {
      return res.status(401).send('Missing webhook signature headers');
    }

    // 1. Anti-Replay Defense: Verify timestamp is within 300 seconds
    const nowSec = Math.floor(Date.now() / 1000);
    const sentSec = parseInt(timestampHeader, 10);
    if (isNaN(sentSec) || Math.abs(nowSec - sentSec) > 300) {
      return res.status(401).send('Webhook timestamp outside 5-minute tolerance window');
    }

    // 2. Compute HMAC-SHA256 over: "<timestamp>.<rawJsonBody>"
    const baseString = \`\${timestampHeader}.\${rawBody}\`;
    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(baseString, 'utf8')
      .digest('hex');

    const receivedSig = signatureHeader.replace(/^v1=/, '');

    // 3. Timing-Safe Equality Comparison
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    const receivedBuffer = Buffer.from(receivedSig, 'hex');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      console.warn('⚠️ Invalid webhook signature!');
      return res.status(401).send('Invalid signature');
    }

    // 4. Safe to parse and process event
    const event = JSON.parse(rawBody);
    console.log(\`✓ Processing Verified Event [\${eventId}]: \${event.event}\`);

    switch (event.event) {
      case 'payment.confirmed':
        const { sessionId, amountEgp, detectedRef } = event.transaction;
        // Fulfill order atomically in your database
        console.log(\`✅ Payment \${sessionId} confirmed for \${amountEgp} EGP (Ref: \${detectedRef})\`);
        break;

      case 'payment.underpaid':
        console.log('⚠️ Payment underpaid:', event.transaction);
        break;

      case 'payment.overpaid':
        console.log('ℹ️ Payment overpaid:', event.transaction);
        break;

      case 'payment.expired':
        console.log('⏰ Checkout expired without payment:', event.transaction);
        break;
    }

    // Return 200 OK immediately to acknowledge receipt
    return res.status(200).json({ received: true });
  }
);

app.listen(8080, () => console.log('Webhook receiver running on port 8080'));`;

  const pythonWebhookSnippet = `from fastapi import FastAPI, Request, HTTPException, Header
import hmac
import hashlib
import time
import json

app = FastAPI()
WEBHOOK_SECRET = "whsec_e8f2a1b9c3d4e5f6a7b8c9d0"

@app.post("/api/webhook/instapay")
async def handle_instapay_webhook(
    request: Request,
    x_instapay_signature: str = Header(None),
    x_instapay_timestamp: str = Header(None),
    x_instapay_event_id: str = Header(None)
):
    if not x_instapay_signature or not x_instapay_timestamp:
        raise HTTPException(status_code=401, detail="Missing required headers")

    # 1. Anti-Replay Defense: Check timestamp tolerance (300 seconds)
    try:
        sent_time = int(x_instapay_timestamp)
        if abs(time.time() - sent_time) > 300:
            raise HTTPException(status_code=401, detail="Timestamp outside tolerance")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp format")

    # 2. Read RAW request bytes directly (DO NOT parse JSON first)
    raw_body = await request.body()
    base_string = f"{x_instapay_timestamp}.".encode("utf-8") + raw_body

    # 3. Compute HMAC-SHA256 signature
    computed_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        base_string,
        hashlib.sha256
    ).hexdigest()

    received_sig = x_instapay_signature.removeprefix("v1=")

    # 4. Timing-safe comparison to prevent side-channel timing leaks
    if not hmac.compare_digest(computed_sig, received_sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 5. Successfully authenticated
    event = json.loads(raw_body)
    event_type = event.get("event")
    print(f"✓ Verified Event [{x_instapay_event_id}]: {event_type}")

    if event_type == "payment.confirmed":
        tx = event["transaction"]
        print(f"✅ Order confirmed: {tx['sessionId']} ({tx['amountEgp']} EGP)")

    return {"received": True}`;

  const phpWebhookSnippet = `<?php
declare(strict_types=1);

$secret = getenv('INSTAPAY_WEBHOOK_SECRET') ?: 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0';

// 1. Read exact RAW payload from standard input
$rawBody = file_get_contents('php://input');

$signatureHeader = $_SERVER['HTTP_X_INSTAPAY_SIGNATURE'] ?? '';
$timestampHeader = $_SERVER['HTTP_X_INSTAPAY_TIMESTAMP'] ?? '';
$eventId         = $_SERVER['HTTP_X_INSTAPAY_EVENT_ID'] ?? '';

if (!$signatureHeader || !$timestampHeader) {
    http_response_code(401);
    die('Missing signature headers');
}

// 2. Anti-Replay Defense: Max 300s clock drift
$sentTime = (int)$timestampHeader;
if (abs(time() - $sentTime) > 300) {
    http_response_code(401);
    die('Timestamp outside 5-minute window');
}

// 3. Compute HMAC-SHA256 over: "<timestamp>.<rawJsonBody>"
$baseString  = "{$timestampHeader}.{$rawBody}";
$expectedSig = hash_hmac('sha256', $baseString, $secret);
$receivedSig = preg_replace('/^v1=/', '', $signatureHeader);

// 4. Timing-safe comparison using hash_equals
if (!hash_equals($expectedSig, $receivedSig)) {
    http_response_code(401);
    die('Invalid HMAC signature');
}

// 5. Parse JSON and fulfill purchase
$event = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);

if ($event['event'] === 'payment.confirmed') {
    $session = $event['transaction'];
    // Mark order as paid in DB
}

http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['received' => true]);`;

  const goWebhookSnippet = `package main

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

const webhookSecret = "whsec_e8f2a1b9c3d4e5f6a7b8c9d0"

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sigHeader := r.Header.Get("X-Instapay-Signature")
	tsHeader := r.Header.Get("X-Instapay-Timestamp")
	if sigHeader == "" || tsHeader == "" {
		http.Error(w, "Missing signature headers", http.StatusUnauthorized)
		return
	}

	// 1. Timestamp validation (within 5 minutes)
	ts, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil || math.Abs(float64(time.Now().Unix()-ts)) > 300 {
		http.Error(w, "Timestamp drift exceeded", http.StatusUnauthorized)
		return
	}

	// 2. Read RAW request body
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Cannot read body", http.StatusBadRequest)
		return
	}

	// 3. Compute HMAC-SHA256
	base := append([]byte(tsHeader+"."), rawBody...)
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(base)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	receivedSig := strings.TrimPrefix(sigHeader, "v1=")

	// 4. Constant time comparison
	if subtle.ConstantTimeCompare([]byte(expectedSig), []byte(receivedSig)) != 1 {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	// 5. Unmarshal and dispatch event
	var event map[string]interface{}
	json.Unmarshal(rawBody, &event)
	fmt.Printf("✓ Validated event: %v\\n", event["event"])

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(\`{"received":true}\`))
}

func main() {
	http.HandleFunc("/api/webhook", webhookHandler)
	http.ListenAndServe(":8080", nil)
}`;

  const curlWebhookSnippet = `# Simulate an inbound signed webhook test to your local server:
TIMESTAMP=$(date +%s)
SECRET="whsec_e8f2a1b9c3d4e5f6a7b8c9d0"
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

  const eventPayloads = {
    confirmed: {
      event: "payment.confirmed",
      event_id: "evt_live_8f1a2b3c4d5e",
      timestamp: 1760119200,
      transaction: {
        sessionId: "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
        status: "CONFIRMED",
        amountEgp: 150.00,
        currency: "EGP",
        senderHandle: "customer@instapay",
        recipientHandle: "merchant@instapay",
        detectedRef: "REF20261010091",
        detectedAmountEgp: 150.00,
        confirmedAt: "2026-10-10T21:20:00.000Z",
        note: "Order #1042"
      }
    },
    underpaid: {
      event: "payment.underpaid",
      event_id: "evt_live_8f1a2b3c4d5f",
      timestamp: 1760119210,
      transaction: {
        sessionId: "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
        status: "UNDERPAID",
        amountEgp: 150.00,
        detectedAmountEgp: 100.00,
        differenceEgp: -50.00,
        senderHandle: "customer@instapay",
        note: "Partial payment received"
      }
    },
    overpaid: {
      event: "payment.overpaid",
      event_id: "evt_live_8f1a2b3c4d60",
      timestamp: 1760119220,
      transaction: {
        sessionId: "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
        status: "OVERPAID",
        amountEgp: 150.00,
        detectedAmountEgp: 200.00,
        differenceEgp: 50.00,
        senderHandle: "customer@instapay"
      }
    },
    expired: {
      event: "payment.expired",
      event_id: "evt_live_8f1a2b3c4d61",
      timestamp: 1760120100,
      transaction: {
        sessionId: "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
        status: "EXPIRED",
        amountEgp: 150.00,
        reason: "TTL expired before transfer detected"
      }
    }
  };

  /* ──────────────── Sidebar Nav Items ──────────────── */
  interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
  }

  interface NavGroup {
    group: string;
    items: NavItem[];
  }

  const navSections: NavGroup[] = [
    {
      group: isRtl ? 'البداية والأساسيات' : 'Getting Started',
      items: [
        { id: 'intro', label: isRtl ? 'نظرة عامة والتدفق' : 'Architecture & Flow', icon: Layers },
        { id: 'auth', label: isRtl ? 'المصادقة والبيئات' : 'Auth & Environments', icon: KeyIcon },
      ]
    },
    {
      group: isRtl ? 'واجهة برمجة التطبيقات' : 'REST API Reference',
      items: [
        { id: 'endpoint-create', label: 'POST /v1/checkout/create', icon: Terminal, badge: 'POST', badgeColor: '#38bdf8' },
        { id: 'endpoint-status', label: 'GET /v1/checkout/status', icon: Terminal, badge: 'GET', badgeColor: '#10b981' },
        { id: 'endpoint-public', label: 'GET /checkout/:id', icon: Terminal, badge: 'GET', badgeColor: '#10b981' },
      ]
    },
    {
      group: isRtl ? 'الويب هوك والأمان' : 'Webhooks & Security',
      items: [
        { id: 'webhooks', label: isRtl ? 'توقيع HMAC-SHA256' : 'HMAC-SHA256 Security', icon: ShieldCheck },
        { id: 'events', label: isRtl ? 'دليل أحداث الويب هوك' : 'Webhook Events Catalog', icon: Zap },
        { id: 'tester', label: isRtl ? 'أداة اختبار الويب هوك المباشرة' : 'Live HMAC Calculator', icon: Play, badge: 'Interactive', badgeColor: '#a855f7' },
      ]
    },
    {
      group: isRtl ? 'أكواد وحزم SDK كاملة' : 'Full Implementation SDKs',
      items: [
        { id: 'sdk', label: isRtl ? 'كود التكامل الجاهز' : 'Production SDK Examples', icon: Code2 },
      ]
    },
    {
      group: isRtl ? 'الجاهزية والأخطاء' : 'Errors & Launch',
      items: [
        { id: 'errors', label: isRtl ? 'رموز الأخطاء واستكشافها' : 'Error Handling Matrix', icon: AlertCircle },
        { id: 'checklist', label: isRtl ? 'قائمة التحقق للإنتاج' : 'Production Checklist', icon: CheckSquare },
      ]
    }
  ];

  function KeyIcon(props: any) {
    return <Lock {...props} />;
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        backgroundColor: bgMain,
        color: textPrimary,
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ──────────────── Top Navigation Bar ──────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: isDark ? 'rgba(11, 15, 25, 0.88)' : 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${borderCard}`,
          padding: '12px clamp(16px, 4vw, 32px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden"
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              border: `1px solid ${borderCard}`,
              color: textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Toggle navigation"
          >
            <Sliders size={18} />
          </button>

          {/* Logo & Brand */}
          <div
            onClick={() => scrollTo('intro')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.3px', color: textPrimary }}>
                  InstaPay<span style={{ color: accentSky }}>Gateway</span>
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                    color: accentSky,
                    border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
                  }}
                >
                  API v2.0
                </span>
              </div>
              <div style={{ fontSize: '11px', color: textSecondary, fontWeight: 500 }}>
                {isRtl ? 'دليل التكامل البرمجي الشامل' : 'Developer Integration Documentation'}
              </div>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div
          className="hidden sm:flex"
          style={{
            position: 'relative',
            flex: '1',
            maxWidth: '380px',
            margin: '0 12px',
          }}
        >
          <Search
            size={15}
            style={{
              position: 'absolute',
              [isRtl ? 'right' : 'left']: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: textMuted,
            }}
          />
          <input
            type="text"
            placeholder={isRtl ? 'بحث في نقاط النهاية، المعاملات، والأكواد...' : 'Search endpoints, params, codes...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: isRtl ? '8px 36px 8px 12px' : '8px 12px 8px 36px',
              borderRadius: '10px',
              fontSize: '13px',
              backgroundColor: isDark ? '#111827' : '#ffffff',
              border: `1px solid ${borderCard}`,
              color: textPrimary,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status Badge */}
          <div
            className="hidden lg:flex"
            style={{
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '20px',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
              border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
              fontSize: '11px',
              fontWeight: 600,
              color: accentEmerald,
            }}
            title="IPN Switch Operational"
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: accentEmerald,
                boxShadow: '0 0 6px #10b981',
                animation: 'pulse 2s infinite',
              }}
            />
            <span>{isRtl ? 'الخدمة تعمل بنسبة 100%' : 'All Systems Live'}</span>
          </div>

          {/* Download Raw Guide (.md) */}
          <a
            href="/api/docs/integration-guide"
            download="InstaPay_Gateway_API_Integration_Guide.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: textPrimary,
              border: `1px solid ${borderCard}`,
              transition: 'all 0.2s',
            }}
            title={isRtl ? 'تحميل الدليل بصيغة Markdown' : 'Download Markdown (.md)'}
          >
            <Download size={14} style={{ color: accentSky }} />
            <span className="hidden sm:inline">{isRtl ? 'تحميل (.md)' : 'Download .md'}</span>
          </a>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            style={{
              padding: '7px 11px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: textPrimary,
              border: `1px solid ${borderCard}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Switch Language"
          >
            <Globe size={13} style={{ color: accentSky }} />
            <span>{lang === 'en' ? 'عربي' : 'EN'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: textPrimary,
              border: `1px solid ${borderCard}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title={isDark ? 'Switch to Light' : 'Switch to Dark'}
          >
            {isDark ? <Sun size={15} style={{ color: '#fbbf24' }} /> : <Moon size={15} style={{ color: '#6366f1' }} />}
          </button>

          {/* Return to Dashboard / Portal Link */}
          <button
            onClick={() => navigate('/#developers/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: accentSky,
              color: '#041724',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>{isRtl ? 'لوحة التحكم' : 'Merchant Portal'}</span>
            <ArrowRight size={13} className={isRtl ? 'rotate-180' : ''} />
          </button>
        </div>
      </header>

      {/* ──────────────── Main Documentation Container ──────────────── */}
      <div
        style={{
          display: 'flex',
          maxWidth: '1440px',
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* ──────────────── Left Navigation Sidebar ──────────────── */}
        <aside
          className={`fixed inset-y-0 z-30 w-72 md:w-64 lg:w-72 md:sticky md:top-[61px] md:h-[calc(100vh-61px)] overflow-y-auto transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')
          }`}
          style={{
            backgroundColor: isDark ? '#0e1422' : '#ffffff',
            borderRight: isRtl ? 'none' : `1px solid ${borderCard}`,
            borderLeft: isRtl ? `1px solid ${borderCard}` : 'none',
            padding: '20px 14px 40px',
            flexShrink: 0,
            [isRtl ? 'right' : 'left']: 0,
          }}
        >
          {/* Mobile close button */}
          <div className="flex md:hidden justify-between items-center mb-4 pb-2 border-b border-gray-700">
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{isRtl ? 'فهرس الدليل' : 'Documentation Index'}</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'transparent',
                color: textSecondary,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {navSections.map((group, gIdx) => (
              <div key={gIdx}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: textMuted,
                    marginBottom: '8px',
                    padding: '0 8px',
                  }}
                >
                  {group.group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => scrollTo(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: isActive ? 600 : 500,
                          textAlign: isRtl ? 'right' : 'left',
                          backgroundColor: isActive
                            ? (isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe')
                            : 'transparent',
                          color: isActive
                            ? accentSky
                            : textSecondary,
                          border: isActive
                            ? `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd'}`
                            : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <Icon size={15} style={{ flexShrink: 0, color: isActive ? accentSky : textMuted }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        </div>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isDark ? `${item.badgeColor}22` : `${item.badgeColor}18`,
                              color: item.badgeColor,
                              border: `1px solid ${item.badgeColor}40`,
                              flexShrink: 0,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Fast Environment Badge at sidebar bottom */}
          <div
            style={{
              marginTop: '30px',
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: isDark ? '#111827' : '#f1f5f9',
              border: `1px solid ${borderCard}`,
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: accentSky, marginBottom: '4px' }}>
              <ShieldCheck size={14} />
              <span>TLS 1.3 & HMAC Protected</span>
            </div>
            <div style={{ color: textMuted }}>
              {isRtl ? 'جميع الطلبات مشفرة وموقعة برمجياً عبر مفتاحك السري.' : 'Strict HMAC-SHA256 signatures with 300s replay rejection.'}
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-20 bg-black/60 md:hidden"
          />
        )}

        {/* ──────────────── Main Document Content ──────────────── */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: 'clamp(20px, 4vw, 48px) clamp(16px, 4vw, 48px) 80px',
          }}
        >
          {/* Header Hero Banner */}
          <div
            style={{
              padding: 'clamp(24px, 5vw, 40px)',
              borderRadius: '20px',
              background: isDark
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)'
                : 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
              border: `1px solid ${borderCard}`,
              boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.04)',
              marginBottom: '40px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle background glow */}
            <div
              style={{
                position: 'absolute',
                top: '-50px',
                right: isRtl ? 'auto' : '-50px',
                left: isRtl ? '-50px' : 'auto',
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <Sparkles size={12} />
                {isRtl ? 'شبكة المدفوعات اللحظية IPN' : 'Egypt National IPN Switch'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  color: accentEmerald,
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <CheckCircle2 size={12} />
                {isRtl ? 'جاهز للإنتاج التجاري' : 'Production-Ready v2.0'}
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(24px, 4vw, 36px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
                color: textPrimary,
                marginBottom: '14px',
              }}
            >
              {isRtl
                ? 'دليل التكامل البرمجي لبوابة دفع إنستاباي'
                : 'InstaPay Gateway API Integration Guide'}
            </h1>

            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: textSecondary,
                maxWidth: '780px',
                marginBottom: '24px',
              }}
            >
              {isRtl
                ? 'دليل تقني متكامل وشامل لربط متاجرك وتطبيقاتك عبر واجهات REST API المشفرة، استقبال إشعارات الدفع اللحظية (Webhooks) الموقعة بواسطة HMAC-SHA256، ومعالجة التحويلات بالجنيه المصري تلقائياً دون أي تدخل بشري.'
                : 'Complete engineering documentation to integrate instant Egyptian Pound (EGP) transfers into your e-commerce platform, SaaS, or mobile app using REST endpoints, signed HMAC-SHA256 webhooks, and atomic bank push confirmation.'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button
                onClick={() => scrollTo('endpoint-create')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: accentSky,
                  color: '#041724',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.35)',
                }}
              >
                <Play size={14} />
                <span>{isRtl ? 'إنشاء جلسة دفع سريعة' : 'Create First Checkout'}</span>
              </button>

              <button
                onClick={() => scrollTo('tester')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  color: textPrimary,
                  border: `1px solid ${borderCard}`,
                  cursor: 'pointer',
                }}
              >
                <ShieldCheck size={15} style={{ color: '#a855f7' }} />
                <span>{isRtl ? 'حاسبة وفاحص الويب هوك المباشر' : 'Live HMAC Calculator'}</span>
              </button>

              <button
                onClick={() => scrollTo('sdk')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  color: textPrimary,
                  border: `1px solid ${borderCard}`,
                  cursor: 'pointer',
                }}
              >
                <Code2 size={15} style={{ color: accentSky }} />
                <span>{isRtl ? 'أكواد 5 لغات برمجية' : '5 Language SDKs'}</span>
              </button>
            </div>
          </div>

          {/* ──────────────── SECTION 1: ARCHITECTURE & PAYMENT FLOW ──────────────── */}
          <section id="intro" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentSky, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '1. البنية التحتية وتدفق عملية الدفع' : '1. Architecture & Payment Flow'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'تتيح بوابة إنستاباي لعملائك الدفع مباشرة بالجنيه المصري عبر تطبيق إنستاباي الرسمي دون الحاجة لكتابة أرقام بطاقات بنكية، مع التحقق الفوري من استلام المبلغ في حسابك البنكي خلال ثوانٍ معدودة.'
                : 'The InstaPay Gateway allows customers to pay directly via Egypt’s national Instant Payment Network (IPN). Payment receipts are matched atomically and dispatches signed webhooks directly to your servers.'}
            </p>

            {/* Visual Interactive Sequence Flow */}
            <div
              style={{
                backgroundColor: isDark ? '#0d1322' : '#f8fafc',
                borderRadius: '14px',
                border: `1px solid ${borderCard}`,
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', color: textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} style={{ color: accentSky }} />
                <span>{isRtl ? 'مخطط تدفق المعاملة من البداية للتأكيد' : 'End-to-End Payment Lifecycle Diagram'}</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                }}
              >
                {[
                  {
                    step: '01',
                    title: isRtl ? 'إنشاء الجلسة' : '1. Create Session',
                    desc: isRtl ? 'يرسل متجرك طلب POST /checkout/create بمبلغ الطلب، فيستلم رابط الجلسة ورابط Deep Link.' : 'Merchant backend dispatches POST /checkout/create and receives sessionId & deepLink.',
                    color: '#38bdf8',
                  },
                  {
                    step: '02',
                    title: isRtl ? 'تحويل العميل' : '2. Customer Pays',
                    desc: isRtl ? 'يفتح العميل رابط الدفع أو ينقر زر إنستاباي ليفتح التطبيق بمبلغ ومعرف التاجر معبأين.' : 'Customer opens checkout link on mobile or scans QR code on desktop to pay in InstaPay.',
                    color: '#818cf8',
                  },
                  {
                    step: '03',
                    title: isRtl ? 'التقاط الإشعار' : '3. Bank Receipt',
                    desc: isRtl ? 'يلتقط جهاز الكاشف المرافق إشعار البنك الرسمي من البنك المركزي ويطابق المبلغ والجلسة.' : 'Companion Android detector captures CBE switch push notification & matches session.',
                    color: '#f59e0b',
                  },
                  {
                    step: '04',
                    title: isRtl ? 'إرسال الويب هوك' : '4. Signed Webhook',
                    desc: isRtl ? 'ترسل البوابة إشعاراً موقعاً بـ HMAC-SHA256 لسيرفرك لتأكيد الطلب فوراً.' : 'Gateway delivers cryptographically signed HMAC-SHA256 webhook with payment.confirmed.',
                    color: '#10b981',
                  },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: isDark ? '#111827' : '#ffffff',
                      borderRadius: '12px',
                      padding: '16px',
                      border: `1px solid ${borderCard}`,
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: s.color, backgroundColor: `${s.color}18`, padding: '2px 8px', borderRadius: '6px' }}>
                        {s.step}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: textPrimary, marginBottom: '6px' }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: '12px', color: textSecondary, lineHeight: 1.5 }}>
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ──────────────── SECTION 2: AUTHENTICATION & ENVIRONMENTS ──────────────── */}
          <section id="auth" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentIndigo, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '2. المصادقة والبيئات' : '2. Authentication & Environments'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'تتم المصادقة على جميع طلبات الـ REST API عبر ترويسة Authorization بنمط Bearer Token باستخدام مفتاح الربط الخاص بك (egp_live_... أو egp_test_...).'
                : 'All API requests must include your integration key in the Authorization HTTP header using the Bearer scheme.'}
            </p>

            <div
              style={{
                backgroundColor: codeBg,
                borderRadius: '12px',
                padding: '16px 20px',
                border: `1px solid ${borderCard}`,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#38bdf8' }}>
                <span style={{ color: '#94a3b8' }}>Authorization:</span> Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f<br />
                <span style={{ color: '#94a3b8' }}>Content-Type:</span> application/json<br />
                <span style={{ color: '#94a3b8' }}>Idempotency-Key:</span> order_1042_a9b8c7
              </div>
              <button
                onClick={() => copyToClipboard('Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f\nContent-Type: application/json', 'auth_header')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                }}
              >
                {copiedId === 'auth_header' ? <Check size={13} style={{ color: accentEmerald }} /> : <Copy size={13} />}
                <span>{copiedId === 'auth_header' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Environments Table */}
            <div
              style={{
                borderRadius: '12px',
                border: `1px solid ${borderCard}`,
                overflow: 'hidden',
                marginBottom: '24px',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: isRtl ? 'right' : 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: isDark ? '#111827' : '#f1f5f9', borderBottom: `1px solid ${borderCard}` }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: textPrimary }}>{isRtl ? 'البيئة' : 'Environment'}</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: textPrimary }}>{isRtl ? 'عنوان الخدمة الأساسي (Base URL)' : 'Base URL'}</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: textPrimary }}>{isRtl ? 'ملاحظات الأمان' : 'Security Policy'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: accentEmerald }}>
                      Production (Live)
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: accentSky }}>
                      https://api.yourdomain.com
                    </td>
                    <td style={{ padding: '12px 16px', color: textSecondary }}>
                      {isRtl ? 'يتطلب TLS 1.3 / HTTPS. المفاتيح تبدأ بـ egp_live_.' : 'Strict TLS 1.3/HTTPS required. Keys prefix egp_live_.'}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: bgCard }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: accentAmber }}>
                      Local / Sandbox
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: accentSky }}>
                      http://localhost:3001
                    </td>
                    <td style={{ padding: '12px 16px', color: textSecondary }}>
                      {isRtl ? 'للتطوير المحلي واختبارات الـ Simulator.' : 'Local test deployment for pre-flight testing.'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ──────────────── SECTION 3: REST API REFERENCE ──────────────── */}
          <section id="endpoint-create" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentSky, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '3. مرجع الـ REST API' : '3. REST API Reference'}
              </h2>
            </div>

            {/* Endpoint 1: POST /api/v1/checkout/create */}
            <div
              style={{
                backgroundColor: bgCard,
                borderRadius: '14px',
                border: `1px solid ${borderCard}`,
                padding: '24px',
                marginBottom: '28px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  POST
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, color: textPrimary }}>
                  /api/v1/checkout/create
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                    color: accentSky,
                  }}
                >
                  {isRtl ? 'إنشاء جلسة دفع فورية' : 'Create Payment Invoice'}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '18px' }}>
                {isRtl
                  ? 'يقوم هذا الطلب بإنشاء جلسة دفع جديدة وإصدار رابط الدفع checkoutUrl ورابط التطبيق العميق deepLinkUrl للعميل.'
                  : 'Initializes a new checkout session. Generates an instant payment URL and direct mobile deep link for the InstaPay app.'}
              </p>

              {/* Request Parameters Table */}
              <div style={{ fontWeight: 700, fontSize: '13px', color: textPrimary, marginBottom: '8px' }}>
                {isRtl ? 'معاملات الطلب (Body Parameters):' : 'Request Body Parameters:'}
              </div>
              <div style={{ borderRadius: '10px', border: `1px solid ${borderCard}`, overflow: 'hidden', marginBottom: '18px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: isRtl ? 'right' : 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: isDark ? '#111827' : '#f1f5f9', borderBottom: `1px solid ${borderCard}` }}>
                      <th style={{ padding: '8px 12px', color: textPrimary }}>{isRtl ? 'المعامل' : 'Field'}</th>
                      <th style={{ padding: '8px 12px', color: textPrimary }}>{isRtl ? 'النوع' : 'Type'}</th>
                      <th style={{ padding: '8px 12px', color: textPrimary }}>{isRtl ? 'مطلوب؟' : 'Required'}</th>
                      <th style={{ padding: '8px 12px', color: textPrimary }}>{isRtl ? 'الوصف' : 'Description'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: accentSky }}>amountEgp</td>
                      <td style={{ padding: '8px 12px', color: textMuted }}>Float / Number</td>
                      <td style={{ padding: '8px 12px', color: accentRose, fontWeight: 700 }}>{isRtl ? 'نعم' : 'Required'}</td>
                      <td style={{ padding: '8px 12px', color: textSecondary }}>{isRtl ? 'المبلغ المطلوب بالجنيه المصري (مثال: 150.00)' : 'Amount in EGP (must be > 0)'}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: accentSky }}>senderHandle</td>
                      <td style={{ padding: '8px 12px', color: textMuted }}>String</td>
                      <td style={{ padding: '8px 12px', color: textMuted }}>Optional</td>
                      <td style={{ padding: '8px 12px', color: textSecondary }}>{isRtl ? 'عنوان إنستاباي للعميل (مثال: username@instapay)' : 'Customer InstaPay payment address handle'}</td>
                    </tr>
                    <tr style={{ backgroundColor: bgCard }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: accentSky }}>note</td>
                      <td style={{ padding: '8px 12px', color: textMuted }}>String</td>
                      <td style={{ padding: '8px 12px', color: textMuted }}>Optional</td>
                      <td style={{ padding: '8px 12px', color: textSecondary }}>{isRtl ? 'وصف أو رقم الفاتورة للطلب (مثال: Order #1042)' : 'Optional memo or order reference'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sample Response */}
              <div style={{ fontWeight: 700, fontSize: '13px', color: textPrimary, marginBottom: '8px' }}>
                {isRtl ? 'نموذج الاستجابة (HTTP 201 Created):' : 'Sample JSON Response (HTTP 201 Created):'}
              </div>
              <div
                style={{
                  backgroundColor: codeBg,
                  borderRadius: '10px',
                  padding: '14px 18px',
                  border: `1px solid ${borderCard}`,
                  position: 'relative',
                }}
              >
                <button
                  onClick={() => copyToClipboard(JSON.stringify({
                    ok: true,
                    checkout: {
                      sessionId: "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
                      checkoutUrl: `${baseUrl}/pay/cmt_9e8a7b6c5d4e3f2a1b0c9d8e`,
                      deepLinkUrl: "https://ipn.eg/S/merchant/instapay/9e8a",
                      amountEgp: 150.00,
                      status: "PENDING",
                      expiresAt: "2026-10-10T21:35:00.000Z",
                      secondsRemaining: 900
                    }
                  }, null, 2), 'resp_create')}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    [isRtl ? 'left' : 'right']: '10px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {copiedId === 'resp_create' ? <Check size={12} style={{ color: accentEmerald }} /> : <Copy size={12} />}
                  <span>{copiedId === 'resp_create' ? 'Copied' : 'Copy'}</span>
                </button>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: codeText, overflowX: 'auto' }}>
{`{
  "ok": true,
  "checkout": {
    "sessionId": "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
    "checkoutUrl": "${baseUrl}/pay/cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
    "deepLinkUrl": "https://ipn.eg/S/merchant/instapay/9e8a",
    "amountEgp": 150.00,
    "status": "PENDING",
    "expiresAt": "2026-10-10T21:35:00.000Z",
    "secondsRemaining": 900
  }
}`}
                </pre>
              </div>
            </div>

            {/* Endpoint 2: GET /api/v1/checkout/status */}
            <div
              id="endpoint-status"
              style={{
                backgroundColor: bgCard,
                borderRadius: '14px',
                border: `1px solid ${borderCard}`,
                padding: '24px',
                marginBottom: '28px',
                scrollMarginTop: '90px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  GET
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, color: textPrimary }}>
                  /api/v1/checkout/status?sessionId=cmt_...
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    color: accentEmerald,
                  }}
                >
                  {isRtl ? 'الاستعلام عن حالة الجلسة' : 'Poll Payment Status'}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '16px' }}>
                {isRtl
                  ? 'يستخدم للتحقق يدوياً أو الاستعلام الدوري عن حالة الجلسة (PENDING أو CONFIRMED أو UNDERPAID أو EXPIRED).'
                  : 'Polls payment status as an additional reliability layer alongside automated Webhook dispatches.'}
              </p>

              <div
                style={{
                  backgroundColor: codeBg,
                  borderRadius: '10px',
                  padding: '14px 18px',
                  border: `1px solid ${borderCard}`,
                }}
              >
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: codeText, overflowX: 'auto' }}>
{`{
  "ok": true,
  "checkout": {
    "sessionId": "cmt_9e8a7b6c5d4e3f2a1b0c9d8e",
    "status": "CONFIRMED",
    "amountEgp": 150.00,
    "detectedRef": "REF20261010091",
    "detectedAmountEgp": 150.00,
    "confirmedAt": "2026-10-10T21:20:00.000Z"
  }
}`}
                </pre>
              </div>
            </div>

            {/* Endpoint 3: GET /api/checkout/:sessionId */}
            <div
              id="endpoint-public"
              style={{
                backgroundColor: bgCard,
                borderRadius: '14px',
                border: `1px solid ${borderCard}`,
                padding: '24px',
                scrollMarginTop: '90px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  GET
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, color: textPrimary }}>
                  /api/checkout/:sessionId
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                    color: '#818cf8',
                  }}
                >
                  {isRtl ? 'نقطة نهاية عامة لصفحة الدفع' : 'Public Customer Checkout Endpoint'}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: textSecondary, marginBottom: '8px' }}>
                {isRtl
                  ? 'نقطة نهاية عامة (لا تتطلب مفتاح API) تستخدمها واجهة المستخدم لصفحة الدفع /pay/:sessionId لجلب بيانات الجلسة وعرض QR Code.'
                  : 'Public endpoint without Authorization header. Used by the customer payment page UI to display live transfer instructions and expiry counter.'}
              </p>
            </div>
          </section>

          {/* ──────────────── SECTION 4: WEBHOOKS & HMAC-SHA256 ──────────────── */}
          <section id="webhooks" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentEmerald, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '4. ترويسات وأمان الويب هوك (HMAC-SHA256)' : '4. Webhook Architecture & Signature Verification'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'لحماية خوادمك من التزييف وهجمات الإعادة (Replay Attacks)، يتم توقيع كل إشعار دفع يرسل لمتجرك عبر خوارزمية HMAC-SHA256 بواسطة المفتاح السري الخاص بك (whsec_...).'
                : 'All webhooks sent to your endpoint are signed using HMAC-SHA256. You must verify the signature and timestamp to guarantee request authenticity and prevent replay attacks.'}
            </p>

            {/* Inbound Headers Table */}
            <div style={{ borderRadius: '12px', border: `1px solid ${borderCard}`, overflow: 'hidden', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: isRtl ? 'right' : 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: isDark ? '#111827' : '#f1f5f9', borderBottom: `1px solid ${borderCard}` }}>
                    <th style={{ padding: '10px 14px', color: textPrimary }}>{isRtl ? 'الترويسة (HTTP Header)' : 'Header'}</th>
                    <th style={{ padding: '10px 14px', color: textPrimary }}>{isRtl ? 'القيمة والمثال' : 'Example Value'}</th>
                    <th style={{ padding: '10px 14px', color: textPrimary }}>{isRtl ? 'الغرض' : 'Purpose'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: accentSky }}>X-Instapay-Signature</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: textMuted }}>v1=3a7b9c1d... (hex)</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'توقيع HMAC-SHA256 الرقمي' : 'HMAC-SHA256 digest over timestamp and raw body'}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: accentSky }}>X-Instapay-Timestamp</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: textMuted }}>1760119200 (Unix Sec)</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'وقت الإرسال لمنع هجمات إعادة الطلب' : 'Dispatch timestamp. Reject if drift > 300s'}</td>
                  </tr>
                  <tr style={{ backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: accentSky }}>X-Instapay-Event-Id</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: textMuted }}>evt_live_8f1a2b...</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'معرف فريد للحدث لضمان عدم التكرار' : 'Unique event ID for database idempotency'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cryptographic Steps Callout */}
            <div
              style={{
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#f0f9ff',
                borderRadius: '12px',
                border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd'}`,
                padding: '20px',
                marginBottom: '32px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14px', color: accentSky, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} />
                <span>{isRtl ? 'خطوات التحقق الرياضي الإلزامية:' : 'Mandatory Cryptographic Verification Rules:'}</span>
              </div>
              <ol style={{ margin: 0, padding: isRtl ? '0 20px 0 0' : '0 0 0 20px', fontSize: '13px', lineHeight: 1.7, color: textPrimary }}>
                <li>
                  <strong>{isRtl ? 'فحص وقت الإرسال:' : 'Anti-Replay Window:'}</strong>{' '}
                  {isRtl
                    ? 'تأكد أن فارق الوقت بين X-Instapay-Timestamp ووقت سيرفرك الحالي لا يتجاوز 300 ثانية (5 دقائق).'
                    : 'Verify Math.abs(currentTime - timestamp) <= 300 seconds to prevent replay attacks.'}
                </li>
                <li>
                  <strong>{isRtl ? 'الاحتفاظ بالنص الخام (Raw Body):' : 'Preserve Raw JSON Body:'}</strong>{' '}
                  {isRtl
                    ? 'يجب حساب التوقيع على النص الخام الأصلي تماماً Buffer/String قبل عمل json_decode أو JSON.parse.'
                    : 'Compute HMAC on raw unparsed request payload. Any whitespace alterations invalidate the signature.'}
                </li>
                <li>
                  <strong>{isRtl ? 'تكوين النص الأساسي:' : 'Base String Format:'}</strong>{' '}
                  <code style={{ fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                    {"<timestamp>.<rawJsonBody>"}
                  </code>
                </li>
                <li>
                  <strong>{isRtl ? 'مقارنة مقاومة لهجمات التوقيت (Timing-Safe):' : 'Timing-Safe Comparison:'}</strong>{' '}
                  {isRtl
                    ? 'استخدم دائماً دوال timingSafeEqual أو hash_equals أو hmac.compare_digest لمنع تسريب التوقيت.'
                    : 'Never use == or ===. Use constant-time comparison to prevent timing leak vulnerabilities.'}
                </li>
              </ol>
            </div>
          </section>

          {/* ──────────────── SECTION 5: EVENT CATALOG ──────────────── */}
          <section id="events" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentRose, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '5. دليل أحداث الويب هوك (Event Catalog)' : '5. Webhook Events Catalog'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'اختر نوع الحدث لمعاينة نموذج الاستجابة الدقيق الذي سيصل لخادمك فور اكتمال الدفع أو انتهاء الجلسة:'
                : 'Select an event type below to inspect the verified JSON payload dispatched by the gateway:'}
            </p>

            {/* Event Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'confirmed', label: 'payment.confirmed', color: '#10b981' },
                { id: 'underpaid', label: 'payment.underpaid', color: '#f59e0b' },
                { id: 'overpaid', label: 'payment.overpaid', color: '#38bdf8' },
                { id: 'expired', label: 'payment.expired', color: '#f43f5e' },
              ].map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventTab(ev.id as any)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    backgroundColor: selectedEventTab === ev.id
                      ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe')
                      : (isDark ? '#111827' : '#f1f5f9'),
                    color: selectedEventTab === ev.id ? accentSky : textSecondary,
                    border: selectedEventTab === ev.id
                      ? `1px solid ${accentSky}`
                      : `1px solid ${borderCard}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {ev.label}
                </button>
              ))}
            </div>

            {/* Event Preview Block */}
            <div
              style={{
                backgroundColor: codeBg,
                borderRadius: '12px',
                padding: '16px 20px',
                border: `1px solid ${borderCard}`,
                position: 'relative',
              }}
            >
              <button
                onClick={() => copyToClipboard(JSON.stringify(eventPayloads[selectedEventTab], null, 2), 'event_payload')}
                style={{
                  position: 'absolute',
                  top: '12px',
                  [isRtl ? 'left' : 'right']: '12px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copiedId === 'event_payload' ? <Check size={12} style={{ color: accentEmerald }} /> : <Copy size={12} />}
                <span>{copiedId === 'event_payload' ? 'Copied' : 'Copy Payload'}</span>
              </button>
              <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: codeText, overflowX: 'auto' }}>
                {JSON.stringify(eventPayloads[selectedEventTab], null, 2)}
              </pre>
            </div>
          </section>

          {/* ──────────────── SECTION 6: INTERACTIVE LIVE HMAC CALCULATOR ──────────────── */}
          <section id="tester" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: '#a855f7', borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '6. حاسبة وفاحص الويب هوك المباشر (Interactive HMAC Tester)' : '6. Live Webhook Signature Calculator & Tester'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'استخدم هذه الأداة التفاعلية لاختبار وحساب توقيع HMAC-SHA256 مباشرة في المتصفح والتحقق من صحة كود سيرفرك قبل إطلاقه في الإنتاج:'
                : 'Test and debug your signature verification implementation live. Enter your parameters to see the exact base string and computed HMAC-SHA256 signature:'}
            </p>

            <div
              style={{
                backgroundColor: bgCard,
                borderRadius: '16px',
                border: `1px solid ${borderCard}`,
                padding: 'clamp(16px, 4vw, 24px)',
                boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                {/* Secret Key Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textPrimary, marginBottom: '6px' }}>
                    {isRtl ? 'المفتاح السري للويب هوك (Webhook Secret):' : 'Webhook Secret (whsec_...):'}
                  </label>
                  <input
                    type="text"
                    value={testerSecret}
                    onChange={(e) => setTesterSecret(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
                      border: `1px solid ${borderCard}`,
                      color: textPrimary,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Timestamp Input */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: textPrimary }}>
                      {isRtl ? 'وقت الإرسال (Timestamp Unix):' : 'X-Instapay-Timestamp:'}
                    </label>
                    <button
                      onClick={() => setTesterTimestamp(Math.floor(Date.now() / 1000).toString())}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: accentSky,
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {isRtl ? 'تحديث للوقت الحالي' : 'Set to Now'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={testerTimestamp}
                    onChange={(e) => setTesterTimestamp(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
                      border: `1px solid ${borderCard}`,
                      color: textPrimary,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* JSON Payload Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textPrimary, marginBottom: '6px' }}>
                  {isRtl ? 'حمولة الـ JSON الخام (Raw JSON Payload):' : 'Raw JSON Body Payload:'}
                </label>
                <textarea
                  rows={6}
                  value={testerPayload}
                  onChange={(e) => setTesterPayload(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
                    border: `1px solid ${borderCard}`,
                    color: textPrimary,
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Calculated Results */}
              <div
                style={{
                  backgroundColor: codeBg,
                  borderRadius: '12px',
                  padding: '16px',
                  border: `1px solid ${borderCard}`,
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Step 1: Computed Base String {"<timestamp>.<payload>"}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all', marginBottom: '12px' }}>
                  {calculatedBaseString.slice(0, 120)}...
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Step 2: Expected X-Instapay-Signature Header
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#38bdf8', wordBreak: 'break-all' }}>
                    v1={calculatedSignature || 'computing...'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(`v1=${calculatedSignature}`, 'tester_sig')}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '11px',
                      flexShrink: 0,
                    }}
                  >
                    {copiedId === 'tester_sig' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Signature Verifier Input */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textPrimary, marginBottom: '6px' }}>
                  {isRtl ? 'فحص توقيع سيرفرك مقابل التوقيع الصحيح:' : 'Verify Your Server Output Against Expected Signature:'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="v1=3a7b9c1d..."
                    value={verifyInputSig}
                    onChange={(e) => setVerifyInputSig(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
                      border: `1px solid ${borderCard}`,
                      color: textPrimary,
                      outline: 'none',
                    }}
                  />
                  {verifyResult !== null && (
                    <div
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: verifyResult ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: verifyResult ? accentEmerald : accentRose,
                        border: `1px solid ${verifyResult ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                      }}
                    >
                      {verifyResult ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      <span>{verifyResult ? (isRtl ? 'تطابق سليم 100%' : 'Signatures Match!') : (isRtl ? 'التوقيع غير متطابق' : 'Mismatch')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ──────────────── SECTION 7: FULL SDK IMPLEMENTATIONS (5 LANGUAGES) ──────────────── */}
          <section id="sdk" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentSky, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '7. أكواد وحزم التكامل الجاهزة (5 لغات برمجية)' : '7. Production-Ready SDK Implementations'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'أكواد برمجية كاملة، قابلة للتشغيل المباشر والنسخ في مشروعك، تشمل إنشاء الجلسات والتحقق الرياضي من الويب هوك:'
                : 'Drop-in, battle-tested code snippets for session creation and timing-safe webhook verification:'}
            </p>

            {/* Language and Snippet Switcher Controls */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              {/* Type Switcher */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: isDark ? '#111827' : '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                <button
                  onClick={() => setSelectedCodeType('create')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: selectedCodeType === 'create' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                    color: selectedCodeType === 'create' ? textPrimary : textSecondary,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isRtl ? 'إنشاء جلسة الدفع (Checkout)' : '1. Create Checkout Session'}
                </button>
                <button
                  onClick={() => setSelectedCodeType('webhook')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: selectedCodeType === 'webhook' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                    color: selectedCodeType === 'webhook' ? textPrimary : textSecondary,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isRtl ? 'استقبال الويب هوك والتحقق (HMAC)' : '2. Webhook Receiver & HMAC Verification'}
                </button>
              </div>

              {/* Language Switcher Tabs */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: isDark ? '#111827' : '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                {[
                  { id: 'node', label: 'Node.js' },
                  { id: 'python', label: 'Python' },
                  { id: 'php', label: 'PHP' },
                  { id: 'go', label: 'Go' },
                  { id: 'curl', label: 'cURL (CLI)' },
                ].map((langTab) => (
                  <button
                    key={langTab.id}
                    onClick={() => setSelectedLang(langTab.id as LangOption)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: selectedLang === langTab.id ? 700 : 500,
                      backgroundColor: selectedLang === langTab.id ? accentSky : 'transparent',
                      color: selectedLang === langTab.id ? '#041724' : textSecondary,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {langTab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Display Block */}
            <div
              style={{
                backgroundColor: codeBg,
                borderRadius: '14px',
                border: `1px solid ${borderCard}`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  backgroundColor: isDark ? '#0e1422' : '#1e293b',
                  borderBottom: `1px solid ${borderCard}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px', fontFamily: 'monospace' }}>
                    {selectedCodeType === 'create' ? `checkout_client.${selectedLang}` : `webhook_receiver.${selectedLang}`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    let codeToCopy = '';
                    if (selectedCodeType === 'create') {
                      if (selectedLang === 'node') codeToCopy = nodeCreateSnippet;
                      else if (selectedLang === 'python') codeToCopy = pythonCreateSnippet;
                      else if (selectedLang === 'php') codeToCopy = phpCreateSnippet;
                      else if (selectedLang === 'go') codeToCopy = goCreateSnippet;
                      else codeToCopy = curlCreateSnippet;
                    } else {
                      if (selectedLang === 'node') codeToCopy = nodeWebhookSnippet;
                      else if (selectedLang === 'python') codeToCopy = pythonWebhookSnippet;
                      else if (selectedLang === 'php') codeToCopy = phpWebhookSnippet;
                      else if (selectedLang === 'go') codeToCopy = goWebhookSnippet;
                      else codeToCopy = curlWebhookSnippet;
                    }
                    copyToClipboard(codeToCopy, `full_code_${selectedCodeType}_${selectedLang}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  {copiedId === `full_code_${selectedCodeType}_${selectedLang}` ? <Check size={13} style={{ color: accentEmerald }} /> : <Copy size={13} />}
                  <span>{copiedId === `full_code_${selectedCodeType}_${selectedLang}` ? 'Copied to Clipboard' : 'Copy Code'}</span>
                </button>
              </div>

              <div style={{ padding: '18px 22px', maxHeight: '520px', overflowY: 'auto' }}>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6, color: codeText, overflowX: 'auto' }}>
                  {selectedCodeType === 'create' && selectedLang === 'node' && nodeCreateSnippet}
                  {selectedCodeType === 'create' && selectedLang === 'python' && pythonCreateSnippet}
                  {selectedCodeType === 'create' && selectedLang === 'php' && phpCreateSnippet}
                  {selectedCodeType === 'create' && selectedLang === 'go' && goCreateSnippet}
                  {selectedCodeType === 'create' && selectedLang === 'curl' && curlCreateSnippet}

                  {selectedCodeType === 'webhook' && selectedLang === 'node' && nodeWebhookSnippet}
                  {selectedCodeType === 'webhook' && selectedLang === 'python' && pythonWebhookSnippet}
                  {selectedCodeType === 'webhook' && selectedLang === 'php' && phpWebhookSnippet}
                  {selectedCodeType === 'webhook' && selectedLang === 'go' && goWebhookSnippet}
                  {selectedCodeType === 'webhook' && selectedLang === 'curl' && curlWebhookSnippet}
                </pre>
              </div>
            </div>
          </section>

          {/* ──────────────── SECTION 8: ERROR HANDLING & STATUS MATRIX ──────────────── */}
          <section id="errors" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentRose, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '8. مصفوفة الأخطاء ورموز الـ HTTP' : '8. Error Handling & HTTP Status Matrix'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'تعيد البوابة استجابات أخطاء قياسية بصيغة JSON تحتوي على كود الخطأ ورسالة توضيحية لسهولة المعالجة البرمجية:'
                : 'The API uses standard HTTP response codes and a consistent JSON error envelope:'}
            </p>

            <div style={{ borderRadius: '12px', border: `1px solid ${borderCard}`, overflow: 'hidden', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: isRtl ? 'right' : 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: isDark ? '#111827' : '#f1f5f9', borderBottom: `1px solid ${borderCard}` }}>
                    <th style={{ padding: '10px 14px', color: textPrimary }}>{isRtl ? 'رمز الحالة' : 'HTTP Code'}</th>
                    <th style={{ padding: '10px 14px', color: textPrimary }}>{isRtl ? 'كود الخطأ' : 'Error Code'}</th>
                    <th style={{ padding: '10px 14px', color: textPrimary }}>{isRtl ? 'السبب والمعالجة المقترحة' : 'Cause & Suggested Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b' }}>400 Bad Request</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: accentSky }}>INVALID_AMOUNT</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'المبلغ غير صالح أو أقل من 0.01 جنيه.' : 'Amount must be greater than zero.'}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: accentRose }}>401 Unauthorized</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: accentSky }}>AUTH_FAILED</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'مفتاح الـ API مفقود أو تم تدويره أو غير صالح.' : 'Missing or invalid Bearer API key.'}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: accentRose }}>403 Forbidden</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: accentSky }}>ACCOUNT_PENDING</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'حساب المتجر في انتظار مراجعة وتفعيل الإدارة.' : 'Merchant account pending admin KYC approval.'}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${borderCard}`, backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b' }}>404 Not Found</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: accentSky }}>SESSION_NOT_FOUND</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'معرف الجلسة cmt_ غير موجود في قاعدة البيانات.' : 'Requested checkout session does not exist.'}</td>
                  </tr>
                  <tr style={{ backgroundColor: bgCard }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#a855f7' }}>429 Too Many Req</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: accentSky }}>RATE_LIMITED</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{isRtl ? 'تجاوز حد الطلبات المسموح (Rate limit exceeded).' : 'Rate limit reached. Back off and retry.'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ──────────────── SECTION 9: PRODUCTION READINESS CHECKLIST ──────────────── */}
          <section id="checklist" style={{ marginBottom: '56px', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '22px', backgroundColor: accentEmerald, borderRadius: '2px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? '9. قائمة التحقق للجاهزية للإنتاج (Production Checklist)' : '9. Production Launch Checklist'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: textSecondary, marginBottom: '20px' }}>
              {isRtl
                ? 'تأكد من تطبيق جميع هذه المعايير الأمنية والهندسية قبل إطلاق بوابة الدفع لعملائك الفعليين:'
                : 'Interactive readiness tracker. Verify and check off each item before directing real transactions:'}
            </p>

            <div
              style={{
                backgroundColor: bgCard,
                borderRadius: '16px',
                border: `1px solid ${borderCard}`,
                padding: '24px',
              }}
            >
              {/* Progress Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                  {isRtl ? 'نسبة الجاهزية للإنتاج:' : 'Readiness Completion Score:'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: checklistProgress === 100 ? accentEmerald : accentSky }}>
                  {checklistProgress}%
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: isDark ? '#1e293b' : '#e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${checklistProgress}%`,
                    backgroundColor: checklistProgress === 100 ? accentEmerald : accentSky,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Checklist Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  {
                    key: 'tls',
                    title: isRtl ? 'تفعيل شهادة TLS 1.3 / HTTPS' : 'Enforce TLS 1.3 / HTTPS',
                    desc: isRtl ? 'جميع الاتصالات مشفرة بروتوكولياً برفض أي اتصال HTTP غير آمن.' : 'All inbound webhook URLs and API communications strictly encrypted with valid TLS certificates.',
                  },
                  {
                    key: 'secret_storage',
                    title: isRtl ? 'حفظ المفاتيح في متغيرات البيئة (Environment Variables)' : 'Secure Key Storage',
                    desc: isRtl ? 'تخزين egp_live_ وwhsec_ في .env وسيرفرات آمنة وعدم إدراجها أبداً في Git.' : 'API keys and webhook secrets stored in environment variables, never hardcoded in source control.',
                  },
                  {
                    key: 'timing_safe',
                    title: isRtl ? 'استخدام مقارنة التوقيت الآمنة (Timing-Safe Equality)' : 'Timing-Safe Signature Comparison',
                    desc: isRtl ? 'الاعتماد على crypto.timingSafeEqual أو hash_equals لمنع هجمات التوقيت.' : 'Cryptographic comparisons performed in constant time to prevent side-channel timing attacks.',
                  },
                  {
                    key: 'drift_tolerance',
                    title: isRtl ? 'التحقق من عدم تجاوز وقت الطلب 300 ثانية' : 'Anti-Replay Timestamp Tolerance (≤ 300s)',
                    desc: isRtl ? 'رفض أي إشعار ويب هوك إذا تجاوز فارق التوقيت 5 دقائق لحماية الخادم من التكرار.' : 'Reject any inbound webhook whose X-Instapay-Timestamp drifts > 5 minutes from current clock.',
                  },
                  {
                    key: 'raw_body',
                    title: isRtl ? 'استخدام الـ Raw Body الأصلي لحساب الـ HMAC' : 'Raw Request Body Preservation',
                    desc: isRtl ? 'عدم استخدام JSON.parse المسبق قبل حساب الـ HMAC لأن أي مسافات إضافية تفسد التوقيع.' : 'Compute HMAC-SHA256 directly on the unparsed raw request buffer without re-serialization.',
                  },
                  {
                    key: 'idempotency',
                    title: isRtl ? 'دعم مفاتيح عدم التكرار (Idempotency-Key)' : 'Database Idempotency Handling',
                    desc: isRtl ? 'تخزين X-Instapay-Event-Id وتحديث حالة الطلب ذرياً (Atomically) لمنع الازدواجية.' : 'Store event IDs to prevent duplicate fulfillment if exponential retry webhooks are received.',
                  },
                  {
                    key: 'retry_handling',
                    title: isRtl ? 'إرجاع HTTP 200 OK فور استلام الويب هوك' : 'Immediate HTTP 200 Acknowledgment',
                    desc: isRtl ? 'إعادة استجابة سريعة للويب هوك ومعالجة المهام الثقيلة في Background Queue.' : 'Return HTTP 200 swiftly to prevent retry storms; process long jobs asynchronously.',
                  },
                  {
                    key: 'status_polling_fallback',
                    title: isRtl ? 'آلية استعلام بديلة في حال تعطل شبكة الويب هوك' : 'Polling Status Fallback',
                    desc: isRtl ? 'تطبيق استعلام دوري عبر GET /api/v1/checkout/status كطبقة أمان احتياطية.' : 'Fallback worker periodically queries GET /checkout/status for pending transactions.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    onClick={() => toggleCheck(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: checkedList[item.key]
                        ? (isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4')
                        : (isDark ? '#111827' : '#f8fafc'),
                      border: `1px solid ${checkedList[item.key] ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#bbf7d0') : borderCard}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ marginTop: '2px', color: checkedList[item.key] ? accentEmerald : textMuted }}>
                      {checkedList[item.key] ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: checkedList[item.key] ? (isDark ? '#34d399' : '#15803d') : textPrimary,
                          marginBottom: '2px',
                          textDecoration: checkedList[item.key] ? 'none' : 'none',
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: '12px', color: textSecondary, lineHeight: 1.4 }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ──────────────── Footer ──────────────── */}
          <footer
            style={{
              paddingTop: '32px',
              borderTop: `1px solid ${borderCard}`,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
              color: textMuted,
            }}
          >
            <div>
              © {new Date().getFullYear()} InstaPay Payment Gateway. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: accentSky,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {isRtl ? 'العودة للأعلى ↑' : 'Back to Top ↑'}
              </button>
              <a
                href="/api/docs/integration-guide"
                target="_blank"
                rel="noreferrer"
                style={{ color: textSecondary, textDecoration: 'none' }}
              >
                {isRtl ? 'تحميل كملف Markdown' : 'Raw Markdown Guide'}
              </a>
              <button
                onClick={() => navigate('/#developers/')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                }}
              >
                {isRtl ? 'بوابة المطورين' : 'Developer Portal'}
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
