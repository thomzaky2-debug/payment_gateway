import type { Page } from '../App';
import { Bell, Search } from 'lucide-react';

interface TopbarProps {
  currentPage: Page;
}

const pageTitles: Record<Page, string> = {
  overview: 'Dashboard Overview',
  transactions: 'Transactions',
  review: 'Manual Review',
  detector: 'Detector Health',
  developers: 'Developer Portal',
  settings: 'Settings',
};

export function Topbar({ currentPage }: TopbarProps) {
  return (
    <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{pageTitles[currentPage]}</h1>
        <p className="text-sm text-slate-500">Welcome back, Merchant</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 w-64 bg-slate-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
            M
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-slate-700">Merchant</p>
            <p className="text-xs text-slate-500">merchant@instapay</p>
          </div>
        </div>
      </div>
    </header>
  );
}
