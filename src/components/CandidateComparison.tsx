import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Briefcase,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
  Filter,
  Check,
  X,
  FileText,
  Printer,
  Edit3,
  Loader2,
  Mail,
  Download
} from 'lucide-react';
import { AnalysisResult, CandidateRecord, Job, CandidateStage, MatchStatus, getNormalizedStage, PIPELINE_STAGES, CandidateOutreachLog } from '../types';
import { CandidateOutreachModal } from './CandidateOutreachModal';
import { generateComparisonPdfReport } from '../lib/pdf-report-generator';

interface CandidateComparisonProps {
  candidates: AnalysisResult[];
  candidateRecords: CandidateRecord[];
  jobs: Job[];
  onBack: () => void;
  onViewCandidateAnalysis: (analysis: AnalysisResult) => void;
  onUpdateCandidateStatus?: (candidateIdOrAnalysisId: string, status: CandidateRecord['status']) => Promise<void>;
  onUpdateCandidateNotes?: (candidateId: string, notes: string) => Promise<void>;
  currentUserEmail?: string;
  currentUserName?: string;
  onSaveCandidateOutreach?: (candidateIdOrAnalysisId: string, log: CandidateOutreachLog) => Promise<void>;
}

export const CandidateComparison: React.FC<CandidateComparisonProps> = ({
  candidates,
  candidateRecords,
  jobs,
  onBack,
  onViewCandidateAnalysis,
  onUpdateCandidateStatus,
  onUpdateCandidateNotes,
  currentUserEmail,
  currentUserName,
  onSaveCandidateOutreach,
}) => {
  const [filterCriteria, setFilterCriteria] = useState<'all' | 'differing'>('all');
  const [updatingCandidateId, setUpdatingCandidateId] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Candidate Outreach modal state
  const [outreachCandidate, setOutreachCandidate] = useState<CandidateRecord | null>(null);
  const [outreachCandidateAnalysis, setOutreachCandidateAnalysis] = useState<AnalysisResult | null>(null);
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);

  // Edit notes state
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState<AnalysisResult | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // PDF Export and Print feedback
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ type: 'info' | 'error'; message: string } | null>(null);

  // Job requisition details for this comparison
  const jobTitle = candidates[0]?.roleSummary?.jobTitle || 'Role Comparison';
  const jobDepartment = candidates[0]?.roleSummary?.department || 'General';
  const currentJob = jobs.find((j) => j.id === candidates[0]?.jobId);

  const handleUpdateStatus = async (targetId: string, newStage: CandidateStage) => {
    if (!onUpdateCandidateStatus) return;
    setUpdatingCandidateId(targetId);
    setStatusUpdateError(null);
    try {
      await onUpdateCandidateStatus(targetId, newStage);
    } catch (err) {
      console.error('Failed to update stage in comparison:', err);
      setStatusUpdateError('Failed to persist stage change to Firestore.');
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  const handleOpenEditNotes = (cand: AnalysisResult, record?: CandidateRecord) => {
    setEditingAnalysis(cand);
    setEditingCandidate(record || null);
    setNoteContent(record?.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!onUpdateCandidateNotes) return;
    setIsSavingNote(true);
    try {
      const targetId = editingCandidate?.id || editingAnalysis?.id;
      if (targetId) {
        await onUpdateCandidateNotes(targetId, noteContent);
      }
      setEditingCandidate(null);
      setEditingAnalysis(null);
    } catch (err) {
      console.error('Failed to save notes in comparison:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Union of all unique requirements across all selected candidates to enable true side-by-side criteria evaluation
  const allRequirements = useMemo(() => {
    const map = new Map<string, string>();
    candidates.forEach((cand) => {
      (cand.requirementMatches || []).forEach((rm) => {
        const normalized = rm.requirement.trim();
        if (normalized && !map.has(normalized)) {
          map.set(normalized, normalized);
        }
      });
    });
    return Array.from(map.values());
  }, [candidates]);

  // Determine if a requirement has differing statuses across the candidates
  const isDifferingRequirement = (req: string) => {
    const statuses = new Set<string>();
    candidates.forEach((cand) => {
      const match = (cand.requirementMatches || []).find(
        (m) => m.requirement.trim().toLowerCase() === req.toLowerCase()
      );
      statuses.add(match ? match.status : 'Not evaluated');
    });
    return statuses.size > 1;
  };

  const displayedRequirements = useMemo(() => {
    if (filterCriteria === 'differing') {
      return allRequirements.filter(isDifferingRequirement);
    }
    return allRequirements;
  }, [allRequirements, filterCriteria, candidates]);

  const getAlignmentBadge = (level: string) => {
    switch (level) {
      case 'Strong alignment':
        return 'text-emerald-800 bg-emerald-50 border-emerald-300';
      case 'Good alignment':
        return 'text-blue-800 bg-blue-50 border-blue-300';
      case 'Moderate alignment':
        return 'text-amber-800 bg-amber-50 border-amber-300';
      case 'Limited evidence':
      case 'Insufficient evidence':
      default:
        return 'text-slate-700 bg-slate-100 border-slate-300';
    }
  };

  const getStageBadgeStyle = (stage: CandidateStage) => {
    switch (stage) {
      case 'New':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Reviewed':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Shortlisted':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Interview':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Hired':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getGridColsClass = (count: number) => {
    switch (count) {
      case 2:
        return 'md:grid-cols-2';
      case 3:
        return 'md:grid-cols-3';
      case 4:
        return 'md:grid-cols-4';
      default:
        return 'md:grid-cols-5';
    }
  };

  const getStatusIcon = (status?: MatchStatus | string) => {
    switch (status) {
      case 'Detected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Detected</span>
          </span>
        );
      case 'Partially detected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Partially detected</span>
          </span>
        );
      case 'Not detected in resume':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Not detected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 italic">
            Not evaluated
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Top Navigation & Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-7 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-400" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Candidate Registry</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                Evidence Comparison
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-600 font-medium">
                Comparing {candidates.length} candidates
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Requisition: {jobTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Department: {jobDepartment} {currentJob?.location ? `· ${currentJob.location}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter differing criteria button */}
            {allRequirements.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterCriteria((prev) => (prev === 'all' ? 'differing' : 'all'))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  filterCriteria === 'differing'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {filterCriteria === 'differing'
                    ? 'Showing Differing Criteria Only'
                    : 'Show Only Differing Criteria'}
                </span>
              </button>
            )}

            {/* Structured PDF Comparison Export */}
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => {
                setIsExportingPdf(true);
                setPrintNotice(null);
                try {
                  generateComparisonPdfReport(candidates, currentJob);
                  setPrintNotice({
                    type: 'info',
                    message: 'Candidate comparison matrix downloaded successfully as PDF.',
                  });
                } catch (err: any) {
                  console.error('Comparison PDF export error:', err);
                  setPrintNotice({
                    type: 'error',
                    message: 'Could not generate comparison PDF. You can also use Print Comparison.',
                  });
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg shadow-2xs transition-colors cursor-pointer print:hidden"
              title="Download structured A4 landscape PDF comparison report"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExportingPdf ? 'Exporting PDF...' : 'Download Comparison (PDF)'}</span>
            </button>

            {/* Print / Save PDF Comparison */}
            <button
              type="button"
              onClick={() => {
                setPrintNotice(null);
                try {
                  if (typeof window !== 'undefined' && typeof window.print === 'function') {
                    window.print();
                  }
                } catch (printErr) {
                  console.warn('Browser printing restricted by sandbox frame:', printErr);
                  setPrintNotice({
                    type: 'info',
                    message: 'Browser printing was restricted by this iframe window. Use "Download Comparison (PDF)" to save the offline report.',
                  });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer print:hidden"
              title="Print or save candidate comparison via browser print dialog"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Comparison</span>
            </button>

            <button
              onClick={onBack}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer print:hidden"
            >
              Done Comparing
            </button>
          </div>
        </div>

        {/* Print / Export Feedback Banner */}
        {printNotice && (
          <div
            className={`mt-4 border rounded-lg p-3 text-xs flex items-center justify-between gap-3 print:hidden animate-in fade-in duration-150 ${
              printNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-950'
            }`}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-700 shrink-0" />
              <span>{printNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintNotice(null)}
              className="font-semibold px-2 py-0.5 text-slate-600 hover:text-slate-900 rounded cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Governance & Anti-Bias Disclaimer */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/70">
          <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700 block">
              Ethical Screening & Recruiter Decision Governance:
            </span>
            <span>
              This comparison evaluates only verified job-related qualifications documented in uploaded resumes. Mihora does not rank candidates based on protected personal characteristics, age, photos, or geographic assumptions. All comparisons serve as objective decision support for human hiring managers.
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Summary Profiles Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-700" />
            <span>Candidate Overview & Overall Alignment</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Evaluations stored in Firestore
          </span>
        </div>

        {/* Profiles Grid */}
        <div className={`grid grid-cols-1 ${getGridColsClass(Math.min(candidates.length, 5))} divide-y md:divide-y-0 md:divide-x divide-slate-200`}>
          {candidates.map((cand) => {
            const detectedCount = (cand.requirementMatches || []).filter((e) => e.status === 'Detected').length;
            const notDetectedCount = (cand.requirementMatches || []).filter((e) => e.status === 'Not detected in resume').length;
            const partialCount = (cand.requirementMatches || []).filter((e) => e.status === 'Partially detected').length;
            const candidateName = cand.candidateOverview?.detectedName || cand.fileName;
            const matchingRecord = candidateRecords.find((r) => r.analysisId === cand.id);
            const currentStage = getNormalizedStage(matchingRecord?.status);
            const isUpdating = updatingCandidateId === (matchingRecord?.id || cand.id);

            return (
              <div key={cand.id} className="p-5 space-y-4 flex flex-col justify-between bg-white">
                <div className="space-y-3">
                  {/* Name and Level */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {candidateName}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {cand.candidateOverview?.currentOrRecentRole || 'Role not stated in resume'}
                    </p>
                  </div>

                  {/* Alignment badge & Stage badge */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-bold rounded border ${getAlignmentBadge(
                        cand.overallRoleAlignment?.level || ''
                      )}`}
                    >
                      {cand.overallRoleAlignment?.level}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Stage: {getNormalizedStage(matchingRecord?.status)}
                    </span>
                  </div>

                  {/* Alignment summary quote */}
                  {cand.overallRoleAlignment?.summary && (
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed font-sans italic">
                      "{cand.overallRoleAlignment.summary}"
                    </div>
                  )}

                  {/* Metric stats */}
                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-center text-xs">
                    <div className="p-2 bg-emerald-50/60 rounded border border-emerald-100">
                      <span className="block font-mono font-bold text-emerald-700 text-sm">{detectedCount}</span>
                      <span className="text-[10px] text-emerald-800 font-medium">Detected</span>
                    </div>
                    <div className="p-2 bg-amber-50/60 rounded border border-amber-100">
                      <span className="block font-mono font-bold text-amber-700 text-sm">{partialCount}</span>
                      <span className="text-[10px] text-amber-800 font-medium">Partial</span>
                    </div>
                    <div className="p-2 bg-slate-100/70 rounded border border-slate-200">
                      <span className="block font-mono font-bold text-slate-600 text-sm">{notDetectedCount}</span>
                      <span className="text-[10px] text-slate-600 font-medium">Unstated</span>
                    </div>
                  </div>

                  {/* Pipeline Stage Quick Selector */}
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs gap-1.5">
                    <span className="text-slate-500 text-[11px] font-medium shrink-0">Stage:</span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                      {onUpdateCandidateStatus ? (
                        <div className="relative inline-flex items-center">
                          <select
                            value={currentStage}
                            disabled={isUpdating}
                            onChange={(e) => {
                              const targetId = matchingRecord?.id || cand.id;
                              handleUpdateStatus(targetId, e.target.value as CandidateStage);
                            }}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-hidden ${getStageBadgeStyle(
                              currentStage
                            )}`}
                            title="Update candidate pipeline stage"
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                Stage: {s.label}
                              </option>
                            ))}
                          </select>
                          {isUpdating && (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600 ml-1 shrink-0" />
                          )}
                        </div>
                      ) : (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getStageBadgeStyle(currentStage)}`}>
                          {currentStage}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setOutreachCandidateAnalysis(cand);
                          setOutreachCandidate(matchingRecord || null);
                          setIsOutreachModalOpen(true);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Draft grounded candidate outreach email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>

                      {onUpdateCandidateNotes && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditNotes(cand, matchingRecord)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          title="Add or edit candidate notes"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recruiter Notes Snippet if available */}
                  {matchingRecord?.notes && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/80 font-sans leading-relaxed">
                      <span className="font-semibold text-slate-700">Notes:</span> {matchingRecord.notes}
                    </div>
                  )}

                  {/* Location Intelligence (Contextual only) */}
                  {cand.candidateOverview?.detectedLocation && (
                    <div className="text-xs flex items-center gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{cand.candidateOverview.detectedLocation}</span>
                    </div>
                  )}
                </div>

                {/* Link to Full Analysis Report */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onViewCandidateAnalysis(cand)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                  >
                    <span>View Full Report</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Requirement-by-Requirement Comparison Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden space-y-0">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Job Requirements & Supporting Resume Evidence</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Direct resume excerpts validating whether each qualification is explicitly evidenced.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {displayedRequirements.length} criteria evaluated
          </div>
        </div>

        {displayedRequirements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50">
            {filterCriteria === 'differing'
              ? 'All candidates currently share the same evaluation status for all requirements.'
              : 'No specific requirements extracted from the job description.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 overflow-x-auto">
            {displayedRequirements.map((req, rIdx) => (
              <div key={rIdx} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                {/* Requirement Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 max-w-3xl">
                    <span className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-wider">
                      Criteria #{rIdx + 1}
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                      {req}
                    </h4>
                  </div>
                  {isDifferingRequirement(req) && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0">
                      Differs across candidates
                    </span>
                  )}
                </div>

                {/* Evidence Columns for each Candidate */}
                <div className={`grid grid-cols-1 ${getGridColsClass(Math.min(candidates.length, 5))} gap-4 pt-1`}>
                  {candidates.map((cand) => {
                    const match = (cand.requirementMatches || []).find(
                      (m) => m.requirement.trim().toLowerCase() === req.toLowerCase()
                    );
                    const candidateName = cand.candidateOverview?.detectedName || cand.fileName;

                    return (
                      <div
                        key={cand.id}
                        className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                            <span className="font-bold text-[11px] text-slate-800 truncate">
                              {candidateName}
                            </span>
                            {getStatusIcon(match?.status)}
                          </div>

                          {/* Resume Evidence Citation */}
                          {match?.resumeEvidence ? (
                            <p className="text-[11px] text-slate-700 leading-relaxed font-sans italic bg-white p-2 rounded border border-slate-200/60">
                              "{match.resumeEvidence}"
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              No textual evidence detected in uploaded resume.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relevant Experience, Education & Key Skills Comparison */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-700" />
            <span>Documented Skills, Experience & Education</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Factual extraction from resume headers and text
          </span>
        </div>

        <div className={`grid grid-cols-1 ${getGridColsClass(Math.min(candidates.length, 5))} divide-y md:divide-y-0 md:divide-x divide-slate-200`}>
          {candidates.map((cand) => {
            const overview = cand.candidateOverview;
            const skills = overview?.keySkillsDetected || [];
            const education = overview?.education || [];
            const certifications = overview?.certifications || [];
            const candidateName = overview?.detectedName || cand.fileName;

            return (
              <div key={cand.id} className="p-5 space-y-4 bg-white text-xs">
                <div className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
                  {candidateName}
                </div>

                {/* Experience Summary */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Experience Summary
                  </span>
                  {overview?.experienceSummary ? (
                    <p className="text-slate-700 leading-relaxed text-[11px]">
                      {overview.experienceSummary}
                    </p>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">
                      No summary extracted from resume.
                    </p>
                  )}
                </div>

                {/* Extracted Skills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Verified Skills ({skills.length})
                  </span>
                  {skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {skills.map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">
                      No explicit skill keywords parsed.
                    </p>
                  )}
                </div>

                {/* Education */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Education
                  </span>
                  {education.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
                      {education.map((edu, eIdx) => (
                        <li key={eIdx}>{edu}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">
                      No formal education listed.
                    </p>
                  )}
                </div>

                {/* Certifications */}
                {certifications.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Certifications
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
                      {certifications.map((cert, cIdx) => (
                        <li key={cIdx}>{cert}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Interview Focus Areas Side-by-Side */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-700" />
            <span>Targeted Interview Inquiries by Candidate</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Constructive questions addressing unevidenced qualifications
          </span>
        </div>

        <div className={`grid grid-cols-1 ${getGridColsClass(Math.min(candidates.length, 5))} divide-y md:divide-y-0 md:divide-x divide-slate-200`}>
          {candidates.map((cand) => {
            const inquiries = cand.interviewFocus || [];
            const candidateName = cand.candidateOverview?.detectedName || cand.fileName;

            return (
              <div key={cand.id} className="p-5 space-y-3 bg-white text-xs">
                <div className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
                  {candidateName}
                </div>

                {inquiries.length > 0 ? (
                  <div className="space-y-2">
                    {inquiries.map((inq, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded text-[11px] text-slate-700 leading-relaxed font-sans"
                      >
                        <strong className="text-blue-700 block font-mono text-[10px] mb-0.5">
                          Question {qIdx + 1}
                        </strong>
                        {inq}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[11px]">
                    No specific inquiry recommendations generated.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Update Error Notice */}
      {statusUpdateError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
          <span>{statusUpdateError}</span>
          <button
            type="button"
            onClick={() => setStatusUpdateError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Edit Notes Modal */}
      {(editingCandidate || editingAnalysis) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Candidate Notes — {editingAnalysis?.candidateOverview.detectedName || editingAnalysis?.fileName || 'Candidate'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCandidate(null);
                  setEditingAnalysis(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Recruiter Screening Observations & Next Steps
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                placeholder="Document recruiter impressions, salary expectations, interview availability, or technical assessment notes..."
                className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-hidden focus:border-blue-600 focus:bg-white resize-none leading-relaxed"
              />
              <p className="text-[11px] text-slate-400">
                Notes persist to Firestore and sync across recruiter pipelines and comparisons.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setEditingCandidate(null);
                  setEditingAnalysis(null);
                }}
                disabled={isSavingNote}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNote}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                {isSavingNote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSavingNote ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Outreach Modal */}
      {isOutreachModalOpen && outreachCandidateAnalysis && (
        <CandidateOutreachModal
          isOpen={isOutreachModalOpen}
          onClose={() => {
            setIsOutreachModalOpen(false);
            setOutreachCandidate(null);
            setOutreachCandidateAnalysis(null);
          }}
          candidateAnalysis={outreachCandidateAnalysis}
          candidateRecord={outreachCandidate}
          jobs={jobs}
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          onSaveOutreachLog={onSaveCandidateOutreach}
        />
      )}
    </div>
  );
};