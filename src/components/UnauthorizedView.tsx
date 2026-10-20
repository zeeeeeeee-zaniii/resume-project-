import React from 'react';
import { MihoraLogo } from './Header';
import { ShieldAlert, LogOut, ArrowRight, Building } from 'lucide-react';
import { User } from 'firebase/auth';
import { ALLOWED_COMPANY_DOMAINS } from '../lib/auth-policy';

interface UnauthorizedViewProps {
  user: User;
  onSignOut: () => Promise<void>;
  onSwitchAccount: () => Promise<void>;
}

export const UnauthorizedView: React.FC<UnauthorizedViewProps> = ({
  user,
  onSignOut,
  onSwitchAccount,
}) => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 bg-mihora-grid text-slate-900">
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MihoraLogo className="w-8 h-8 shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">MIHORA</span>
                <span className="text-[11px] font-semibold tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-200/60 uppercase">
                  Resume Intelligence
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">Access Control</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Access Restricted</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mb-1">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Access Restricted
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              You are signed in, but this account is not authorized to access Mihora Tech's private recruitment workspace.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Signed-in Account:</span>
              <span className="font-mono font-medium text-slate-900 break-all">{user.email}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
              <span className="text-slate-500">Access Status:</span>
              <span className="font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                Not Authorized
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
              <span className="text-slate-500">Authorized Domains:</span>
              <span className="font-medium text-blue-700">
                {ALLOWED_COMPANY_DOMAINS.map((d) => `@${d}`).join(', ')}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={onSwitchAccount}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <span>Switch to Mihora Tech Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="text-center pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              If you believe this is in error, contact your Mihora Tech workspace administrator.
            </span>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200/90 bg-white/80 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
          Mihora Tech Security Operations · Identity & Access Management
        </div>
      </footer>
    </div>
  );
};
