import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const adminHttp = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Remove bearer tokens persisted by older builds. Browser authentication now
// uses separate HttpOnly cookies for merchant and owner sessions.
try {
  localStorage.removeItem('instapay_merchant_token')
  localStorage.removeItem('instapay_admin_token')
} catch {}

// ─── Auth API ───────────────────────────────────────────────────────

export const authApi = {
  async sendOtp(email: string, purpose: 'MERCHANT_SIGNUP' | 'MERCHANT_LOGIN' | 'PASSWORD_RESET' = 'MERCHANT_SIGNUP') {
    const res = await api.post('/auth/email-otp', { email, purpose })
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
    verificationId?: string
    otp?: string
  }) {
    const res = await api.post('/auth/register', data)
    return res.data
  },
  async login(email: string, password: string, verificationId?: string, otp?: string) {
    const res = await api.post('/auth/login', { email, password, verificationId, otp })
    return res.data
  },
  async resetPasswordRequest(email: string) {
    const res = await api.post('/auth/password-reset/request', { email })
    return res.data
  },
  async resetPasswordConfirm(data: { email: string; verificationId: string; otp: string; password: string }) {
    const res = await api.post('/auth/password-reset/confirm', data)
    return res.data
  },
  async getSession(params?: Record<string, any>) {
    const res = await api.get('/auth/session', { params })
    return res.data
  },
  async logout() {
    try {
      const res = await api.post('/auth/logout')
      return res.data
    } finally {
      delete api.defaults.headers.common['Authorization']
    }
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
  async reject(sessionId: string) {
    const res = await api.post(`/transactions/${sessionId}/reject`)
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
    autoAcceptOverpaid?: boolean
    overpaidMaxExcessEgp?: number | null
    underpaidToleranceEnabled?: boolean
    underpaidToleranceEgp?: number
  }) {
    const res = await api.put('/settings', data)
    return res.data
  },
  async rotateKeys() {
    const res = await api.post('/settings/rotate-keys')
    return res.data
  },
  async getAuditLogs() {
    const res = await api.get('/settings/audit-logs')
    return res.data
  },
}

// ─── Admin API ──────────────────────────────────────────────────────

