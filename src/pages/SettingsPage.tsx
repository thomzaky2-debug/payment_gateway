import React from 'react';
import { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';

interface SettingsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function SettingsPage({ showToast }: SettingsPageProps = {}) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Settings</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Manage your account and gateway preferences</p>
        </div>
        <button
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
            fontSize: '14px', fontWeight: 500, borderRadius: '12px',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)'
          }}
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Settings Navigation */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '8px' }}>
          {[
            { id: 'profile', label: '👤 Profile' },
            { id: 'business', label: '🏢 Business' },
            { id: 'notifications', label: '🔔 Notifications' },
            { id: 'security', label: '🔒 Security' },
            { id: 'payouts', label: '💳 Payouts' },
          ].map((item, index) => (
            <button
              key={item.id}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                backgroundColor: index === 0 ? '#eff6ff' : 'transparent',
                color: index === 0 ? '#1e40af' : '#475569',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Profile Information</h3>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '32px', fontWeight: 'bold'
            }}>
              M
            </div>
            <div>
              <button style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 500, color: '#2563eb', backgroundColor: '#eff6ff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                Change Avatar
              </button>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>JPG, PNG. Max 2MB.</p>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <FormField label="Full Name" defaultValue="Merchant Admin" />
            <FormField label="Email" defaultValue="merchant@instapay.com" />
            <FormField label="Phone" defaultValue="+20 100 123 4567" />
            <FormField label="Timezone" defaultValue="Africa/Cairo (UTC+2)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>{label}</label>
      <input
        type="text"
        defaultValue={defaultValue}
        style={{
          width: '100%', padding: '10px 16px', backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px',
          outline: 'none',
        }}
      />
    </div>
  );
}
