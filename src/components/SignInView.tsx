import React, { useState } from 'react';
import { MihoraLogo } from './Header';
import { ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface SignInViewProps {
  onSignIn: () => Promise<void>;
}

export const SignInView: React.FC<SignInViewProps> = ({ onSignIn }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignInClick = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      await onSignIn();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMessage('Unable to complete Google authentication. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 bg-mihora-grid text-slate-900">
      {/* Top corporate bar */}
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
              <span className="text-[11px] font-medium text-slate-500">Talent Screening</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded border border-slate-200/80">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>Restricted Internal System</span>
          </div>
        </div>
      </header>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-blue-50 border border-blue-100 text-blue-700 mb-1">
              <MihoraLogo className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Sign In to Mihora
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Authorized talent team access for job requisitions, candidate evidence verification, and screening evaluations.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Internal Recruitment Workspace</span>
            </div>
            <ul className="space-y-1.5 pl-5 list-disc text-[12px] text-slate-600">
              <li>Manage active and closed job requisitions</li>
              <li>Perform evidence-based resume screening against role criteria</li>
              <li>Real-time candidate tracking with Candidate Location Intelligence</li>
            </ul>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <button
              onClick={handleSignInClick}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 disabled:opacity-60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 cursor-pointer"
            >
              {/* Google G Icon */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
            </button>
          </div>

          <div className="text-center pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              Sign in with any Google account. Access to internal recruiting records requires Mihora Tech authorization.
            </span>
          </div>
        </div>
      </div>

      {/* Corporate footer */}
      <footer className="border-t border-slate-200/90 bg-white/80 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
          Mihora Resume Intelligence · Evidence-Based Candidate Screening System
        </div>
      </footer>
    </div>
  );
};
