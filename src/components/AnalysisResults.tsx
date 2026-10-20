import React, { useState } from 'react';
import { 
  CheckCircle2, 
  HelpCircle, 
  ArrowLeft, 
  FileText, 
  Briefcase, 
  Building2, 
  Printer, 
  Plus, 
  AlertCircle,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  User,
  Clock,
  Wrench,
  Edit3,
  MapPin,
  RefreshCw,
  Trash2,
  ChevronLeft,
  Download,
  ExternalLink,
  Mail,
  Calendar,
  CalendarDays,
  Video
} from 'lucide-react';
import { AnalysisResult, MatchStatus, CandidateRecord, Job, CandidateOutreachLog, CandidateInterview } from '../types';
import { CandidateOutreachModal } from './CandidateOutreachModal';
import { CandidateInterviewModal, getInterviewStatusBadgeStyle } from './CandidateInterviewModal';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { downloadPrintableReport } from '../lib/report-export';
import { generateCandidatePdfReport } from '../lib/pdf-report-generator';

interface AnalysisResultsProps {
  result: AnalysisResult;
  candidateRecord?: CandidateRecord | null;
  jobs?: Job[];
  currentUserEmail?: string;
  currentUserName?: string;
  onSaveOutreachLog?: (candidateIdOrAnalysisId: string, log: CandidateOutreachLog) => Promise<void>;
  onUpdateCandidateInterviews?: (candidateIdOrAnalysisId: string, interviews: CandidateInterview[]) => Promise<void>;
  onUpdateCandidateStatus?: (candidateIdOrAnalysisId: string, status: any) => Promise<void>;
  onModifyInputs: () => void;
  onStartNewAnalysis: () => void;
  onReanalyze?: (result: AnalysisResult) => void;
  onDeleteAnalysis?: (analysisId: string) => Promise<void>;
  onBackToJob?: (jobId: string) => void;
  onBackToCandidates?: () => void;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({
  result,
  candidateRecord,
  jobs = [],
  currentUserEmail,
  currentUserName,
  onSaveOutreachLog,
  onUpdateCandidateInterviews,
  onUpdateCandidateStatus,
  onModifyInputs,
  onStartNewAnalysis,
  onReanalyze,
  onDeleteAnalysis,
  onBackToJob,
  onBackToCandidates,
}) => {
  const [filterState, setFilterState] = useState<'all' | MatchStatus>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [isPrintableView, setIsPrintableView] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);

  // Reliable detection of sandboxed AI Studio preview iframe:
  // Must be embedded inside an iframe (window.self !== window.top) AND running on an AI Studio preview/dev domain or applet frame.
  const isAiStudioPreviewSandbox = typeof window !== 'undefined' && (() => {
    try {
      const isEmbedded = window.self !== window.top;
      if (!isEmbedded) return false;
      const hostname = window.location.hostname || '';
      return (
        hostname.includes('ais-dev-') ||
        hostname.includes('ais-pre-') ||
        hostname.includes('run.app') ||
        hostname.includes('aistudio') ||
        hostname.includes('googleusercontent.com')
      );
    } catch {
      return false;
    }
  })();

  const requirementMatches = result.requirementMatches || [];
  const strengths = result.strengths || [];
  const potentialGaps = result.potentialGaps || [];
  const interviewFocus = result.interviewFocus || [];
  const candidateOverview = result.candidateOverview || {
    detectedName: null,
    detectedLocation: null,
    currentOrRecentRole: null,
    experienceSummary: null,
    keySkillsDetected: [],
    education: [],
    certifications: [],
  };
  const roleSummary = result.roleSummary || {
    jobTitle: 'Role Requirements',
    department: 'General',
    extractedSummary: '',
  };
  const overallRoleAlignment = result.overallRoleAlignment || {
    level: 'Moderate alignment',
    summary: '',
  };

  const filteredMatches = requirementMatches.filter((item) => {
    if (filterState === 'all') return true;
    return item.status === filterState;
  });

