import React from 'react';
import type { Page } from '../App';
import {
  LayoutDashboard,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Code2,
  Settings,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { page: 'overview', label: 'Overview', icon: LayoutDashboard },
  { page: 'transactions', label: 'Transactions', icon: CreditCard },
  { page: 'review', label: 'Manual Review', icon: ShieldCheck },
  { page: 'detector', label: 'Detector', icon: Smartphone },
  { page: 'developers', label: 'Developers', icon: Code2 },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">InstaPay</h2>
            <p className="text-xs text-slate-400">Payment Gateway</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.page === 'review' && (
                <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  3
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-green" />
            <span className="text-xs font-medium text-green-400">System Online</span>
          </div>
          <p className="text-xs text-slate-400">All services operational</p>
        </div>
      </div>
    </aside>
  );
}
