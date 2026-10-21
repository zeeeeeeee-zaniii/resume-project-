import React, { useState, useEffect } from 'react';
import { TabType, UserRole } from '../types';
import { User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, Menu, X, Shield, Sparkles, Briefcase, CalendarClock, Users } from 'lucide-react';

interface HeaderProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onStartNewAnalysis: () => void;
  currentUser: User | null;
  userRole?: UserRole;
  onSignIn: () => void;
  onSignOut: () => void;
  reminderCount?: number;
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
  userRole = 'RECRUITER',
  onSignIn,
  onSignOut,
  reminderCount = 0,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const isRecruiter = userRole === 'RECRUITER';

  // Role-specific navigation items
  const navItems: { id: TabType; label: string; badge?: number }[] = isRecruiter
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'reminders', label: 'Reminders', badge: reminderCount },
        { id: 'analytics', label: 'Recruitment Analytics' },
        { id: 'jobs', label: 'Jobs' },
        { id: 'candidates', label: 'Candidates' },
        { id: 'settings', label: 'Settings' },
      ]
    : [
        { id: 'new-analysis', label: 'Analyze Resume' },
        { id: 'my-analyses', label: 'My Analyses' },
        { id: 'settings', label: 'Settings' },
      ];

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleActionClick = () => {
    onStartNewAnalysis();
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 shadow-2xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Brand title & Role Badge */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={() => handleNavClick(isRecruiter ? 'overview' : 'new-analysis')}
              className="flex items-center gap-2.5 text-left group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm cursor-pointer"
              aria-label="Mihora Resume Intelligence Home"
            >
              <MihoraLogo className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 transition-transform duration-200 group-hover:scale-[1.02]" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-900 font-sans">
                    MIHORA
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-200/60 uppercase">
                    Resume Intelligence
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
                  {isRecruiter ? (
                    <span className="text-blue-700 font-semibold flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-600" />
                      <span>Recruiter Workspace</span>
                    </span>
                  ) : (
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-600" />
                      <span>Personal Screening</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3 py-1.5 text-xs lg:text-sm font-medium transition-colors relative whitespace-nowrap rounded-md inline-flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'text-blue-700 bg-blue-50/70 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full font-mono ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-700 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Auth Status */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded max-w-[180px]">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate font-medium">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded hover:bg-slate-100 cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
                title="Sign in with Google"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </button>
            )}

            <button
              onClick={handleActionClick}
              className={`px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 whitespace-nowrap focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 cursor-pointer ${
                activeTab === 'new-analysis'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
              }`}
            >
              + {isRecruiter ? 'New Analysis' : 'Analyze Resume'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer / Backdrop */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-50 flex flex-col bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div
            className="bg-white border-b border-slate-200 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Profile Bar on Mobile */}
            {currentUser && (
              <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser.displayName || currentUser.email?.split('@')[0]}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate font-mono">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isRecruiter
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isRecruiter ? 'Recruiter' : 'Public'}
                  </span>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Navigation List */}
            <div className="p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-800 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Action Button */}
            <div className="p-4 pt-2 border-t border-slate-100">
              <button
                onClick={handleActionClick}
                className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isRecruiter ? 'Screen Candidate Resume' : 'Analyze Personal Resume'}</span>
              </button>
            </div>
          </div>

          {/* Clickable bottom backdrop to dismiss */}
          <div
            className="flex-1"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}
    </header>
  );
};
