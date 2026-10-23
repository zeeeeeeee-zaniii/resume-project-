import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sliders, 
  Save, 
  Check, 
  Building,
  Database,
  Cloud,
  CheckCircle2,
  LogIn,
  LogOut,
  User as UserIcon,
  Key,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  linkPasswordToCurrentUser, 
  linkGoogleToCurrentUser, 
  resendVerificationEmail, 
  getAuthErrorMessage 
} from '../lib/firebase';

interface SettingsViewProps {
  currentUser?: User | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  strictDomainEnforcement?: boolean;
  onToggleStrictDomain?: (enabled: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onSignIn,
  onSignOut,
  strictDomainEnforcement = false,
  onToggleStrictDomain,
}) => {
  const [strictMatching, setStrictMatching] = useState(true);
  const [anonymizePII, setAnonymizePII] = useState(true);
  const [generateQuestions, setGenerateQuestions] = useState(true);
  const [citationFormat, setCitationFormat] = useState<'verbatim' | 'summarized'>('verbatim');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Account credential linking state
  const [showLinkPasswordForm, setShowLinkPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLinkingPassword, setIsLinkingPassword] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  // Email verification resend state
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);

    if (newPassword.length < 6) {
      setLinkError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLinkError('Passwords do not match.');
      return;
    }

    setIsLinkingPassword(true);
    try {
      await linkPasswordToCurrentUser(newPassword);
      setLinkSuccess(
        'Password successfully linked to your account! You can now sign in using either Google or your email and password.'
      );
      setNewPassword('');
      setConfirmPassword('');
      setShowLinkPasswordForm(false);
    } catch (err: any) {
      console.error('Password linking error:', err);
      setLinkError(getAuthErrorMessage(err));
    } finally {
      setIsLinkingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentUser) return;
    setIsResendingVerify(true);
    setVerifyStatus(null);
    try {
      await resendVerificationEmail(currentUser);
      setVerifyStatus('Verification email sent! Please check your inbox.');
    } catch (err: any) {
      console.error('Resend verification failed:', err);
      setVerifyStatus(getAuthErrorMessage(err));
    } finally {
      setIsResendingVerify(false);
    }
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-slate-200/90 pb-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Screening Parameters & Cloud Governance
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Screening Settings & Firebase Storage
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure evidence matching sensitivity, candidate privacy guidelines, and persistent cloud storage for Mihora Tech recruiting teams.
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Firebase Cloud Database Status */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Cloud Firestore Persistence
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Connected</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <span className="font-semibold text-slate-700 block">Firebase Project ID</span>
              <span className="font-mono text-slate-600 break-all">{firebaseConfig.projectId}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <span className="font-semibold text-slate-700 block">Cloud Region</span>
              <span className="font-mono text-slate-600">europe-west2</span>
            </div>

            <div className="sm:col-span-2 p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <span className="font-semibold text-slate-700 block">Firestore Database ID</span>
              <span className="font-mono text-slate-600 break-all">{firebaseConfig.firestoreDatabaseId}</span>
            </div>
          </div>

          {/* Authentication State */}
          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-800 block">
                  Authentication & Account Credentials
                </span>
                <p className="text-xs text-slate-500">
                  {currentUser
                    ? `Signed in as ${currentUser.email || currentUser.displayName || 'Authenticated User'}`
                    : 'Sign in to access candidate analyses and sync screening records.'}
                </p>

                {currentUser && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {/* Providers */}
                    {currentUser.providerData?.some((p) => p.providerId === 'google.com') && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <svg className="w-3 h-3" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Google Linked</span>
                      </span>
                    )}

                    {currentUser.providerData?.some((p) => p.providerId === 'password') && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Key className="w-3 h-3 text-blue-600" />
                        <span>Password Configured</span>
                      </span>
                    )}

                    {/* Email Verification Status */}
                    {currentUser.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Email Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Email Unverified</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {currentUser ? (
                <button
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={onSignIn}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors self-start sm:self-auto shadow-2xs cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            {/* Email Verification & Credential Linking Options */}
            {currentUser && (
              <div className="space-y-3 pt-2">
                {/* Resend Verification Email row if unverified */}
                {!currentUser.emailVerified && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Your email has not been verified. Check your inbox for the verification link.</span>
                    </div>
                    <button
                      onClick={handleResendVerification}
                      disabled={isResendingVerify}
                      className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isResendingVerify ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                  </div>
                )}

                {verifyStatus && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    {verifyStatus}
                  </div>
                )}

                {linkSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{linkSuccess}</span>
                  </div>
                )}

                {linkError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{linkError}</span>
                  </div>
                )}

                {/* Option to Add Password if user is Google-only */}
                {!currentUser.providerData?.some((p) => p.providerId === 'password') && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-800 block">
                          Add Password to your Account
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Create a password so you can sign in using either Google or email and password.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLinkPasswordForm(!showLinkPasswordForm);
                          setLinkError(null);
                          setLinkSuccess(null);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                      >
                        {showLinkPasswordForm ? 'Cancel' : 'Set Password'}
                      </button>
                    </div>

                    {showLinkPasswordForm && (
                      <form onSubmit={handleLinkPassword} className="space-y-3 pt-2 border-t border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 block">
                              New Password
                            </label>
                            <div className="relative">
                              <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                required
                                disabled={isLinkingPassword}
                                className="w-full pr-8 pl-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 block">
                              Confirm Password
                            </label>
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              required
                              disabled={isLinkingPassword}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isLinkingPassword}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isLinkingPassword && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>Link Password</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Corporate Domain & Identity Governance */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Mihora Tech Identity & Access Control
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Restricted Tenant</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <span className="font-semibold text-slate-700 block">Authorized Corporate Domains</span>
              <span className="font-mono text-slate-800">@mihora.tech · @mihora.com</span>
              <p className="text-[11px] text-slate-500 pt-0.5">
                Personnel authenticating with corporate Google Workspace accounts receive authenticated access to requisitions and screening workflows.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 pt-2">
              <div className="space-y-0.5">
                <label htmlFor="domain-strict-toggle" className="text-sm font-semibold text-slate-800 block cursor-pointer">
                  Enforce Strict Corporate Domain Restriction
                </label>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  When enabled, non-corporate accounts without explicit allowlist clearance are immediately prevented from accessing candidate records and requisition data.
                </p>
              </div>
              <input
                id="domain-strict-toggle"
                type="checkbox"
                checked={strictDomainEnforcement}
                onChange={(e) => onToggleStrictDomain?.(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Screening Sensitivity */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Evidence Sensitivity & Alignment Rules
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <label htmlFor="strict-match-toggle" className="text-sm font-semibold text-slate-800 block cursor-pointer">
                  Strict Verbatim Evidence Requirement
                </label>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Require verifiable textual evidence directly from the resume before marking a qualification as "Detected in Resume". Prevents synthetic inference of competencies.
                </p>
              </div>
              <input
                id="strict-match-toggle"
                type="checkbox"
                checked={strictMatching}
                onChange={(e) => setStrictMatching(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 mt-1 cursor-pointer"
              />
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <label htmlFor="questions-toggle" className="text-sm font-semibold text-slate-800 block cursor-pointer">
                  Generate Interview Inquiry Prompts for Unstated Qualifications
                </label>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Automatically construct targeted recruiter clarification questions when essential role qualifications are not detected in the resume text.
                </p>
              </div>
              <input
                id="questions-toggle"
                type="checkbox"
                checked={generateQuestions}
                onChange={(e) => setGenerateQuestions(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Candidate Privacy & PII */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Privacy & Candidate Confidentiality
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <label htmlFor="anonymize-pii-toggle" className="text-sm font-semibold text-slate-800 block cursor-pointer">
                  Blind Screening & Contact PII Masking
                </label>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Mask personal phone numbers, physical residential addresses, and non-essential demographic identifiers during initial qualification screening to reduce unconscious bias.
                </p>
              </div>
              <input
                id="anonymize-pii-toggle"
                type="checkbox"
                checked={anonymizePII}
                onChange={(e) => setAnonymizePII(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 mt-1 cursor-pointer"
              />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="text-sm font-semibold text-slate-800 block mb-1">
                Evidence Citation Format
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="citation"
                    checked={citationFormat === 'verbatim'}
                    onChange={() => setCitationFormat('verbatim')}
                    className="text-blue-600"
                  />
                  <span>Verbatim sentence excerpts (Recommended)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="citation"
                    checked={citationFormat === 'summarized'}
                    onChange={() => setCitationFormat('summarized')}
                    className="text-blue-600"
                  />
                  <span>Paraphrased competency summary</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Mihora Tech Integration Foundation */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 uppercase tracking-wider">
            <Building className="w-3.5 h-3.5 text-blue-700" />
            <span>Mihora Tech Organizational Integration</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            This deployment is configured for Mihora Tech Talent Operations with Firebase Firestore cloud storage in region europe-west2.
          </p>
        </div>

        {/* Save Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedSuccess && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Preferences updated successfully</span>
            </span>
          )}

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
