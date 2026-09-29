import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Set or clear bearer token for API calls
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    try {
      localStorage.setItem('instapay_merchant_token', token)
    } catch {}
  } else {
    delete api.defaults.headers.common['Authorization']
    try {
      localStorage.removeItem('instapay_merchant_token')
    } catch {}
  }
}

// Initialize token from storage if available
try {
  const savedToken = localStorage.getItem('instapay_merchant_token')
  if (savedToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
  }
} catch {}

// ─── Auth API ───────────────────────────────────────────────────────

export const authApi = {
  async sendOtp(email: string) {
    const res = await api.post('/auth/email-otp', { email })
    return res.data
  },
  async register(data: {
    businessName: string
    businessType?: string
    email: string
    password: string
    instapayHandle: string
    instapayPaymentUrl?: string
    whatsappNumber?: string
    otp?: string
  }) {
    const res = await api.post('/auth/register', data)
    return res.data
  },
  async login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password })
    if (res.data?.token) {
      setAuthToken(res.data.token)
    }
    return res.data
  },
  async getSession() {
    const res = await api.get('/auth/session')
    return res.data
  },
  async logout() {
    const res = await api.post('/auth/logout')
    setAuthToken(null)
    return res.data
  },
}

// ─── Transactions API ───────────────────────────────────────────────

export const transactionsApi = {
  async list(params?: { status?: string; search?: string; page?: number; limit?: number }) {
    const res = await api.get('/transactions', { params })
    return res.data
  },
  async getStats() {
    const res = await api.get('/transactions/stats')
    return res.data
  },
  async getReviewQueue() {
    const res = await api.get('/transactions/review-queue')
    return res.data
  },
  async confirm(sessionId: string) {
    const res = await api.post(`/transactions/${sessionId}/confirm`)
    return res.data
  },
  async dismissReviewItem(id: string) {
    const res = await api.post(`/transactions/review-queue/${id}/dismiss`)
    return res.data
  },
  getExportUrl() {
    return '/api/transactions/export'
  },
}

// ─── Settings API ───────────────────────────────────────────────────

export const settingsApi = {
  async get() {
    const res = await api.get('/settings')
    return res.data
  },
  async update(data: {
    businessName?: string
    instapayHandle?: string
    instapayPaymentUrl?: string
    webhookUrl?: string
    checkoutTtlMin?: number
  }) {
    const res = await api.put('/settings', data)
    return res.data
  },
  async rotateKeys() {
    const res = await api.post('/settings/rotate-keys')
    return res.data
  },
}

// ─── Admin API ──────────────────────────────────────────────────────

export const adminApi = {
  setAdminToken(token: string | null) {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      try {
        localStorage.setItem('instapay_admin_token', token)
      } catch {}
    } else {
      delete api.defaults.headers.common['Authorization']
      try {
        localStorage.removeItem('instapay_admin_token')
      } catch {}
    }
  },
  async checkSession() {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.get('/admin/session', { headers })
    return res.data
  },
  async login(password: string) {
    const res = await api.post('/admin/auth', { password })
    if (res.data?.token) {
      this.setAdminToken(res.data.token)
    }
    return res.data
  },
  async logout() {
    try {
      await api.post('/admin/logout')
    } catch {}
    this.setAdminToken(null)
    return { ok: true }
  },
  async getStats() {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.get('/admin/stats', { headers })
    return res.data
  },
  async getTransactions(status?: string) {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.get('/admin/transactions', { params: { status }, headers })
    return res.data
  },
  async listClients() {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.get('/admin/clients', { headers })
    return res.data
  },
  async approveClient(id: string) {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.post(`/admin/clients/${id}/approve`, {}, { headers })
    return res.data
  },
  async rejectClient(id: string) {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.post(`/admin/clients/${id}/reject`, {}, { headers })
    return res.data
  },
  async forceConfirm(sessionId: string) {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.post(`/admin/transactions/${sessionId}/confirm`, {}, { headers })
    return res.data
  },
  async getAuditLogs() {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.get('/admin/audit', { headers })
    return res.data
  },
  async getWebhooks() {
    const token = localStorage.getItem('instapay_admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await api.get('/admin/webhooks', { headers })
    return res.data
  },
}
