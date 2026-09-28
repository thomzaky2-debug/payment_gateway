import { useState } from 'react';
import {
  User,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Save,
  CheckCircle2,
} from 'lucide-react';

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'payouts', label: 'Payouts', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-sm text-slate-500">Manage your account and gateway preferences</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {activeSection === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-800">Profile Information</h3>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                  M
                </div>
                <div>
                  <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    Change Avatar
                  </button>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Full Name" defaultValue="Merchant Admin" />
                <FormField label="Email" defaultValue="merchant@instapay.com" type="email" />
                <FormField label="Phone" defaultValue="+20 100 123 4567" />
                <FormField label="Timezone" defaultValue="Africa/Cairo (UTC+2)" />
              </div>
            </div>
          )}

          {activeSection === 'business' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-800">Business Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Business Name" defaultValue="My Store LLC" />
                <FormField label="Business Email" defaultValue="billing@mystore.com" type="email" />
                <FormField label="Phone Number" defaultValue="+20 2 1234 5678" />
                <FormField label="Tax ID" defaultValue="123-456-789" />
                <div className="md:col-span-2">
                  <FormField label="Business Address" defaultValue="123 Tahrir Square, Cairo, Egypt" />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">InstaPay Handle</span>
                </div>
                <p className="text-sm text-blue-700 font-mono">merchant@instapay</p>
                <p className="text-xs text-blue-600 mt-1">This is the handle customers send payments to</p>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-800">Notification Preferences</h3>

              <div className="space-y-4">
                <ToggleRow
                  label="Payment Received"
                  description="Get notified when a payment is confirmed"
                  defaultChecked
                />
                <ToggleRow
                  label="Manual Review Required"
                  description="Alert when a payment needs manual approval"
                  defaultChecked
                />
                <ToggleRow
                  label="Detector Offline"
                  description="Alert when your detector device goes offline"
                  defaultChecked
                />
                <ToggleRow
                  label="Daily Summary"
                  description="Receive a daily summary of all transactions"
                  defaultChecked={false}
                />
                <ToggleRow
                  label="Webhook Failures"
                  description="Alert when webhook delivery fails"
                  defaultChecked
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Delivery Method</h4>
                <div className="flex flex-wrap gap-3">
                  <ToggleChip label="Email" defaultChecked />
                  <ToggleChip label="Push Notification" defaultChecked />
                  <ToggleChip label="SMS" defaultChecked={false} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-800">Security Settings</h3>

              <div className="space-y-4">
                <div className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Password</p>
                      <p className="text-xs text-slate-500">Last changed 30 days ago</p>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                      Change
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Two-Factor Authentication</p>
                      <p className="text-xs text-slate-500">Add an extra layer of security</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                      Enabled
                    </span>
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Active Sessions</p>
                      <p className="text-xs text-slate-500">2 devices currently logged in</p>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                      Revoke All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'payouts' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-800">Payout Settings</h3>

              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Bank Account</p>
                    <p className="text-xs text-slate-500">Payouts are sent to this account</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-sm font-mono text-slate-700">**** **** **** 4567</p>
                  <p className="text-xs text-slate-500">Commercial International Bank - Egypt</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Payout Schedule" defaultValue="Weekly (Monday)" />
                <FormField label="Minimum Payout" defaultValue="100.00 EGP" />
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
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

function FormField({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </div>
  );
}

function ToggleRow({ label, description, defaultChecked }: { label: string; description: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function ToggleChip({ label, defaultChecked }: { label: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      onClick={() => setChecked(!checked)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        checked ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
