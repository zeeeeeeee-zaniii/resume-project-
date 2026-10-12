import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  ArrowRight, 
  MapPin, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Sparkles,
  Scale,
  Check,
  X,
  Layers,
  Info,
  LayoutList,
  Columns3,
  Award,
  Clock,
  UserCheck,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  AnalysisResult, 
  CandidateRecord, 
  Job, 
  CandidateStage, 
  CandidateStatus, 
  getNormalizedStage, 
  PIPELINE_STAGES 
} from '../types';

interface CandidatesViewProps {
  candidates: AnalysisResult[];
  candidateRecords?: CandidateRecord[];
  jobs?: Job[];
  onSelectCandidate: (candidate: AnalysisResult) => void;
  onStartNewAnalysis: () => void;
  onDeleteCandidate?: (analysisId: string) => Promise<void>;
  onUpdateCandidateNotes?: (candidateId: string, notes: string) => Promise<void>;
  onUpdateCandidateStatus?: (candidateIdOrAnalysisId: string, status: CandidateRecord['status']) => Promise<void>;
  onCompareCandidates?: (selectedCandidates: AnalysisResult[]) => void;
  initialViewMode?: 'list' | 'pipeline';
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({
  candidates,
  candidateRecords = [],
  jobs = [],
  onSelectCandidate,
  onStartNewAnalysis,
  onDeleteCandidate,
  onUpdateCandidateNotes,
  onUpdateCandidateStatus,
  onCompareCandidates,
  initialViewMode = 'list',
}) => {
  // Primary view switcher: 'list' (Registry) or 'pipeline' (Stage Columns)
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>(initialViewMode);
  const [selectedMobileStage, setSelectedMobileStage] = useState<'all' | CandidateStage>('all');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [alignmentFilter, setAlignmentFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState<string>('All');

  // Status updating state feedback
  const [updatingCandidateId, setUpdatingCandidateId] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Deletion modal state
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comparison selection state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [comparisonValidationNotice, setComparisonValidationNotice] = useState<string | null>(null);

  // Pagination / Load More state (50 records per page in list view)
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Edit notes modal state
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null);
  const [editingCandidateAnalysis, setEditingCandidateAnalysis] = useState<AnalysisResult | null>(null);
  const [candidateNotes, setCandidateNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Helper to resolve candidate record from candidate analysis
  const getCandidateRecord = (cand: AnalysisResult): CandidateRecord | undefined => {
    return candidateRecords.find((r) => r.analysisId === cand.id || r.id === cand.id);
  };

  // Helper to resolve canonical candidate stage
  const getCandidateCurrentStage = (cand: AnalysisResult): CandidateStage => {
    const record = getCandidateRecord(cand);
    return getNormalizedStage(record?.status);
  };

  // Status update handler with loading feedback and error handling
  const handleUpdateStatus = async (targetCandidateIdOrAnalysisId: string, newStage: CandidateStage) => {
    if (!onUpdateCandidateStatus) return;
    setUpdatingCandidateId(targetCandidateIdOrAnalysisId);
    setStatusUpdateError(null);
    try {
      await onUpdateCandidateStatus(targetCandidateIdOrAnalysisId, newStage);
    } catch (err: any) {
      console.error('Failed to update candidate status:', err);
      setStatusUpdateError('Failed to persist stage change to Firestore. Please verify your connection.');
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  // Filtered candidate list based on search, role, alignment, and stage filters
  const filteredCandidates = candidates.filter((item) => {
    const candidateName = item.candidateOverview.detectedName || item.fileName;
    const location = item.candidateOverview.detectedLocation || '';
    const skills = item.candidateOverview.keySkillsDetected.join(' ');
    const currentStage = getCandidateCurrentStage(item);

    const matchesQuery = 
      candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skills.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roleSummary.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roleSummary.department.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'All' || item.roleSummary.jobTitle === roleFilter;
    const matchesAlignment = alignmentFilter === 'All' || item.overallRoleAlignment.level === alignmentFilter;
    const matchesStage = stageFilter === 'All' || currentStage === stageFilter;

    return matchesQuery && matchesRole && matchesAlignment && matchesStage;
  });

  const uniqueRoles = ['All', ...Array.from(new Set(candidates.map((c) => c.roleSummary.jobTitle)))];

  // Candidates grouped by stage for the pipeline view
  const candidatesByStage = PIPELINE_STAGES.reduce<Record<CandidateStage, AnalysisResult[]>>(
    (acc, stage) => {
      acc[stage.id] = filteredCandidates.filter((cand) => getCandidateCurrentStage(cand) === stage.id);
      return acc;
    },
    {
      New: [],
      Reviewed: [],
      Shortlisted: [],
      Interview: [],
      Hired: [],
      Rejected: [],
    }
  );

  const handleConfirmDelete = async () => {
    if (!deletingCandidateId || !onDeleteCandidate) return;
    setIsDeleting(true);
    try {
      await onDeleteCandidate(deletingCandidateId);
      setDeletingCandidateId(null);
    } catch (err) {
      console.error('Delete candidate error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEditNotes = (cand: AnalysisResult) => {
    const matchingRecord = getCandidateRecord(cand);
    setEditingCandidateAnalysis(cand);
    if (matchingRecord) {
      setEditingCandidate(matchingRecord);
      setCandidateNotes(matchingRecord.notes || '');
    } else {
      setEditingCandidate(null);
      setCandidateNotes('');
    }
  };

  const handleSaveNotes = async () => {
    if (!onUpdateCandidateNotes) return;
    setIsSavingNotes(true);
    try {
      const targetId = editingCandidate?.id || editingCandidateAnalysis?.id;
      if (targetId) {
        await onUpdateCandidateNotes(targetId, candidateNotes);
      }
      setEditingCandidate(null);
      setEditingCandidateAnalysis(null);
    } catch (err) {
      console.error('Save notes error:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Toggle selection for comparison (2 to 5 candidates from the same job requisition)
  const handleToggleSelectCandidate = (cand: AnalysisResult) => {
    setComparisonValidationNotice(null);
    if (selectedCandidateIds.includes(cand.id)) {
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== cand.id));
      return;
    }

    // Limit check: maximum 5 candidates
    if (selectedCandidateIds.length >= 5) {
      setComparisonValidationNotice('You can select a maximum of 5 candidates to compare simultaneously.');
      return;
    }

    // Same requisition check: ensure candidates belong to the same job
    if (selectedCandidateIds.length > 0) {
      const firstSelected = candidates.find((c) => c.id === selectedCandidateIds[0]);
      if (firstSelected) {
        const firstJobId = firstSelected.jobId;
        const firstJobTitle = firstSelected.roleSummary.jobTitle;

        const candJobId = cand.jobId;
        const candJobTitle = cand.roleSummary.jobTitle;

        const isSameJob = (firstJobId && candJobId)
          ? firstJobId === candJobId
          : firstJobTitle.toLowerCase().trim() === candJobTitle.toLowerCase().trim();

        if (!isSameJob) {
          setComparisonValidationNotice(
            `Cross-requisition comparison is prohibited. "${cand.candidateOverview.detectedName || cand.fileName}" belongs to "${candJobTitle}", but selected candidates are for "${firstJobTitle}". Please select candidates evaluated for the same requisition.`
          );
          return;
        }
      }
    }

    setSelectedCandidateIds((prev) => [...prev, cand.id]);
  };

  const handleLaunchComparison = () => {
    if (selectedCandidateIds.length < 2) {
      setComparisonValidationNotice('Please select at least 2 candidates for the same job requisition to start a comparison.');
      return;
    }

    if (selectedCandidateIds.length > 5) {
      setComparisonValidationNotice('Please select no more than 5 candidates to compare.');
      return;
    }

    const selectedList = candidates.filter((c) => selectedCandidateIds.includes(c.id));
    if (onCompareCandidates) {
      onCompareCandidates(selectedList);
    }
  };

  const handleCancelComparisonMode = () => {
    setIsComparisonMode(false);
    setSelectedCandidateIds([]);
    setComparisonValidationNotice(null);
  };

  const getAlignmentBadge = (level: string) => {
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
        return 'text-slate-700 bg-slate-100 border-slate-200';
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

  const getStageIcon = (stage: CandidateStage) => {
    switch (stage) {
      case 'New':
        return <Sparkles className="w-3.5 h-3.5 text-blue-600" />;
      case 'Reviewed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Shortlisted':
        return <Award className="w-3.5 h-3.5 text-amber-600" />;
      case 'Interview':
        return <Calendar className="w-3.5 h-3.5 text-purple-600" />;
      case 'Hired':
        return <UserCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Rejected':
        return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span>Candidates</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
              {candidates.length} total
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registry & recruitment stage pipeline across all active and archived job requisitions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Segmented View Switcher: List vs Pipeline */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to registry list view"
            >
              <LayoutList className="w-3.5 h-3.5 text-slate-600" />
              <span>Registry List</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('pipeline');
                if (isComparisonMode) handleCancelComparisonMode();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'pipeline'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to visual pipeline board"
            >
              <Columns3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Pipeline Board</span>
            </button>
          </div>

          {/* Comparison Mode Launch Button */}
          {onCompareCandidates && candidates.length >= 2 && (
            <button
              onClick={() => {
                if (isComparisonMode) {
                  handleCancelComparisonMode();
                } else {
                  setViewMode('list');
                  setIsComparisonMode(true);
                  setComparisonValidationNotice(null);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer border ${
                isComparisonMode
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
              }`}
            >
              <Scale className="w-4 h-4 text-blue-600" />
              <span>{isComparisonMode ? 'Exit Comparison' : 'Compare Candidates'}</span>
            </button>
          )}

          {/* Screen Candidate Action */}
          <button
            onClick={onStartNewAnalysis}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Screen Candidate</span>
          </button>
        </div>
      </div>

      {/* Status Update Error Notice */}
      {statusUpdateError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between gap-2 text-xs text-rose-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{statusUpdateError}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusUpdateError(null)}
            className="text-rose-500 hover:text-rose-800 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Comparison Selection Action Banner */}
      {isComparisonMode && (
        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-blue-900 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-blue-700" />
                  <span>Select 2 to 5 Candidates for Comparison</span>
                </span>
                <span className="text-xs bg-white text-blue-800 font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                  {selectedCandidateIds.length}/5 Selected
                </span>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                Click candidate cards below to select. All candidates must be screened for the same job requisition.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelComparisonMode}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchComparison}
                disabled={selectedCandidateIds.length < 2}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md shadow-2xs transition-colors ${
                  selectedCandidateIds.length >= 2
                    ? 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Now ({selectedCandidateIds.length})</span>
              </button>
            </div>
          </div>

          {/* Validation Notice Box */}
          {comparisonValidationNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <span className="font-semibold block">Selection Constraint:</span>
                <span>{comparisonValidationNotice}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search candidates by name, location, target role, or skills..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:bg-white focus:border-blue-600 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          {uniqueRoles.length > 1 && (
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2.5 focus:outline-hidden focus:border-blue-600 text-slate-700"
            >
              {uniqueRoles.map((role) => (
                <option key={role} value={role}>
                  {role === 'All' ? 'All Roles' : role}
                </option>
              ))}
            </select>
          )}

          {/* Alignment Filter */}
          <select
            value={alignmentFilter}
            onChange={(e) => {
              setAlignmentFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2.5 focus:outline-hidden focus:border-blue-600 text-slate-700"
          >
            <option value="All">All Alignments</option>
            <option value="Strong alignment">Strong alignment</option>
            <option value="Good alignment">Good alignment</option>
            <option value="Moderate alignment">Moderate alignment</option>
            <option value="Limited evidence">Limited evidence</option>
            <option value="Insufficient evidence">Insufficient evidence</option>
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2.5 focus:outline-hidden focus:border-blue-600 text-slate-700"
          >
            <option value="All">All Stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                Stage: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =========================================================================
          VIEW MODE 1: PIPELINE BOARD (6 Stage Columns)
         ========================================================================= */}
      {viewMode === 'pipeline' && (
        <div className="space-y-4">
          {/* Mobile stage selector tabs */}
          <div className="flex sm:hidden overflow-x-auto gap-1 pb-1 text-xs">
            <button
              onClick={() => setSelectedMobileStage('all')}
              className={`px-3 py-1.5 rounded-full font-semibold shrink-0 border ${
                selectedMobileStage === 'all'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              All Columns
            </button>
            {PIPELINE_STAGES.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedMobileStage(st.id)}
                className={`px-3 py-1.5 rounded-full font-semibold shrink-0 border flex items-center gap-1.5 ${
                  selectedMobileStage === st.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span>{st.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-800">
                  {candidatesByStage[st.id].length}
                </span>
              </button>
            ))}
          </div>

          {/* Pipeline Kanban Board Container */}
          <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory min-h-[520px]">
            {PIPELINE_STAGES.filter(
              (stage) => selectedMobileStage === 'all' || selectedMobileStage === stage.id
            ).map((stage) => {
              const stageCandidates = candidatesByStage[stage.id];

              return (
                <div
                  key={stage.id}
                  className="min-w-[290px] sm:min-w-[310px] max-w-[340px] flex-1 flex flex-col bg-slate-50/80 border border-slate-200 rounded-xl overflow-hidden shadow-2xs snap-start"
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b border-slate-200 ${stage.headerBg} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-white shadow-2xs">
                        {getStageIcon(stage.id)}
                      </div>
                      <div>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                          {stage.label}
                        </h2>
                        <p className="text-[10px] text-slate-500 truncate max-w-[170px]">
                          {stage.description}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold bg-white text-slate-800 px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                      {stageCandidates.length}
                    </span>
                  </div>

                  {/* Column Candidates List */}
                  <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[720px]">
                    {stageCandidates.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 rounded-lg bg-white/50 text-slate-400 space-y-2 min-h-[160px]">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          {getStageIcon(stage.id)}
                        </div>
                        <p className="text-xs font-semibold text-slate-600">
                          No candidates in {stage.label}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px]">
                          Use the stage dropdown on any candidate card to move them here.
                        </p>
                      </div>
                    ) : (
                      stageCandidates.map((cand) => {
                        const matchingRecord = getCandidateRecord(cand);
                        const currentStage = getCandidateCurrentStage(cand);
                        const targetJob = jobs.find((j) => j.id === cand.jobId);
                        const detectedCount = cand.requirementMatches.filter((e) => e.status === 'Detected').length;
                        const notDetectedCount = cand.requirementMatches.filter((e) => e.status === 'Not detected in resume').length;
                        const isUpdating = updatingCandidateId === (matchingRecord?.id || cand.id);

                        return (
                          <div
                            key={cand.id}
                            className={`bg-white border rounded-lg p-3.5 shadow-2xs space-y-3 transition-all hover:border-slate-300 ${
                              isUpdating ? 'border-blue-400 bg-blue-50/20 ring-1 ring-blue-300' : 'border-slate-200/90'
                            }`}
                          >
                            {/* Candidate Name & Alignment */}
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => onSelectCandidate(cand)}
                                  className="text-left font-bold text-xs sm:text-sm text-slate-900 hover:text-blue-700 transition-colors line-clamp-1 cursor-pointer"
                                  title="View full resume analysis"
                                >
                                  {cand.candidateOverview.detectedName || cand.fileName}
                                </button>
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded border shrink-0 ${getAlignmentBadge(
                                    cand.overallRoleAlignment.level
                                  )}`}
                                >
                                  {cand.overallRoleAlignment.level}
                                </span>
                              </div>

                              {/* Target Job Requisition */}
                              <div className="text-[11px] text-slate-600 flex items-center gap-1.5 truncate">
                                <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-semibold truncate text-slate-800">
                                  {targetJob?.title || cand.roleSummary.jobTitle}
                                </span>
                                <span>·</span>
                                <span className="text-slate-500 truncate">
                                  {targetJob?.department || cand.roleSummary.department}
                                </span>
                              </div>
                            </div>

                            {/* Location & Role Details */}
                            <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                              {cand.candidateOverview.detectedLocation && (
                                <div className="flex items-center gap-1 text-slate-600">
                                  <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                  <span className="truncate">{cand.candidateOverview.detectedLocation}</span>
                                </div>
                              )}
                              {cand.candidateOverview.currentOrRecentRole && (
                                <div className="text-slate-600 truncate">
                                  <span className="font-medium">Recent:</span> {cand.candidateOverview.currentOrRecentRole}
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                <span>{detectedCount} detected · {notDetectedCount} unevidenced</span>
                                <span>Screened {cand.analyzedAt}</span>
                              </div>
                            </div>

                            {/* Recruiter Notes Excerpt */}
                            {matchingRecord?.notes && (
                              <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/80 leading-relaxed font-sans line-clamp-2">
                                <span className="font-bold text-slate-700">Notes:</span> {matchingRecord.notes}
                              </div>
                            )}

                            {/* Stage Selector Dropdown */}
                            <div className="pt-2 border-t border-slate-100 space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Move Stage:
                                </label>
                                {isUpdating && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Updating...</span>
                                  </span>
                                )}
                              </div>
                              <select
                                value={currentStage}
                                disabled={isUpdating}
                                onChange={(e) => {
                                  const targetId = matchingRecord?.id || cand.id;
                                  handleUpdateStatus(targetId, e.target.value as CandidateStage);
                                }}
                                className={`w-full text-xs font-semibold py-1.5 px-2 rounded-md border cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-blue-600 ${getStageBadgeStyle(
                                  currentStage
                                )}`}
                                title="Move candidate to different recruitment pipeline stage"
                              >
                                {PIPELINE_STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Stage: {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Card Footer Quick Actions */}
                            <div className="flex items-center justify-between pt-1 text-xs">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditNotes(cand)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                                  title="Add or edit recruiter notes"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {onDeleteCandidate && (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingCandidateId(cand.id)}
                                    className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                    title="Delete candidate record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => onSelectCandidate(cand)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
                              >
                                <span>Report</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: REGISTRY LIST (Tabular / Card Rows with Pagination)
         ========================================================================= */}
      {viewMode === 'list' && (
        <>
          {filteredCandidates.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-xl p-12 shadow-2xs text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-6 h-6" />
              </div>

              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="text-base font-semibold text-slate-900">
                  {searchQuery || roleFilter !== 'All' || alignmentFilter !== 'All' || stageFilter !== 'All'
                    ? 'No matching candidates found'
                    : 'No candidates screened yet'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {searchQuery || roleFilter !== 'All' || alignmentFilter !== 'All' || stageFilter !== 'All'
                    ? 'Try adjusting your search query or resetting filters.'
                    : 'Upload and analyze candidate resumes against job requisitions to build your verified candidate pool.'}
                </p>
              </div>

              {!searchQuery && roleFilter === 'All' && stageFilter === 'All' && (
                <div className="pt-2">
                  <button
                    onClick={onStartNewAnalysis}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Screen First Candidate</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  Showing <strong className="text-slate-800">{Math.min(visibleCount, filteredCandidates.length)}</strong> of <strong className="text-slate-800">{filteredCandidates.length}</strong> {filteredCandidates.length === 1 ? 'candidate' : 'candidates'}
                </span>
                {filteredCandidates.length > visibleCount && (
                  <span className="text-blue-600 font-medium">
                    Page 1 of {Math.ceil(filteredCandidates.length / PAGE_SIZE)} ({PAGE_SIZE} per page)
                  </span>
                )}
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs divide-y divide-slate-100 overflow-hidden">
                {filteredCandidates.slice(0, visibleCount).map((cand) => {
                  const detectedCount = cand.requirementMatches.filter((e) => e.status === 'Detected').length;
                  const notDetectedCount = cand.requirementMatches.filter((e) => e.status === 'Not detected in resume').length;
                  const matchingRecord = getCandidateRecord(cand);
                  const currentStage = getCandidateCurrentStage(cand);
                  const isSelected = selectedCandidateIds.includes(cand.id);
                  const isUpdating = updatingCandidateId === (matchingRecord?.id || cand.id);

                  return (
                    <div
                      key={cand.id}
                      onClick={() => {
                        if (isComparisonMode) {
                          handleToggleSelectCandidate(cand);
                        }
                      }}
                      className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        isComparisonMode ? 'cursor-pointer' : ''
                      } ${
                        isSelected
                          ? 'bg-blue-50/60 ring-2 ring-blue-600 ring-inset'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Checkbox in comparison mode */}
                        {isComparisonMode && (
                          <div className="pt-0.5 shrink-0">
                            <div
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-blue-700 border-blue-700 text-white shadow-2xs'
                                  : 'bg-white border-slate-300 text-transparent hover:border-blue-400'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">
                              {cand.candidateOverview.detectedName || cand.fileName}
                            </span>

                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${getAlignmentBadge(
                                cand.overallRoleAlignment.level
                              )}`}
                            >
                              {cand.overallRoleAlignment.level}
                            </span>

                            {/* Candidate Location */}
                            {cand.candidateOverview.detectedLocation ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                <MapPin className="w-3 h-3 text-blue-600" />
                                <span>{cand.candidateOverview.detectedLocation}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Location not detected
                              </span>
                            )}

                            {/* Candidate Stage Selector */}
                            <div className="inline-flex items-center gap-1.5">
                              <select
                                value={currentStage}
                                disabled={isUpdating}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const targetId = matchingRecord?.id || cand.id;
                                  handleUpdateStatus(targetId, e.target.value as CandidateStage);
                                }}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-hidden ${getStageBadgeStyle(
                                  currentStage
                                )}`}
                                title="Update candidate recruitment stage"
                              >
                                {PIPELINE_STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Stage: {s.label}
                                  </option>
                                ))}
                              </select>
                              {isUpdating && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">
                              Role: {cand.roleSummary.jobTitle}
                            </span>
                            <span>·</span>
                            <span>{cand.roleSummary.department}</span>
                            {cand.candidateOverview.currentOrRecentRole && (
                              <>
                                <span>·</span>
                                <span>Recent: {cand.candidateOverview.currentOrRecentRole}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>Screened: {cand.analyzedAt}</span>
                          </div>

                          {matchingRecord?.notes && (
                            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/80 font-sans">
                              <span className="font-semibold text-slate-700">Notes:</span> {matchingRecord.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="hidden md:flex flex-col text-right text-xs">
                          <span className="font-mono text-slate-700 font-semibold">
                            {detectedCount} detected
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {notDetectedCount} unevidenced
                          </span>
                        </div>

                        {onUpdateCandidateNotes && (
                          <button
                            onClick={() => handleOpenEditNotes(cand)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            title="Add recruiter notes"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {onDeleteCandidate && (
                          <button
                            onClick={() => setDeletingCandidateId(cand.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Delete candidate record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onSelectCandidate(cand)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                        >
                          <span>View Analysis</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Pagination Button */}
              {filteredCandidates.length > visibleCount && (
                <div className="pt-3 pb-2 flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Load More Candidates ({Math.min(PAGE_SIZE, filteredCandidates.length - visibleCount)} remaining)</span>
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Displaying {visibleCount} of {filteredCandidates.length} total screened candidates
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Candidate Confirmation Dialog */}
      {deletingCandidateId && (
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
              <p>Are you sure you want to delete this candidate screening record?</p>
              <p className="text-slate-500">This action cannot be undone.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCandidateId(null)}
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

      {/* Edit Notes Modal */}
      {(editingCandidate || editingCandidateAnalysis) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              Edit Candidate Information: {editingCandidate?.name || editingCandidateAnalysis?.candidateOverview.detectedName || editingCandidateAnalysis?.fileName || 'Candidate'}
            </h3>
            <p className="text-xs text-slate-500">
              Add internal recruiter notes or debrief comments for this candidate.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Recruiter Notes</label>
              <textarea
                rows={4}
                value={candidateNotes}
                onChange={(e) => setCandidateNotes(e.target.value)}
                placeholder="e.g. Spoke on phone 10/8, strong communication, ready for technical round..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingCandidate(null);
                  setEditingCandidateAnalysis(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingNotes}
                onClick={handleSaveNotes}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSavingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
