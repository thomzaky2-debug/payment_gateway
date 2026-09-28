import { useState } from 'react';
import {
  Code2,
  Key,
  Webhook,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  Send,
  FileCode,
  Terminal,
} from 'lucide-react';

export function DevelopersPage() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');

  const apiKey = 'ipg_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
  const webhookSecret = 'whsec_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestWebhook = () => {
    setTestResult('sending');
    setTimeout(() => {
      setTestResult('success');
      setTimeout(() => setTestResult(null), 3000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Developer Portal</h2>
        <p className="text-sm text-slate-500">API keys, webhooks, and integration documentation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'keys' as const, label: 'API Keys', icon: Key },
          { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
          { id: 'docs' as const, label: 'Documentation', icon: FileCode },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-6 animate-fade-in">
          {/* API Key */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Live API Key</h3>
                  <p className="text-xs text-slate-500">Used for creating checkouts via API</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-900 rounded-xl px-4 py-3 font-mono text-sm text-green-400 overflow-x-auto">
                {showApiKey ? apiKey : '•'.repeat(40)}
              </div>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                {showApiKey ? <EyeOff className="w-4 h-4 text-slate-600" /> : <Eye className="w-4 h-4 text-slate-600" />}
              </button>
              <button
                onClick={() => handleCopy(apiKey, 'apikey')}
                className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                {copied === 'apikey' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Quick Start */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              Quick Start - Create a Checkout
            </h3>
            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono">
{`curl -X POST https://api.instapay-gateway.com/v1/checkouts \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'ipg_live_sk_***'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountPiastres": 15000,
    "currency": "EGP",
    "merchantOrderId": "INV-2024-001",
    "expectedSenderHandle": "customer@instapay",
    "expiresIn": 3600
  }'`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6 animate-fade-in">
          {/* Webhook URL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Webhook Endpoint</h3>
                  <p className="text-xs text-slate-500">Where we send payment notifications</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                Active
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 font-mono text-sm text-slate-700 mb-4">
              https://your-store.com/api/webhooks/instapay
            </div>

            {/* Webhook Secret */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Webhook Signing Secret</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 rounded-xl px-4 py-3 font-mono text-sm text-green-400 overflow-x-auto">
                  {showWebhookSecret ? webhookSecret : '•'.repeat(36)}
                </div>
                <button
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4 text-slate-600" /> : <Eye className="w-4 h-4 text-slate-600" />}
                </button>
                <button
                  onClick={() => handleCopy(webhookSecret, 'webhook')}
                  className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {copied === 'webhook' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Tester */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-600" />
              Webhook Simulator
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Send a test webhook to verify your endpoint is configured correctly.
            </p>

            <div className="bg-slate-900 rounded-xl p-4 mb-4 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono">
{`{
  "event": "checkout.paid",
  "checkoutId": "chk_test_123",
  "merchantOrderId": "INV-2024-001",
  "status": "PAID",
  "amountPiastres": "15000",
  "currency": "EGP",
  "matchedBy": "exact_sender_handle",
  "matchScore": 95,
  "paymentDetectedAt": "2026-09-28T14:32:00.000Z",
  "confirmedAt": "2026-09-28T14:32:05.000Z"
}`}
              </pre>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={testResult === 'sending'}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {testResult === 'sending' ? 'Sending...' : 'Send Test Webhook'}
            </button>

            {testResult === 'success' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Webhook delivered successfully! (HTTP 200)</span>
              </div>
            )}
          </div>

          {/* Recent Webhook Deliveries */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Recent Deliveries</h3>
            <div className="space-y-3">
              {[
                { event: 'checkout.paid', status: 200, time: '2 min ago', orderId: 'ORD-7842' },
                { event: 'checkout.paid', status: 200, time: '15 min ago', orderId: 'ORD-7841' },
                { event: 'checkout.paid', status: 200, time: '1 hr ago', orderId: 'ORD-7838' },
                { event: 'checkout.paid', status: 500, time: '2 hrs ago', orderId: 'ORD-7835' },
              ].map((delivery, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${delivery.status === 200 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{delivery.event}</p>
                      <p className="text-xs text-slate-500">{delivery.orderId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-medium ${delivery.status === 200 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {delivery.status}
                    </span>
                    <p className="text-xs text-slate-400">{delivery.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documentation Tab */}
      {activeTab === 'docs' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">API Reference</h3>
            <div className="space-y-4">
              <DocEndpoint
                method="POST"
                path="/v1/checkouts"
                description="Create a new payment checkout"
              />
              <DocEndpoint
                method="GET"
                path="/v1/checkouts/:id"
                description="Retrieve checkout status"
              />
              <DocEndpoint
                method="GET"
                path="/v1/checkouts"
                description="List all checkouts with filters"
              />
              <DocEndpoint
                method="POST"
                path="/v1/checkouts/:id/expire"
                description="Expire a pending checkout"
              />
              <DocEndpoint
                method="GET"
                path="/v1/transactions"
                description="List all payment events"
              />
              <DocEndpoint
                method="GET"
                path="/v1/detector/status"
                description="Get detector device health"
              />
            </div>
          </div>

          {/* Response Format */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Response Format</h3>
            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono">
{`{
  "id": "chk_a1b2c3d4",
  "merchantOrderId": "INV-2024-001",
  "status": "PENDING",
  "amountPiastres": "15000",
  "currency": "EGP",
  "expectedSenderHandle": "customer@instapay",
  "expiresAt": "2026-09-28T15:32:00.000Z",
  "createdAt": "2026-09-28T14:32:00.000Z",
  "paymentUrl": "https://pay.instapay-gateway.com/chk_a1b2c3d4"
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocEndpoint({ method, path, description }: { method: string; path: string; description: string }) {
  const methodColor = method === 'POST' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
      <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${methodColor}`}>
        {method}
      </span>
      <code className="text-sm font-mono text-slate-700 flex-1">{path}</code>
      <span className="text-sm text-slate-500 hidden sm:block">{description}</span>
    </div>
  );
}
