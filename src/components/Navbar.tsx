import React from 'react';
import { Sparkles, Shield } from 'lucide-react';

export type NavTab = 'dashboard' | 'audit_studio' | 'rule_engine' | 'channel_guard' | 'audit_history';

interface NavbarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onNewScan: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onNewScan }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b1020]/90 backdrop-blur-xl border-b border-white/10 px-4 lg:px-8 py-3.5">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-8">
        
        {/* Zone 1: Brand title wordmark */}
        <button
          onClick={() => onTabChange('dashboard')}
          className="flex items-center gap-2.5 text-left group focus:outline-none shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)] border border-white/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors whitespace-nowrap">
            BrandGuard AI
          </span>
        </button>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'dashboard'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
            {currentTab === 'dashboard' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('audit_studio')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'audit_studio'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Studio
            {currentTab === 'audit_studio' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('rule_engine')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'rule_engine'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rule Engine
            {currentTab === 'rule_engine' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('channel_guard')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'channel_guard'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Channel Guard
            {currentTab === 'channel_guard' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('audit_history')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'audit_history'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            History & Logs
            {currentTab === 'audit_history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            )}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onNewScan}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center gap-2 whitespace-nowrap shrink-0 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-200" />
            <span>New Live Scan</span>
          </button>
        </div>

      </div>

      {/* Mobile nav strip below */}
      <div className="md:hidden flex items-center gap-4 overflow-x-auto pt-2.5 border-t border-white/5 mt-2.5 text-xs">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'dashboard' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          Overview
        </button>
        <button
          onClick={() => onTabChange('audit_studio')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'audit_studio' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          Audit Studio
        </button>
        <button
          onClick={() => onTabChange('rule_engine')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'rule_engine' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          Rule Engine
        </button>
        <button
          onClick={() => onTabChange('channel_guard')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'channel_guard' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          Channel Guard
        </button>
        <button
          onClick={() => onTabChange('audit_history')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'audit_history' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          History
        </button>
      </div>
    </header>
  );
};