  const detectedCount = requirementMatches.filter((e) => e.status === 'Detected').length;
  const partiallyDetectedCount = requirementMatches.filter((e) => e.status === 'Partially detected').length;
  const notDetectedCount = requirementMatches.filter((e) => e.status === 'Not detected in resume').length;

  // Enters the user-initiated same-tab printable report view
  const handlePrint = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setPrintNotice(null);
    setIsPrintableView(true);
  };

  // Triggers structured candidate PDF download for offline review
  const handleDownloadPdf = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsGeneratingPdf(true);
    setPrintNotice(null);
    try {
      generateCandidatePdfReport(result);
      setPrintNotice({
        type: 'info',
        message: 'Candidate analysis report downloaded successfully as PDF.',
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      setPrintNotice({
        type: 'error',
        message: 'Could not generate PDF report. You can also use the HTML Export or Print preview.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Triggers self-contained standalone report file download
  const handleDownloadStandalone = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      downloadPrintableReport(result);
    } catch (err: any) {
      console.warn('Document export error:', err);
      setPrintNotice({
        type: 'error',
        message: 'Unable to trigger document download in this browser session.',
      });
    }
  };

  // Direct browser print handler with accurate sandbox detection
  const handleNativePrint = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setPrintNotice(null);

    // If verified to be running inside the AI Studio preview sandbox iframe, print modal will be suppressed by the browser
    if (isAiStudioPreviewSandbox) {
      setPrintNotice({
        type: 'info',
        message:
          "The browser blocks modal print dialogs inside this preview sandbox frame. Click 'Download Report (.html)' to print or save as PDF, or click 'Open in Standalone Tab'.",
      });
      return;
    }

    try {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    } catch (err: any) {
      console.warn('Native window.print call exception:', err);
      setPrintNotice({
        type: 'error',
        message: 'Browser printing could not be opened directly. Please use "Download Report" or "Open in Standalone Tab".',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteAnalysis) return;
    setIsDeleting(true);
    try {
      await onDeleteAnalysis(result.id);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Styling helpers for alignment badges (text-based, restrained)
  const getAlignmentColor = (level: string) => {
    switch (level) {
      case 'Strong alignment':
        return 'text-emerald-800 bg-emerald-50 border-emerald-200';
      case 'Good alignment':
        return 'text-blue-800 bg-blue-50 border-blue-200';
      case 'Moderate alignment':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'Limited evidence':
      case 'Insufficient evidence':
      default:
        return 'text-slate-800 bg-slate-100 border-slate-300';
    }
  };

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case 'Detected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>Detected</span>
          </span>
        );
      case 'Partially detected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Partially detected</span>
          </span>
        );
      case 'Not detected in resume':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Not detected in resume</span>
          </span>
        );
    }
  };

  if (isPrintableView) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20 print:max-w-none print:w-full print:p-0 print:m-0 print:space-y-4 print:pb-0">
        {/* Same-Tab Printable Route Toolbar (Screen Only) */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-sm space-y-3 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsPrintableView(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md transition-colors cursor-pointer self-start sm:self-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Analysis Workspace</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 px-3.5 py-1.5 rounded-md transition-colors shadow-2xs cursor-pointer"
                title="Download structured PDF candidate analysis report for offline review"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Report (PDF)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadStandalone}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                title="Download offline HTML screening report"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Export (.html)</span>
              </button>

              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md transition-colors"
                title="Open in a standalone browser tab where native browser printing works directly"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Open in Standalone Tab</span>
              </a>

              <button
                type="button"
                onClick={handleNativePrint}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-md transition-colors cursor-pointer"
                title="Trigger browser print dialog"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Browser Print</span>
              </button>
            </div>
          </div>

          {/* Sandbox limitation explanation ONLY if reliably running inside AI Studio preview iframe */}
          {isAiStudioPreviewSandbox && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">AI Studio Preview Sandbox Limitation</span>
                <p className="text-amber-800 leading-relaxed">
                  Modern browsers block modal print dialogs inside sandboxed preview iframes (<code className="text-amber-950 font-mono text-[11px] bg-amber-100/70 px-1 py-0.5 rounded">allow-modals</code> is not set by the parent frame).
                  To print or save as PDF, click <strong>Download Report</strong> to print offline, or click <strong>Open in Standalone Tab</strong> to use your browser's native print dialog.
                </p>
              </div>
            </div>
          )}

          {printNotice && (
            <div
              className={`border rounded-md p-3 text-xs flex items-center justify-between gap-2.5 ${
                printNotice.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <span>{printNotice.message}</span>
              <button
                type="button"
                onClick={() => setPrintNotice(null)}
                className={`font-semibold px-2 py-0.5 rounded cursor-pointer shrink-0 ${
                  printNotice.type === 'error'
                    ? 'text-rose-700 hover:bg-rose-100'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Printable Paper Document Container */}
        <div className="bg-white border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0 print:m-0 print:space-y-3.5">
          {/* Formal Print Header */}
          <div className="border-b-2 border-slate-950 pb-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 font-serif">
                  MIHORA RESUME INTELLIGENCE
                </div>
                <div className="text-xs text-slate-600 font-mono tracking-wide mt-0.5">
                  CANDIDATE REQUISITION SCREENING REPORT
                </div>
              </div>
              <div className="text-right text-xs text-slate-600 font-mono space-y-0.5">
                <div>Generated: {result.analyzedAt}</div>
                <div>Source Document: {result.fileName}</div>
              </div>
            </div>
          </div>

          {/* Section 1 & 2: Candidate Overview and Role Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-200 rounded-lg p-4 bg-white print:border-slate-300 print:p-3.5 print:gap-3.5 print-avoid-break">
            <div className="space-y-2">
              <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                1. Candidate Overview
              </div>
              <div className="text-lg font-bold text-slate-900 leading-snug">
                {candidateOverview.detectedName || (
                  <span className="text-slate-500 italic font-normal text-sm">
                    Candidate Name Not Explicitly Stated
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-[13px] text-slate-700">
                <span className="font-semibold text-slate-600">Location: </span>
                {candidateOverview.detectedLocation ? (
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                    {candidateOverview.detectedLocation}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Not detected in resume</span>
                )}
              </div>
              <div className="text-xs sm:text-[13px] text-slate-700">
                <span className="font-semibold text-slate-600">Recent Role: </span>
                <span>{candidateOverview.currentOrRecentRole || 'Not clearly specified'}</span>
              </div>
              <div className="text-xs sm:text-[13px] text-slate-700">
                <span className="font-semibold text-slate-600">Experience Summary: </span>
                <span>{candidateOverview.experienceSummary || 'Not determinable from explicit dates'}</span>
              </div>

              {candidateOverview.keySkillsDetected && candidateOverview.keySkillsDetected.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-slate-700 mb-1">
                    Key Skills Explicitly Detected:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {candidateOverview.keySkillsDetected.map((sk, idx) => (
                      <span key={idx} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-800">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {candidateOverview.education && candidateOverview.education.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-slate-700 mb-0.5">Education:</div>
                  <ul className="text-xs sm:text-[13px] text-slate-600 list-disc list-inside space-y-0.5">
                    {candidateOverview.education.map((ed, idx) => (
                      <li key={idx}>{ed}</li>
                    ))}
                  </ul>
                </div>
              )}

              {candidateOverview.certifications && candidateOverview.certifications.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-slate-700 mb-0.5">Certifications:</div>
                  <ul className="text-xs sm:text-[13px] text-slate-600 list-disc list-inside space-y-0.5">
                    {candidateOverview.certifications.map((ct, idx) => (
                      <li key={idx}>{ct}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2 md:border-l border-slate-200 md:pl-4 pt-3 md:pt-0">
              <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                2. Role Summary
              </div>
              <div className="text-base font-bold text-slate-900 leading-snug">
                {roleSummary.jobTitle}
              </div>
              <div className="text-xs sm:text-[13px] text-slate-700">
                <span className="font-semibold text-slate-600">Department / Team: </span>
                <span>{roleSummary.department || 'General'}</span>
              </div>
              <div className="text-xs sm:text-[13px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-1 text-xs">
                  Role Requirements Summary:
                </span>
                <p>{roleSummary.extractedSummary}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Overall Role Alignment */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-300 print:p-3 print-avoid-break">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              3. Overall Role Alignment
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div className={`px-3 py-1 rounded font-bold text-xs whitespace-nowrap ${getAlignmentColor(overallRoleAlignment.level)}`}>
                {overallRoleAlignment.level}
              </div>
              <div className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                {overallRoleAlignment.summary}
              </div>
            </div>
          </div>

          {/* Section 4: Requirement Match Analysis */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-300 print:p-3 print-avoid-break">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2">
              4. Requirement Match Analysis
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs sm:text-[13px] border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3 w-[30%] align-bottom">Role Requirement</th>
                    <th className="py-2.5 px-3 w-[22%] align-bottom">Status</th>
                    <th className="py-2.5 px-3 w-[48%] align-bottom">Resume Evidence Citation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requirementMatches.map((item, index) => (
                    <tr key={index} className="print:break-inside-avoid">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 align-top break-words">
                        {item.requirement}
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-normal">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-relaxed align-top break-words">
                        {item.resumeEvidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5 & 6: Strengths & Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-3.5 print-avoid-break">
            <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-300 print:p-3.5 space-y-2">
              <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                5. Relevant Strengths
              </div>
              <p className="text-xs text-slate-500">Supported by explicit resume evidence</p>
              {strengths.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No explicit strengths verified.</p>
              ) : (
                <ul className="space-y-1.5 text-xs sm:text-[13px] text-slate-700 pt-0.5">
                  {strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-300 print:p-3.5 space-y-2">
              <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                6. Potential Gaps / Areas to Clarify
              </div>
              <p className="text-xs text-slate-500">Unverified or ambiguous criteria in document text</p>
              {potentialGaps.length === 0 ? (
                <p className="text-xs text-slate-400 italic">All essential criteria have supporting evidence.</p>
              ) : (
                <ul className="space-y-1.5 text-xs sm:text-[13px] text-slate-700 pt-0.5">
                  {potentialGaps.map((gap, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Section 7: Interview Focus */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-300 print:p-3.5 space-y-2.5 print-avoid-break">
            <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              7. Interview Focus
            </div>
            <p className="text-xs text-slate-500">
              Questions formulated to explore unverified or ambiguous requirements:
            </p>
            <div className="space-y-2">
              {interviewFocus.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 print:break-inside-avoid">
                  <span className="font-mono text-slate-500 font-semibold shrink-0">Q{idx + 1}.</span>
                  <span className="leading-relaxed">{q}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 8: Disclaimer */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-0.5 print:break-inside-avoid">
            <span className="font-semibold text-slate-800 block text-xs">
              8. Analysis Notes & Hiring Governance
            </span>
            <p className="leading-relaxed">
              Analysis is based strictly on explicit textual evidence provided in the candidate resume and job criteria. "Not detected in resume" indicates absence of evidence in the document, not absence of capability. Final hiring decisions remain exclusively with human recruitment teams.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 print:max-w-none print:w-full print:p-0 print:m-0 print:space-y-4 print:pb-0">
      {/* Dedicated Print-Only Formal Report Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-950 font-serif">
              MIHORA RESUME INTELLIGENCE
            </div>
            <div className="text-xs text-slate-600 font-mono tracking-wide mt-0.5">
              CANDIDATE REQUISITION SCREENING REPORT
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono space-y-0.5">
            <div>Generated: {result.analyzedAt}</div>
            <div>File: {result.fileName}</div>
          </div>
        </div>
      </div>

      {/* Top Action & Navigation Bar (Screen Only) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-4 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          {onBackToCandidates && (
            <button
              type="button"
              onClick={onBackToCandidates}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Candidates</span>
            </button>
          )}

          {result.jobId && onBackToJob && (
            <button
              type="button"
              onClick={() => onBackToJob(result.jobId!)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
              <span>Job Requisition</span>
            </button>
          )}

          <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5 pl-1">
            <span>Analysis Generated {result.analyzedAt}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onReanalyze && (
            <button
              type="button"
              onClick={() => onReanalyze(result)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
              title="Re-run analysis against this role criteria"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-analyze</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOutreachModalOpen(true)}
            title="Draft personalized, grounded candidate email outreach"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Draft Outreach</span>
            {candidateRecord?.outreachLogs && candidateRecord.outreachLogs.length > 0 && (
              <span className="text-[9px] bg-blue-200 text-blue-800 font-bold px-1 rounded-full">
                {candidateRecord.outreachLogs.length}
              </span>
            )}
          </button>

          {onUpdateCandidateInterviews && (
            <button
              type="button"
              onClick={() => setIsInterviewModalOpen(true)}
              title="Schedule and manage candidate interviews"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors shadow-2xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Interviews</span>
              {candidateRecord?.interviews && candidateRecord.interviews.length > 0 && (
                <span className="text-[9px] bg-purple-200 text-purple-800 font-bold px-1 rounded-full">
                  {candidateRecord.interviews.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('candidate-activity-timeline-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            title="Jump to Candidate Activity Timeline"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            title="Download structured PDF analysis report for offline recruiter review"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Report (PDF)'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            title="Open dedicated printable screening report in this tab"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print View</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadStandalone}
            title="Download standalone offline HTML report"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Export HTML</span>
          </button>

          {onDeleteAnalysis && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-300 rounded-md transition-colors cursor-pointer"
              title="Delete this analysis record"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={onStartNewAnalysis}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Screen Another</span>
          </button>
        </div>
      </div>

      {/* Print Notice Banner (Screen only) */}
      {printNotice && (
        <div
          className={`border rounded-lg p-3 text-xs flex items-center justify-between gap-3 print:hidden animate-in fade-in duration-150 ${
            printNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {printNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Printer className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span className="leading-relaxed">{printNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrintNotice(null)}
            className={`font-semibold px-2 py-1 rounded transition-colors cursor-pointer shrink-0 ${
              printNotice.type === 'error'
                ? 'text-rose-700 hover:bg-rose-100'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Limited Information Warning Banner if applicable */}
      {result.hasLimitedInformation && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-0.5">
            <span className="font-semibold block">Limited Document Text Detected</span>
            <p className="text-amber-800 leading-relaxed">
              The resume contains limited readable information. The analysis may be incomplete.
            </p>
          </div>
        </div>
      )}

      {/* 1. Candidate Overview & 2. Role Summary Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-6 print:border-slate-300 print:p-5 print:shadow-none print-avoid-break">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 print:border-slate-200 pb-6">
          {/* Section 1: Candidate Overview with Location Intelligence */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-700" />
              <span>1. Candidate Overview</span>
            </div>

            <div className="space-y-1.5">
              <div className="text-lg font-bold text-slate-900 tracking-tight">
                {candidateOverview.detectedName || (
                  <span className="text-slate-500 italic font-normal text-base">
                    Candidate Name Not Explicitly Stated
                  </span>
                )}
              </div>

              {/* CANDIDATE LOCATION INTELLIGENCE */}
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-700">Location:</span>
                {candidateOverview.detectedLocation ? (
                  <span className="flex items-center gap-1 font-semibold text-slate-900 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/70">
                    <MapPin className="w-3.5 h-3.5 text-blue-700" />
                    <span>{candidateOverview.detectedLocation}</span>
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Not detected in resume</span>
                )}
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-700">Recent Role:</span>
                <span>{candidateOverview.currentOrRecentRole || 'Not clearly specified'}</span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-700">Experience Summary:</span>
                <span>{candidateOverview.experienceSummary || 'Not determinable from explicit dates'}</span>
              </div>
              <div className="text-xs text-slate-500 font-mono pt-0.5">
                Source Document: {result.fileName}
              </div>
            </div>

            {/* Key Skills Explicitly Detected */}
            {candidateOverview.keySkillsDetected && candidateOverview.keySkillsDetected.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-slate-400" />
                  <span>Key Skills Explicitly Detected in Resume:</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
                  {candidateOverview.keySkillsDetected.map((skill, idx) => (
                    <span key={idx} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Education Explicitly Detected */}
            {candidateOverview.education && candidateOverview.education.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-700 mb-1">
                  <span>Education (Explicitly Stated):</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-0.5 list-disc list-inside">
                  {candidateOverview.education.map((edu, idx) => (
                    <li key={idx} className="truncate">{edu}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Certifications Explicitly Detected */}
            {candidateOverview.certifications && candidateOverview.certifications.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-700 mb-1">
                  <span>Certifications (Explicitly Stated):</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-0.5 list-disc list-inside">
                  {candidateOverview.certifications.map((cert, idx) => (
                    <li key={idx} className="truncate">{cert}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Section 2: Role Summary */}
          <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-700" />
              <span>2. Role Summary</span>
            </div>

            <div className="space-y-1">
              <div className="text-base font-bold text-slate-900">
                {roleSummary.jobTitle}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-700">Department / Team:</span>
                <span>{roleSummary.department || 'General'}</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
              <span className="font-semibold text-slate-700 block mb-1">
                Role Requirements Summary:
              </span>
              <p>{roleSummary.extractedSummary}</p>
            </div>
          </div>
        </div>

        {/* Section 7: Overall Role Alignment */}
        <div className="space-y-3">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            <span>7. Overall Role Alignment</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div
              className={`px-3.5 py-1.5 rounded-md border font-semibold text-sm whitespace-nowrap self-start sm:self-auto ${getAlignmentColor(
                overallRoleAlignment.level
              )}`}
            >
              {overallRoleAlignment.level}
            </div>

            <div className="text-xs text-slate-700 leading-relaxed flex-1">
              {overallRoleAlignment.summary}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Requirement Match Table */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-4 print:border-slate-300 print:p-5 print:shadow-none print-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 print:border-slate-200 pb-3">
          <div>
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              3. Requirement Match
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Evidence-Based Requirement Analysis
            </h3>
          </div>

          {/* Status filter tabs (Screen only) */}
          <div className="flex items-center gap-1.5 text-xs print:hidden">
            <button
              type="button"
              onClick={() => setFilterState('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterState === 'all'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({requirementMatches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('Detected')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterState === 'Detected'
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Detected ({detectedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('Partially detected')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterState === 'Partially detected'
                  ? 'bg-amber-700 text-white font-semibold'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Partial ({partiallyDetectedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('Not detected in resume')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterState === 'Not detected in resume'
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Not Detected ({notDetectedCount})
            </button>
          </div>
        </div>

        {/* Evidence Table */}
        <div className="overflow-x-auto print:overflow-visible border border-slate-200 print:border-slate-300 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 print:bg-slate-100 border-b border-slate-200 print:border-slate-300 text-slate-700 font-semibold">
                <th className="py-2.5 px-4 w-1/3">Role Requirement</th>
                <th className="py-2.5 px-4 w-1/5">Status</th>
                <th className="py-2.5 px-4 w-1/2">Resume Evidence Citation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500 italic">
                    No requirements match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredMatches.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors print:break-inside-avoid">
                    <td className="py-3 px-4 font-medium text-slate-900 align-top">
                      {item.requirement}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 leading-relaxed align-top">
                      {item.resumeEvidence}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Relevant Strengths & 5. Potential Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print-avoid-break">
        {/* Section 4: Relevant Strengths */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-3 print:border-slate-300 print:p-5 print:shadow-none">
          <div className="border-b border-slate-100 print:border-slate-200 pb-3">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              4. Relevant Strengths
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Supported by Resume Evidence
            </h3>
            <p className="text-xs text-slate-500">
              Explicit candidate qualifications matching position criteria
            </p>
          </div>

          {strengths.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              No explicit strengths could be conclusively verified from document text.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-700">
              {strengths.map((str, i) => (
                <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section 5: Potential Gaps */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-3 print:border-slate-300 print:p-5 print:shadow-none">
          <div className="border-b border-slate-100 print:border-slate-200 pb-3">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              5. Potential Gaps / Areas to Clarify
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Unverified or Ambiguous Requirements
            </h3>
            <p className="text-xs text-slate-500">
              Qualifications not detected, partially evidenced, or ambiguous in document text
            </p>
          </div>

          {potentialGaps.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              All essential requirements found in the job description have supporting evidence.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-700">
              {potentialGaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 6. Interview Focus */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-6 shadow-2xs space-y-4 print:border-slate-300 print:p-5 print:shadow-none print-avoid-break">
        <div className="flex items-center gap-2 border-b border-slate-100 print:border-slate-200 pb-3">
          <MessageSquare className="w-4 h-4 text-blue-700" />
          <div>
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              6. Interview Focus
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Evidence-Based Interview Inquiries
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Questions generated specifically to explore unverified or ambiguous requirements during recruiter phone screens or hiring rounds:
        </p>

        <div className="space-y-2.5">
          {interviewFocus.map((question, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 text-xs text-slate-700 bg-slate-50 print:bg-slate-50/80 p-3 rounded-md border border-slate-200 print:border-slate-300 print:break-inside-avoid"
            >
              <span className="font-mono text-slate-400 shrink-0 font-medium">
                Q{idx + 1}.
              </span>
              <span className="leading-relaxed">{question}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Unified Candidate Activity Timeline */}
      <div id="candidate-activity-timeline-section" className="print:hidden">
        <CandidateActivityTimeline
          candidate={candidateRecord}
          analysis={result}
        />
      </div>

      {/* 8. Analysis Notes & Ethical Disclaimer */}
      <div className="bg-slate-50 border border-slate-200 print:border-slate-300 rounded-lg p-4 text-xs text-slate-600 space-y-1 print:break-inside-avoid">
        <span className="font-semibold text-slate-800 block">
          Analysis Notes & Hiring Governance
        </span>
        <p className="leading-relaxed">
          Analysis is based only on information provided in the candidate resume and job description. "Not detected in resume" does not mean the candidate lacks the capability. Final hiring decisions remain with the hiring team.
        </p>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Delete this record?
              </h3>
            </div>

            <div className="text-xs sm:text-sm text-slate-600 space-y-1">
              <p>
                Are you sure you want to delete the screening analysis for{' '}
                <strong className="text-slate-800">
                  {result.candidateOverview.detectedName || result.fileName}
                </strong>
                ?
              </p>
              <p className="text-slate-500">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Outreach Modal */}
      {isOutreachModalOpen && (
        <CandidateOutreachModal
          isOpen={isOutreachModalOpen}
          onClose={() => setIsOutreachModalOpen(false)}
          candidateAnalysis={result}
          candidateRecord={candidateRecord}
          jobs={jobs}
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          onSaveOutreachLog={onSaveOutreachLog}
        />
      )}

      {/* Candidate Interview Modal */}
      {isInterviewModalOpen && onUpdateCandidateInterviews && (
        <CandidateInterviewModal
          isOpen={isInterviewModalOpen}
          onClose={() => setIsInterviewModalOpen(false)}
          candidateAnalysis={result}
          candidateRecord={candidateRecord}
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          onUpdateCandidateInterviews={onUpdateCandidateInterviews}
          onUpdateCandidateStatus={onUpdateCandidateStatus}
        />
      )}
    </div>
  );
};