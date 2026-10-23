import React, { useState } from 'react';
import { MihoraLogo } from './Header';
import { 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Loader2, 
  KeyRound,
  Sparkles
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signInWithEmail, 
  signUpWithEmail, 
  sendPasswordReset, 
  getAuthErrorMessage 
} from '../lib/firebase';

interface SignInViewProps {
  onSignIn?: () => Promise<void>;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

export const SignInView: React.FC<SignInViewProps> = () => {
  const [mode, setMode] = useState<AuthMode>('signin');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetFormFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSwitchMode = (newMode: AuthMode) => {
    resetFormFeedback();
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
  };

  // Google Sign-in Handler
  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    resetFormFeedback();
    try {
      await signInWithGoogle();
      // On success, onAuthStateChanged in App.tsx takes over seamlessly
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setErrorMessage(getAuthErrorMessage(err));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Email/Password Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(cleanEmail);
        setSuccessMessage(
          `Password reset instructions have been sent to ${cleanEmail}. Please check your inbox and follow the link.`
        );
      } catch (err: any) {
        console.error('Password reset failed:', err);
        setErrorMessage(getAuthErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please ensure both passwords are identical.');
        return;
      }

      setIsSubmitting(true);
      try {
        await signUpWithEmail(cleanEmail, password, displayName.trim());
        setSuccessMessage(
          `Account created successfully! A verification email has been sent to ${cleanEmail}.`
        );
      } catch (err: any) {
        console.error('Account creation failed:', err);
        setErrorMessage(getAuthErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Default: 'signin' mode
    setIsSubmitting(true);
    try {
      await signInWithEmail(cleanEmail, password);
    } catch (err: any) {
      console.error('Email sign-in failed:', err);
      setErrorMessage(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
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
              <span className="text-[11px] font-medium text-slate-500">Talent Screening & Governance</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded border border-slate-200/80">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>Restricted Workspace</span>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          
          {/* Header Title & Subtitle */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex p-2.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 mb-1">
              <MihoraLogo className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'signin' && 'Sign in to Mihora'}
              {mode === 'signup' && 'Create Your Account'}
              {mode === 'forgot' && 'Reset Your Password'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              {mode === 'signin' && 'Authorized talent screening, candidate verification, and evidence intelligence.'}
              {mode === 'signup' && 'Register with Google or your corporate email to access screening evaluations.'}
              {mode === 'forgot' && "Enter your registered email and we'll send you a password reset link."}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Authentication Note:</span>
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{successMessage}</span>
            </div>
          )}

          {/* Google Sign-In Button (shown on signin and signup modes) */}
          {mode !== 'forgot' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleSubmitting || isSubmitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm border border-slate-300 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 disabled:opacity-60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
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
                )}
                <span>
                  {isGoogleSubmitting 
                    ? 'Connecting to Google...' 
                    : mode === 'signup' 
                    ? 'Sign up with Google' 
                    : 'Continue with Google'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto hidden sm:inline" />
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  or continue with email
                </span>
              </div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Display Name Field (Signup only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Full Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    autoComplete="name"
                    disabled={isSubmitting}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-colors"
                />
              </div>
            </div>

            {/* Password Field (for signin and signup) */}
            {mode !== 'forgot' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot')}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password Field (signup only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    disabled={isSubmitting}
                    className={`w-full pl-9 pr-10 py-2 bg-slate-50 border rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-colors ${
                      confirmPassword && password !== confirmPassword 
                        ? 'border-rose-300 focus:ring-rose-500' 
                        : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[11px] text-rose-600 font-medium">Passwords do not match.</p>
                )}
              </div>
            )}

            {/* Governance notice for sign-up */}
            {mode === 'signup' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Access & Governance Policy</span>
                </div>
                <p className="leading-relaxed">
                  New accounts default to Public User mode with Pending status. Access to private company job requisitions and candidate dossiers requires Master Admin review.
                </p>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-xs hover:shadow-md transition-all duration-150 disabled:opacity-60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {mode === 'signin' && 'Signing in...'}
                    {mode === 'signup' && 'Creating Account...'}
                    {mode === 'forgot' && 'Sending Reset Link...'}
                  </span>
                </>
              ) : (
                <>
                  {mode === 'signin' && <span>Sign In</span>}
                  {mode === 'signup' && <span>Create Account</span>}
                  {mode === 'forgot' && <span>Send Password Reset Link</span>}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Mode Switchers */}
          <div className="pt-3 border-t border-slate-100 text-center space-y-2">
            {mode === 'signin' && (
              <p className="text-xs text-slate-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p className="text-xs text-slate-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p className="text-xs text-slate-600">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            )}

            <div className="text-[11px] text-slate-400">
              Primary Master Admin: <span className="font-mono text-slate-500">placework908@gmail.com</span>
            </div>
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
