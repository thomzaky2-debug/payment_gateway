import React, { useState } from 'react';
import { Save, CheckCircle2, User, Building2, Bell, Shield, CreditCard } from 'lucide-react';

interface SettingsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function SettingsPage({ showToast }: SettingsPageProps = {}) {
  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    timezone: 'Africa/Cairo (UTC+2)',
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    taxId: '',
    address: '',
  });

  const handleSave = () => {
    // Validate
    if (!formData.email || !formData.fullName) {
      showToast?.('error', 'Please fill in all required fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showToast?.('error', 'Please enter a valid email address');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      showToast?.('success', 'Settings saved successfully!');
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
  };

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const sections = [
    { id: 'profile', label: '👤 Profile', icon: User },
    { id: 'business', label: '🏢 Business', icon: Building2 },
    { id: 'notifications', label: '🔔 Notifications', icon: Bell },
    { id: 'security', label: '🔒 Security', icon: Shield },
    { id: 'payouts', label: '💳 Payouts', icon: CreditCard },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Settings</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Manage your account and gateway preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
            fontSize: '14px', fontWeight: 500, borderRadius: '12px',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)',
          }}
        >
          {saving ? (
            <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : saved ? (
            <CheckCircle2 size={16} />
          ) : (
            <Save size={16} />
          )}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Settings Navigation */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '8px' }}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                backgroundColor: activeSection === section.id ? '#eff6ff' : 'transparent',
                color: activeSection === section.id ? '#1e40af' : '#475569',
                marginBottom: '4px',
              }}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', flex: 1, minWidth: 0 }}>
          {activeSection === 'profile' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Profile Information</h3>
              
              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '16px',
                  background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '32px', fontWeight: 'bold',
                }}>M</div>
                <div>
                  <button
                    onClick={() => showToast?.('info', 'Avatar upload coming soon...')}
                    style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 500, color: '#2563eb', backgroundColor: '#eff6ff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                  >
                    Change Avatar
                  </button>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>JPG, PNG. Max 2MB.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <FormField label="Full Name" value={formData.fullName} onChange={(v) => updateField('fullName', v)} required />
                <FormField label="Email" value={formData.email} onChange={(v) => updateField('email', v)} type="email" required />
                <FormField label="Phone" value={formData.phone} onChange={(v) => updateField('phone', v)} />
                <FormField label="Timezone" value={formData.timezone} onChange={(v) => updateField('timezone', v)} />
              </div>
            </div>
          )}

          {activeSection === 'business' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Business Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <FormField label="Business Name" value={formData.businessName} onChange={(v) => updateField('businessName', v)} />
                <FormField label="Business Email" value={formData.businessEmail} onChange={(v) => updateField('businessEmail', v)} type="email" />
                <FormField label="Phone Number" value={formData.businessPhone} onChange={(v) => updateField('businessPhone', v)} />
                <FormField label="Tax ID" value={formData.taxId} onChange={(v) => updateField('taxId', v)} />
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField label="Business Address" value={formData.address} onChange={(v) => updateField('address', v)} />
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>🌐</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>InstaPay Handle</span>
                </div>
                <p style={{ fontSize: '14px', color: '#1e40af', fontFamily: 'monospace', margin: '0 0 4px 0' }}>{formData.businessEmail ? formData.businessEmail.split('@')[0] + '@instapay' : 'Not configured'}</p>
                <p style={{ fontSize: '12px', color: '#3b82f6', margin: 0 }}>This is the handle customers send payments to</p>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Notification Preferences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Payment Received', desc: 'Get notified when a payment is confirmed', defaultChecked: true },
                  { label: 'Manual Review Required', desc: 'Alert when a payment needs manual approval', defaultChecked: true },
                  { label: 'Detector Offline', desc: 'Alert when your detector device goes offline', defaultChecked: true },
                  { label: 'Daily Summary', desc: 'Receive a daily summary of all transactions', defaultChecked: false },
                  { label: 'Webhook Failures', desc: 'Alert when webhook delivery fails', defaultChecked: true },
                ].map((item, i) => (
                  <ToggleRow key={i} label={item.label} description={item.desc} defaultChecked={item.defaultChecked} onChange={(checked) => {
                    showToast?.('success', `${item.label} ${checked ? 'enabled' : 'disabled'}`);
                  }} />
                ))}
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Security Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>Password</p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Last changed 30 days ago</p>
                    </div>
                    <button
                      onClick={() => showToast?.('info', 'Password change form coming soon...')}
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#2563eb', backgroundColor: '#eff6ff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>Two-Factor Authentication</p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Add an extra layer of security</p>
                    </div>
                    <span style={{ padding: '4px 10px', backgroundColor: '#d1fae5', color: '#047857', fontSize: '12px', fontWeight: 500, borderRadius: '9999px' }}>
                      Enabled
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>Active Sessions</p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>2 devices currently logged in</p>
                    </div>
                    <button
                      onClick={() => showToast?.('warning', 'All other sessions have been revoked')}
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#dc2626', backgroundColor: '#fee2e2', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      Revoke All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'payouts' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Payout Settings</h3>
              
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <CreditCard size={20} style={{ color: '#475569' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>Bank Account</p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Payouts are sent to this account</p>
                  </div>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '14px', fontFamily: 'monospace', color: '#1e293b', margin: 0 }}>**** **** **** 4567</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Bank Account - Egypt</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <FormField label="Payout Schedule" value="Weekly (Monday)" onChange={() => {}} />
                <FormField label="Minimum Payout" value="100.00 EGP" onChange={() => {}} />
              </div>

              <div style={{ padding: '16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
                  <strong>Note:</strong> Gateway fee of 1.5% is deducted from each transaction before payout.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 16px', backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px',
          outline: 'none', color: '#1e293b',
        }}
      />
    </div>
  );
}

function ToggleRow({ label, description, defaultChecked, onChange }: {
  label: string;
  description: string;
  defaultChecked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>{description}</p>
      </div>
      <button
        onClick={() => {
          const newChecked = !checked;
          setChecked(newChecked);
          onChange(newChecked);
        }}
        style={{
          position: 'relative', width: '44px', height: '24px', borderRadius: '12px',
          backgroundColor: checked ? '#2563eb' : '#cbd5e1',
          border: 'none', cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
          width: '20px', height: '20px', borderRadius: '50%',
          backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
        }} />
      </button>
    </div>
  );
}