export const adminApi = {
  async checkSession() {
    const res = await adminHttp.get('/admin/session')
    return res.data
  },
  async login(password: string, email?: string, totp?: string) {
    const res = await adminHttp.post('/admin/auth', { password, email, totp })
    return res.data
  },
  async logout() {
    const res = await adminHttp.post('/admin/logout')
    return res.data
  },
  async getStats() {
    const res = await adminHttp.get('/admin/stats')
    return res.data
  },
  async getTransactions(status?: string) {
    const res = await adminHttp.get('/admin/transactions', { params: { status } })
    return res.data
  },
  async listClients() {
    const res = await adminHttp.get('/admin/clients')
    return res.data
  },
  async getClientOverview(id: string) {
    const res = await adminHttp.get(`/admin/clients/${id}/overview`)
    return res.data
  },
  async setClientAccess(id: string, isActive: boolean) {
    const res = await adminHttp.patch(`/admin/clients/${id}/access`, { isActive })
    return res.data
  },
  async revokeClientSessions(id: string) {
    const res = await adminHttp.post(`/admin/clients/${id}/revoke-sessions`, {})
    return res.data
  },
  async rotateClientKeys(id: string) {
    const res = await adminHttp.post(`/admin/clients/${id}/rotate-keys`, {})
    return res.data
  },
  async approveClient(id: string) {
    const res = await adminHttp.post(`/admin/clients/${id}/approve`, {})
    return res.data
  },
  async rejectClient(id: string) {
    const res = await adminHttp.post(`/admin/clients/${id}/reject`, {})
    return res.data
  },
  async forceConfirm(sessionId: string) {
    const res = await adminHttp.post(`/admin/transactions/${sessionId}/confirm`, {})
    return res.data
  },
  async getAuditLogs() {
    const res = await adminHttp.get('/admin/audit')
    return res.data
  },
  async getWebhooks() {
    const res = await adminHttp.get('/admin/webhooks')
    return res.data
  },
  async getPlans() {
    const res = await adminHttp.get('/admin/plans')
    return res.data
  },
  async updatePlan(data: { name: string; priceEgp?: number; maxTransactions?: number; periodDays?: number; isActive?: boolean; description?: string; offerPriceEgp?: number | null; offerLabel?: string; offerValidDays?: number; clearOffer?: boolean }) {
    const res = await adminHttp.patch('/admin/plans', data)
    return res.data
  },
  async getTrialPlan() {
    const res = await adminHttp.get('/admin/trial')
    return res.data
  },
  async updateTrialPlan(data: { periodDays?: number; maxTransactions?: number; isActive?: boolean; description?: string }) {
    const res = await adminHttp.patch('/admin/trial', data)
    return res.data
  },
  async assignClientPlan(clientId: string, data: { planName: string; customTxLimit?: number; extendDays?: number }) {
    const res = await adminHttp.post(`/admin/clients/${clientId}/plan`, data)
    return res.data
  },
  async getBundles() {
    const res = await adminHttp.get('/admin/bundles')
    return res.data
  },
  async createBundle(data: { name: string; displayName: string; priceEgp: number; extraTx: number; description?: string; sortOrder?: number; isActive?: boolean }) {
    const res = await adminHttp.post('/admin/bundles', data)
    return res.data
  },
  async updateBundle(id: string, data: { displayName?: string; priceEgp?: number; extraTx?: number; description?: string; sortOrder?: number; isActive?: boolean }) {
    const res = await adminHttp.patch(`/admin/bundles/${id}`, data)
    return res.data
  },
  async getSpecialOffers() {
    const res = await adminHttp.get('/admin/special-offers')
    return res.data
  },
  async createSpecialOffer(data: { clientId: string; title: string; description?: string; priceEgp: number; maxTransactions: number; periodDays: number; validDays: number }) {
    const res = await adminHttp.post('/admin/special-offers', data)
    return res.data
  },
  async updateSpecialOffer(id: string, data: { title?: string; description?: string; priceEgp?: number; maxTransactions?: number; periodDays?: number; validDays?: number; status?: 'ACTIVE' | 'REVOKED' }) {
    const res = await adminHttp.patch(`/admin/special-offers/${id}`, data)
    return res.data
  },
  async sendNotification(data: { target?: string; clientId?: string; title: string; message: string; severity?: string }) {
    const res = await adminHttp.post('/admin/notifications', data)
    return res.data
  },
}

// ─── Plans & Subscription API ───────────────────────────────────────

export const plansApi = {
  async list(params?: Record<string, any>) {
    const res = await api.get('/plans', { params })
    return res.data
  },
}

export const subscriptionApi = {
  async getSpecialOffers() {
    const res = await api.get('/subscription/special-offers')
    return res.data
  },
  async checkout(planName: string, senderHandle?: string) {
    const res = await api.post('/subscription/checkout', { planName, senderHandle })
    return res.data
  },
  async updateSender(sessionId: string, senderHandle: string) {
    const res = await api.patch(`/subscription/checkout/${sessionId}/sender`, { senderHandle })
    return res.data
  },
  async activateTrial() {
    const res = await api.post('/subscription/trial/activate')
    return res.data
  },
  async getStatus(sessionId: string) {
    const res = await api.get(`/subscription/status/${sessionId}`)
    return res.data
  },
}

// ─── Merchant Notifications API ─────────────────────────────────────

export const notificationsApi = {
  async list() {
    const res = await api.get('/notifications')
    return res.data
  },
  async markRead(id: string) {
    const res = await api.post(`/notifications/${id}/read`)
    return res.data
  },
  async markAllRead() {
    const res = await api.post('/notifications/read-all')
    return res.data
  },
}

// ─── Top-Up Bundles API ─────────────────────────────────────────────

export const bundlesApi = {
  async list() {
    const res = await api.get('/bundles')
    return res.data
  },
  async purchase(bundleName: string, senderHandle?: string) {
    const res = await api.post('/bundles/purchase', { bundleName, senderHandle })
    return res.data
  },
  async getHistory() {
    const res = await api.get('/bundles/history')
    return res.data
  },
  async getStatus(sessionId: string) {
    const res = await api.get(`/bundles/status/${sessionId}`)
    return res.data
  },
}
