import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Battery,
  Wifi,
  Shield,
  Clock,
  Download,
  RefreshCw,
  Cpu,
  Activity,
} from 'lucide-react';

export function DetectorPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Detector Health</h2>
        <p className="text-sm text-slate-500">Monitor your Android detector device and notification listener</p>
      </div>

      {/* Status Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Detector Online</h3>
                <span className="w-3 h-3 rounded-full bg-white animate-pulse-green" />
              </div>
              <p className="text-emerald-100 text-sm">Last heartbeat: 2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Wifi className="w-5 h-5" />}
          label="Listener Status"
          value="Active"
          status="good"
          color="emerald"
        />
        <MetricCard
          icon={<Battery className="w-5 h-5" />}
          label="Battery Optimization"
          value="Exempt"
          status="good"
          color="emerald"
        />
        <MetricCard
          icon={<Clock className="w-5 h-5" />}
          label="Uptime"
          value="14h 32m"
          status="neutral"
          color="blue"
        />
        <MetricCard
          icon={<Activity className="w-5 h-5" />}
          label="Notifications Today"
          value="23"
          status="neutral"
          color="cyan"
        />
      </div>

      {/* Device Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Device Information
          </h3>
          <div className="space-y-4">
            <InfoRow label="Device Name" value="Samsung Galaxy A54" />
            <InfoRow label="Android Version" value="14 (API 34)" />
            <InfoRow label="Min SDK Supported" value="Android 8.0 (API 26)" />
            <InfoRow label="App Version" value="2.0.0" />
            <InfoRow label="Package Name" value="com.instapaydetector.merchant" />
            <InfoRow label="InstaPay Package" value="com.egyptianbanks.instapay" />
            <InfoRow label="Recipient Handle" value="merchant@instapay" />
            <InfoRow label="Device ID" value="dev_a1b2c3d4e5" />
          </div>
        </div>

        {/* Heartbeat Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Heartbeat History
          </h3>
          <div className="space-y-3">
            {[
              { time: '14:32', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '14:17', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '14:02', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '13:47', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '13:32', status: 'warning', message: 'Delayed heartbeat - 18 min gap' },
              { time: '13:14', status: 'success', message: 'Heartbeat received - All systems OK' },
            ].map((hb, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  hb.status === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{hb.message}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{hb.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-600" />
          Detector APK Setup
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SetupStep
            number={1}
            title="Download APK"
            description="Download the latest detector APK from the developer portal"
            icon={<Download className="w-5 h-5" />}
          />
          <SetupStep
            number={2}
            title="Grant Permissions"
            description="Enable notification access and battery optimization exemption"
            icon={<Shield className="w-5 h-5" />}
          />
          <SetupStep
            number={3}
            title="Configure Token"
            description="Enter your detect token and recipient handle in the app"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
        </div>

        {/* OEM-specific warnings */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-800 mb-1">OEM Battery Protection</h4>
              <p className="text-xs text-amber-700 mb-2">
                Some manufacturers aggressively kill background apps. Ensure you:
              </p>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• <strong>Xiaomi/Redmi:</strong> Enable auto-start in Security app</li>
                <li>• <strong>Samsung:</strong> Disable battery optimization in Device Care</li>
                <li>• <strong>Huawei/Honor:</strong> Add to "Launch Manager" whitelist</li>
                <li>• <strong>Oppo/Realme:</strong> Enable auto-start in Battery settings</li>
                <li>• <strong>Vivo:</strong> Allow background activity in iManager</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  status,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'good' | 'bad' | 'neutral';
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        {status === 'good' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {status === 'bad' && <AlertTriangle className="w-4 h-4 text-red-500" />}
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 font-mono">{value}</span>
    </div>
  );
}

function SetupStep({ number, title, description, icon }: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 relative">
      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
        {number}
      </div>
      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-slate-800 mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}
