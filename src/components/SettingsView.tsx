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
  User as UserIcon
} from 'lucide-react';
import { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

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
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-800 block">
                Recruiter Authentication
              </span>
              <p className="text-xs text-slate-500">
                {currentUser
                  ? `Signed in as ${currentUser.email || currentUser.displayName}`
                  : 'Sign in with your Google account to automatically persist candidate analyses to Firestore.'}
              </p>
            </div>

            {currentUser ? (
              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors self-start sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors self-start sm:self-auto shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In with Google</span>
              </button>
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
