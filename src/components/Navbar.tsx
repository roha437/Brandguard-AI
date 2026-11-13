import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Shield, LogIn, User as UserIcon, LogOut, KeyRound, ChevronDown } from 'lucide-react';
import { useSupabase } from '../contexts/SupabaseContext';
import type { AuthModalMode } from './AuthModal';

export type NavTab =
  | 'dashboard'
  | 'audit_studio'
  | 'videoguard'
  | 'review_workflow'
  | 'rule_engine'
  | 'channel_guard'
  | 'audit_history';

interface NavbarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onNewScan: () => void;
  onOpenAuthModal: (mode: AuthModalMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onNewScan,
  onOpenAuthModal,
}) => {
  const { user, profile, signOut, isInitializing } = useSupabase();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email?.split('@')[0] ||
    'Account';

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b1020]/90 backdrop-blur-xl border-b border-white/10 px-4 lg:px-8 py-3.5">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 lg:gap-8">
        
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

        {/* Zone 2: Concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium">
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
            onClick={() => onTabChange('videoguard')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'videoguard'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            VideoGuard
            {currentTab === 'videoguard' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('review_workflow')}
            className={`whitespace-nowrap shrink-0 transition-colors relative py-1 ${
              currentTab === 'review_workflow'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Review Workflow
            {currentTab === 'review_workflow' && (
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

        {/* Zone 3: Auth status + primary action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!isInitializing && !user && (
            <button
              type="button"
              onClick={() => onOpenAuthModal('signin')}
              className="px-3 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-violet-500/40 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-violet-300" />
              <span>Sign In</span>
            </button>
          )}

          {!isInitializing && user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-violet-500/40 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600/80 to-blue-600/80 text-[10px] font-bold text-white flex items-center justify-center border border-white/20">
                  {initials || 'BG'}
                </span>
                <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 glass-panel-elevated rounded-xl border border-violet-500/30 shadow-2xl py-2 z-50 text-xs">
                  <div className="px-3.5 py-2 border-b border-white/10">
                    <p className="font-semibold text-white truncate">{displayName}</p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">{user.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAuthModal('profile');
                    }}
                    className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-violet-400" />
                    <span>Account Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAuthModal('update_password');
                    }}
                    className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                    <span>Update Password</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full px-3.5 py-2 text-left text-red-300 hover:text-red-200 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

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
          onClick={() => onTabChange('videoguard')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'videoguard' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          VideoGuard
        </button>
        <button
          onClick={() => onTabChange('review_workflow')}
          className={`whitespace-nowrap pb-1 ${currentTab === 'review_workflow' ? 'text-violet-400 font-semibold border-b border-violet-400' : 'text-slate-400'}`}
        >
          Review Workflow
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
