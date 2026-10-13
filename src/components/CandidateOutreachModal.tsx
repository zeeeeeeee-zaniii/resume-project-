import React, { useState, useEffect } from 'react';
import {
  Mail,
  X,
  Copy,
  Check,
  ExternalLink,
  Save,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Calendar,
  Send,
  RotateCcw,
  User,
  Briefcase,
  CheckCircle2,
  FileText,
  History,
  Info,
  Loader2
} from 'lucide-react';
import {
  AnalysisResult,
  CandidateRecord,
  Job,
  OutreachTemplateType,
  CandidateOutreachLog,
  CandidateInterview
} from '../types';
import {
  generateOutreachDraft,
  buildMailtoUrl,
  OutreachEmailDraft
} from '../lib/outreach-templates';

interface CandidateOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateAnalysis: AnalysisResult | null;
  candidateRecord?: CandidateRecord | null;
  jobs?: Job[];
  currentUserEmail?: string;
  currentUserName?: string;
  onSaveOutreachLog?: (candidateIdOrAnalysisId: string, log: CandidateOutreachLog) => Promise<void>;
  initialTemplateType?: OutreachTemplateType;
}

export const CandidateOutreachModal: React.FC<CandidateOutreachModalProps> = ({
  isOpen,
  onClose,
  candidateAnalysis,
  candidateRecord,
  jobs = [],
  currentUserEmail = '',
  currentUserName = '',
  onSaveOutreachLog,
  initialTemplateType = 'interview_invitation',
}) => {
  // Resolve matching job safely
  const matchingJob = candidateAnalysis
    ? jobs.find((j) => j.id === candidateAnalysis.jobId || j.id === candidateRecord?.jobId) || null
    : null;

  // Active view tab: 'composer' or 'history'
  const [activeTab, setActiveTab] = useState<'composer' | 'history'>('composer');

  // Selected template type
  const [selectedTemplate, setSelectedTemplate] = useState<OutreachTemplateType>(initialTemplateType);

  // Form parameters
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState(
    currentUserName || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Talent Acquisition')
  );
  const [senderEmail, setSenderEmail] = useState(currentUserEmail || 'recruiting@mihora.tech');
  const [proposedWindows, setProposedWindows] = useState('');
  const [selectedInterviewId, setSelectedInterviewId] = useState<string>('none');
  const [outreachNotes, setOutreachNotes] = useState('');

  // Editable Subject & Body
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBody, setEditableBody] = useState('');

  // State feedback
  const [copiedSection, setCopiedSection] = useState<'subject' | 'body' | 'full' | null>(null);
  const [isLoggingOutreach, setIsLoggingOutreach] = useState(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);
  const [logErrorMessage, setLogErrorMessage] = useState<string | null>(null);

  // Available interviews
  const interviews: CandidateInterview[] = candidateRecord?.interviews || [];

  // Selected interview object
  const selectedInterview =
    selectedInterviewId !== 'none'
      ? interviews.find((i) => i.id === selectedInterviewId) || null
      : interviews.find((i) => i.status === 'Scheduled') || null;

  // Regenerate draft content whenever template type or key options change
  const refreshDraft = (templateTypeToUse: OutreachTemplateType) => {
    if (!candidateAnalysis) return;
    const draft: OutreachEmailDraft = generateOutreachDraft(
      templateTypeToUse,
      candidateAnalysis,
      candidateRecord,
      matchingJob,
      {
        recipientEmail,
        senderName,
        senderEmail,
        companyName: 'Mihora Tech',
        proposedDateTimes: proposedWindows,
        selectedInterview,
      }
    );

    setEditableSubject(draft.subject);
    setEditableBody(draft.body);
  };

  // Initialize draft when modal opens or template changes
  useEffect(() => {
    if (candidateAnalysis && isOpen) {
      refreshDraft(selectedTemplate);
    }
    setLogSuccessMessage(null);
    setLogErrorMessage(null);
  }, [selectedTemplate, selectedInterviewId, candidateAnalysis?.id, isOpen]);

  const candidateDisplayName =
    candidateRecord?.name ||
    candidateAnalysis?.candidateOverview?.detectedName ||
    candidateAnalysis?.fileName?.replace(/\.(pdf|docx)$/i, '') ||
    'Candidate';

  const jobTitle = matchingJob?.title || candidateAnalysis?.roleSummary?.jobTitle || 'Role';

  // Copy helper
  const handleCopy = (text: string, type: 'subject' | 'body' | 'full') => {
    navigator.clipboard.writeText(text);
    setCopiedSection(type);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const handleCopyFull = () => {
    const fullText = `To: ${recipientEmail || '[Candidate Email]'}\nSubject: ${editableSubject}\n\n${editableBody}`;
    handleCopy(fullText, 'full');
  };

  // Open in Mail Client
  const handleOpenMailClient = () => {
    const mailto = buildMailtoUrl(recipientEmail, editableSubject, editableBody);
    window.location.href = mailto;
  };

  // Local outreach history state to reflect new logs immediately
  const [localOutreachLogs, setLocalOutreachLogs] = useState<CandidateOutreachLog[]>(
    () => candidateRecord?.outreachLogs || []
  );

  useEffect(() => {
    setLocalOutreachLogs(candidateRecord?.outreachLogs || []);
    setLogSuccessMessage(null);
    setLogErrorMessage(null);
  }, [candidateRecord?.id, candidateRecord?.outreachLogs, candidateAnalysis?.id, isOpen]);

  // Log outreach to candidate record in Firestore
  const handleLogOutreach = async () => {
    if (!onSaveOutreachLog || isLoggingOutreach) return;
    setIsLoggingOutreach(true);
    setLogErrorMessage(null);
    setLogSuccessMessage(null);

    const cleanEmail = recipientEmail.trim();
    const cleanNotes = outreachNotes.trim();
    const logEntry: CandidateOutreachLog = {
      id: `outreach-${Date.now()}`,
      templateType: selectedTemplate,
      subject: editableSubject.trim() || 'Outreach Communication',
      sentAt: new Date().toISOString(),
      senderName: senderName.trim() || 'Recruiter',
      ...(cleanEmail ? { recipientEmail: cleanEmail } : {}),
      ...(cleanNotes ? { notes: cleanNotes } : {}),
    };

    if (!candidateAnalysis) return;

    try {
      const targetId = candidateRecord?.id || candidateAnalysis.candidateId || candidateAnalysis.id;
      await onSaveOutreachLog(targetId, logEntry);
      setLocalOutreachLogs((prev) => [logEntry, ...prev]);
      setLogSuccessMessage('Outreach logged successfully to candidate profile!');
      setOutreachNotes('');
      setTimeout(() => setLogSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to log candidate outreach:', err);
      let errorMsg = 'Failed to save outreach log to Firestore. Please check your connection.';
      if (err instanceof Error && err.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error) {
            errorMsg = `Failed to save outreach: ${parsed.error}`;
          }
        } catch {
          errorMsg = `Failed to save outreach: ${err.message}`;
        }
      }
      setLogErrorMessage(errorMsg);
    } finally {
      setIsLoggingOutreach(false);
    }
  };

  // Grounded data points for audit / transparency banner
  const keySkills = candidateAnalysis?.candidateOverview?.keySkillsDetected || [];
  const detectedReqs = (candidateAnalysis?.requirementMatches || [])
    .filter((r) => r.status === 'Detected')
    .map((r) => r.requirement);
  const groundedSkills = Array.from(new Set([...keySkills, ...detectedReqs])).slice(0, 4);

  const unevidencedReqs = (candidateAnalysis?.requirementMatches || [])
    .filter((r) => r.status === 'Not detected in resume' || r.status === 'Partially detected')
    .map((r) => r.requirement);
  const potentialGaps = candidateAnalysis?.potentialGaps || [];
  const groundedGaps = Array.from(new Set([...unevidencedReqs, ...potentialGaps])).slice(0, 3);

  // Existing outreach logs from local state
  const outreachLogs = localOutreachLogs;

  if (!isOpen || !candidateAnalysis) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-linear-to-r from-slate-50 to-blue-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Candidate Email Outreach
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {candidateDisplayName}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>{jobTitle}</span>
                <span>·</span>
                <span>Mihora Tech</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher: Composer vs History */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('composer')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-all ${
                  activeTab === 'composer'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Composer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-all flex items-center gap-1 ${
                  activeTab === 'history'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({outreachLogs.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close outreach composer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'composer' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Template Selector Pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Outreach Purpose:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate('interview_invitation')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedTemplate === 'interview_invitation'
                      ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600 text-purple-900'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Interview Invitation</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Invite to next round or log slot
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTemplate('clarification_request')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedTemplate === 'clarification_request'
                      ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-600 text-amber-900'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Clarification Request</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Inquire on missing resume evidence
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTemplate('rejection')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedTemplate === 'rejection'
                      ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-600 text-rose-900'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Respectful Rejection</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Professional, appreciative closure
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTemplate('screening_followup')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedTemplate === 'screening_followup'
                      ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 text-blue-900'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Screening Follow-up</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Update on hiring manager queue
                  </span>
                </button>
              </div>
            </div>

            {/* Grounding Transparency Banner */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Evidence Grounding Context</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Grounded in Resume Analysis
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="font-semibold text-slate-600">Detected Strengths Used:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {groundedSkills.length > 0 ? (
                      groundedSkills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px]"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No specific skill highlights</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-600">Unevidenced Gaps Identified:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {groundedGaps.length > 0 ? (
                      groundedGaps.map((g, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] truncate max-w-[240px]"
                          title={g}
                        >
                          {g}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">All key criteria evidenced</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient & Configuration Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Candidate Email:
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Sender (Recruiter):
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Sender Corporate Email:
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="recruiter@mihora.tech"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 text-xs"
                />
              </div>
            </div>

            {/* Interview Template Specific Fields */}
            {selectedTemplate === 'interview_invitation' && (
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/70 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span>Interview Scheduling Grounding</span>
                  </span>
                  {interviews.length > 0 && (
                    <span className="text-[10px] text-purple-700 font-mono">
                      {interviews.length} rounds logged for candidate
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-purple-900 block mb-1">
                      Link Scheduled Round:
                    </label>
                    <select
                      value={selectedInterviewId}
                      onChange={(e) => setSelectedInterviewId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="none">
                        No specific round (Propose new availability)
                      </option>
                      {interviews.map((iv) => (
                        <option key={iv.id} value={iv.id}>
                          {iv.interviewType} - {new Date(iv.scheduledAt).toLocaleDateString()} ({iv.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedInterviewId === 'none' && (
                    <div>
                      <label className="font-medium text-purple-900 block mb-1">
                        Proposed Times / Windows:
                      </label>
                      <input
                        type="text"
                        value={proposedWindows}
                        onChange={(e) => setProposedWindows(e.target.value)}
                        placeholder="e.g. Wednesday 2-4 PM EST, Friday 10 AM-12 PM EST"
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Subject Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Subject Line:
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(editableSubject, 'subject')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                >
                  {copiedSection === 'subject' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied Subject</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Subject</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={editableSubject}
                onChange={(e) => setEditableSubject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 text-xs font-semibold text-slate-900"
              />
            </div>

            {/* Email Body Composer */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    Email Body Draft:
                  </label>
                  <span className="text-[10px] text-slate-400">
                    (Recruiter-reviewed, edit freely before copying or sending)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => refreshDraft(selectedTemplate)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"
                    title="Reset to generated default draft"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(editableBody, 'body')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    {copiedSection === 'body' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied Body</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Body</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={editableBody}
                onChange={(e) => setEditableBody(e.target.value)}
                rows={12}
                className="w-full px-3.5 py-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-blue-600 text-xs text-slate-800 font-sans leading-relaxed resize-y"
              />
            </div>

            {/* Optional Recruiter Notes for Log */}
            {onSaveOutreachLog && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={outreachNotes}
                    onChange={(e) => setOutreachNotes(e.target.value)}
                    placeholder="Optional note for candidate pipeline history (e.g. Sent invite for Round 1 via email)..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Success and Error Feedback */}
            {logSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{logSuccessMessage}</span>
              </div>
            )}

            {logErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{logErrorMessage}</span>
              </div>
            )}
          </div>
        ) : (
          /* Outreach History Tab */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Outreach Communication Trail
                </h3>
                <p className="text-xs text-slate-500">
                  Logged outreach attempts and emails drafted for {candidateDisplayName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('composer')}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                + New Outreach Draft
              </button>
            </div>

            {outreachLogs.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2 bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <History className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No outreach logged yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When you draft and send emails to this candidate, click "Log Outreach" to maintain a permanent record for your hiring team.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {outreachLogs.map((log) => {
                  const date = new Date(log.sentAt);
                  const formattedDate = isNaN(date.getTime())
                    ? log.sentAt
                    : date.toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      });

                  const badgeClass =
                    log.templateType === 'interview_invitation'
                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                      : log.templateType === 'clarification_request'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : log.templateType === 'rejection'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200';

                  const typeLabel =
                    log.templateType === 'interview_invitation'
                      ? 'Interview Invitation'
                      : log.templateType === 'clarification_request'
                      ? 'Clarification Request'
                      : log.templateType === 'rejection'
                      ? 'Respectful Rejection'
                      : 'Screening Follow-up';

                  return (
                    <div
                      key={log.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}
                          >
                            {typeLabel}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {log.subject}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {formattedDate}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center justify-between">
                        <span>
                          By <strong className="text-slate-800">{log.senderName}</strong>
                          {log.recipientEmail ? ` to ${log.recipientEmail}` : ''}
                        </span>
                      </div>

                      {log.notes && (
                        <div className="text-xs bg-slate-50 p-2 rounded border border-slate-200 text-slate-700">
                          <span className="font-semibold text-slate-800">Note:</span> {log.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyFull}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              {copiedSection === 'full' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied Email</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Entire Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenMailClient}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Open default email application with pre-filled message"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Mail App</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onSaveOutreachLog && (
              <button
                type="button"
                onClick={handleLogOutreach}
                disabled={isLoggingOutreach}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isLoggingOutreach ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Log Outreach to Candidate</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
