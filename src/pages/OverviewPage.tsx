import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Smartphone,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const revenueData = [
  { name: 'Mon', revenue: 4200, transactions: 12 },
  { name: 'Tue', revenue: 3800, transactions: 10 },
  { name: 'Wed', revenue: 5100, transactions: 15 },
  { name: 'Thu', revenue: 4600, transactions: 13 },
  { name: 'Fri', revenue: 6200, transactions: 18 },
  { name: 'Sat', revenue: 7800, transactions: 22 },
  { name: 'Sun', revenue: 5400, transactions: 16 },
];

const recentTransactions = [
  { id: 'ORD-7842', amount: '150.00', sender: 'ahmed@instapay', status: 'PAID', time: '2 min ago' },
  { id: 'ORD-7841', amount: '89.50', sender: 'sara.m@instapay', status: 'PAID', time: '15 min ago' },
  { id: 'ORD-7840', amount: '250.00', sender: 'youssef@instapay', status: 'NEEDS_REVIEW', time: '32 min ago' },
  { id: 'ORD-7839', amount: '75.00', sender: 'nour@instapay', status: 'PENDING', time: '1 hr ago' },
  { id: 'ORD-7838', amount: '320.00', sender: 'khaled@instapay', status: 'PAID', time: '2 hrs ago' },
];

const statusColors: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  NEEDS_REVIEW: 'bg-orange-100 text-orange-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-700',
};

export function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value="12,450.00 EGP"
          subtitle="This month"
          trend="+12.5%"
          trendUp={true}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Pending Reviews"
          value="3"
          subtitle="Requires attention"
          trend=""
          trendUp={false}
          icon={<AlertCircle className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Total Checkouts"
          value="142"
          subtitle="All time"
          trend="+8.2%"
          trendUp={true}
          icon={<CreditCard className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Detector Status"
          value="Online"
          subtitle="Last seen 2 min ago"
          trend=""
          trendUp={false}
          icon={<Smartphone className="w-5 h-5" />}
          color="cyan"
          isOnline
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Revenue Overview</h3>
            <p className="text-sm text-slate-500">Weekly transaction volume</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">Week</button>
            <button className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg">Month</button>
            <button className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg">Year</button>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detector Health + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detector Health Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Detector Health</h3>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-green" />
              Online
            </span>
          </div>
          <div className="space-y-4">
            <HealthRow label="Last Heartbeat" value="2 min ago" />
            <HealthRow label="Listener" value="Active" status="good" />
            <HealthRow label="Battery Optimized" value="Exempt" status="good" />
            <HealthRow label="App Version" value="2.0.0" />
            <HealthRow label="Package" value="com.egyptianbanks.instapay" />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Recent Transactions</h3>
            <button className="text-sm text-blue-600 font-medium hover:text-blue-700">View All</button>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.status === 'PAID' ? 'bg-emerald-100' :
                    tx.status === 'NEEDS_REVIEW' ? 'bg-orange-100' : 'bg-amber-100'
                  }`}>
                    {tx.status === 'PAID' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                     tx.status === 'NEEDS_REVIEW' ? <AlertCircle className="w-5 h-5 text-orange-600" /> :
                     <Clock className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{tx.id}</p>
                    <p className="text-xs text-slate-500">{tx.sender}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{tx.amount} EGP</p>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[tx.status]}`}>
                    {tx.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendUp,
  icon,
  color,
  isOnline,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
  color: string;
  isOnline?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </span>
        )}
        {isOnline && (
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-green" />
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function HealthRow({ label, value, status }: { label: string; value: string; status?: 'good' | 'bad' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${
        status === 'good' ? 'text-emerald-600' : status === 'bad' ? 'text-red-500' : 'text-slate-700'
      }`}>
        {value}
      </span>
    </div>
  );
}
