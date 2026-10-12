import React from 'react';
import { TabType } from '../types';
import { User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onStartNewAnalysis: () => void;
  currentUser: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const MihoraLogo: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mihora Tech Logo"
    >
      <path
        d="M6 38L18 10L24 24L12 40L6 38Z"
        fill="url(#mihora-grad-1)"
      />
      <path
        d="M18 10L24 24L30 10L24 16L18 10Z"
        fill="url(#mihora-grad-2)"
      />
      <path
        d="M24 24L30 10L42 38L36 40L24 24Z"
        fill="url(#mihora-grad-3)"
      />
      <path
        d="M12 40L24 24L36 40L24 34L12 40Z"
        fill="url(#mihora-grad-4)"
      />
      <defs>
        <linearGradient id="mihora-grad-1" x1="6" y1="10" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284C7" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="mihora-grad-2" x1="18" y1="10" x2="30" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="mihora-grad-3" x1="24" y1="10" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="mihora-grad-4" x1="12" y1="24" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onStartNewAnalysis,
  currentUser,
  onSignIn,
  onSignOut,
}) => {
  const navItems: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'CEO Dashboard' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'candidates', label: 'Candidates' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 shadow-2xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Brand title & Contextual label */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectTab('overview')}
              className="flex items-center gap-2.5 text-left group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
              aria-label="Mihora Resume Intelligence Home"
            >
              <MihoraLogo className="w-8 h-8 shrink-0 transition-transform duration-200 group-hover:scale-[1.02]" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-900 font-sans">
                    MIHORA
                  </span>
                  <span className="text-xs font-semibold tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-200/60 uppercase">
                    Resume Intelligence
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500 tracking-tight">
                  Talent Screening
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3.5 py-1.5 text-sm font-medium transition-colors relative whitespace-nowrap rounded-md ${
                    isActive
                      ? 'text-blue-700 bg-blue-50/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-blue-700 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Auth Status */}
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate max-w-[120px] font-medium">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded"
                  title="Sign out of Firebase"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                title="Sign in with Google to sync evaluations to Firestore"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </button>
            )}

            <button
              onClick={onStartNewAnalysis}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 whitespace-nowrap focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 ${
                activeTab === 'new-analysis'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
              }`}
            >
              + New Analysis
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap rounded ${
                  isActive
                    ? 'text-blue-700 font-semibold bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
