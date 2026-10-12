import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  MapPin,
  Clock,
  Filter,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
  Search,
  Award,
  Layers,
  FileText,
  BarChart3,
  RefreshCw,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { AnalysisResult, CandidateRecord, Job, getNormalizedStage, PIPELINE_STAGES } from '../types';

interface CeoDashboardProps {
  jobs: Job[];
  candidates: CandidateRecord[];
  analyses: AnalysisResult[];
  onViewJobs: () => void;
  onViewCandidates: () => void;
  onStartNewAnalysis: () => void;
  onSelectCandidateAnalysis: (analysisId: string) => void;
  onStartAnalysisForJob?: (job: Job) => void;
}

type TimeframeFilter = 'all' | '30d' | '7d';

export const CeoDashboard: React.FC<CeoDashboardProps> = ({
  jobs,
  candidates,
  analyses,
  onViewJobs,
  onViewCandidates,
  onStartNewAnalysis,
  onSelectCandidateAnalysis,
  onStartAnalysisForJob,
}) => {
  // Filter state
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter candidates by timeframe and job
  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      // Job filter
      if (selectedJobId !== 'all' && cand.jobId !== selectedJobId) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && getNormalizedStage(cand.status) !== statusFilter) {
        return false;
      }

      // Timeframe filter
      if (timeframe !== 'all') {
        const itemDate = new Date(cand.createdAt || cand.analyzedAt);
        if (!isNaN(itemDate.getTime())) {
          const now = new Date();
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
          if (timeframe === '7d' && diffDays > 7) return false;
          if (timeframe === '30d' && diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [candidates, selectedJobId, timeframe, statusFilter]);

  // Executive KPI calculations (based only on real data)
  const totalActiveJobs = useMemo(() => jobs.filter((j) => j.status === 'Open').length, [jobs]);
  const totalJobsCount = jobs.length;
  const totalCandidatesCount = filteredCandidates.length;

  // Real recruitment pipeline stage counts (distinguished from AI match rating)
  const newCount = useMemo(() => {
    return filteredCandidates.filter((c) => getNormalizedStage(c.status) === 'New').length;
  }, [filteredCandidates]);

  const reviewedCount = useMemo(() => {
    return filteredCandidates.filter((c) => getNormalizedStage(c.status) === 'Reviewed').length;
  }, [filteredCandidates]);

  const shortlistedCandidatesCount = useMemo(() => {
    return filteredCandidates.filter((c) => getNormalizedStage(c.status) === 'Shortlisted').length;
  }, [filteredCandidates]);

  const interviewsCount = useMemo(() => {
    return filteredCandidates.filter((c) => getNormalizedStage(c.status) === 'Interview').length;
  }, [filteredCandidates]);

  const hiredCount = useMemo(() => {
    return filteredCandidates.filter((c) => getNormalizedStage(c.status) === 'Hired').length;
  }, [filteredCandidates]);

  const rejectedCount = useMemo(() => {
    return filteredCandidates.filter((c) => getNormalizedStage(c.status) === 'Rejected').length;
  }, [filteredCandidates]);

  // AI-derived qualification metrics (clearly separated from recruiter stages)
  const aiHighAlignmentCount = useMemo(() => {
    return filteredCandidates.filter(
      (c) => c.alignmentLevel === 'Strong alignment' || c.alignmentLevel === 'Good alignment'
    ).length;
  }, [filteredCandidates]);

  // Recruitment Pipeline funnel steps across all 6 canonical stages
  const funnelStages = [
    {
      id: 'New',
      label: 'New Applications',
      count: newCount,
      color: 'bg-blue-600',
      lightColor: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Awaiting recruiter review',
    },
    {
      id: 'Reviewed',
      label: 'Reviewed',
      count: reviewedCount,
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: 'Qualifications & evidence vetted',
    },
    {
      id: 'Shortlisted',
      label: 'Shortlisted',
      count: shortlistedCandidatesCount,
      color: 'bg-amber-600',
      lightColor: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Selected for hiring team review',
    },
    {
      id: 'Interview',
      label: 'Interview in Progress',
      count: interviewsCount,
      color: 'bg-purple-600',
      lightColor: 'bg-purple-50 text-purple-700 border-purple-200',
      description: 'Active interview evaluations',
    },
    {
      id: 'Hired',
      label: 'Hired',
      count: hiredCount,
      color: 'bg-emerald-600',
      lightColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Offer accepted & confirmed',
    },
    {
      id: 'Rejected',
      label: 'Rejected / Archived',
      count: rejectedCount,
      color: 'bg-rose-500',
      lightColor: 'bg-rose-50 text-rose-700 border-rose-200',
      description: 'Declined or concluded for opening',
    },
  ];

  // Candidates grouped by job for requisition breakdown
  const jobMetrics = useMemo(() => {
    return jobs.map((job) => {
      const jobCands = candidates.filter((c) => c.jobId === job.id);
      const strongCount = jobCands.filter((c) => c.alignmentLevel === 'Strong alignment').length;
      const shortlistedCount = jobCands.filter((c) => getNormalizedStage(c.status) === 'Shortlisted').length;
      const interviewCount = jobCands.filter((c) => getNormalizedStage(c.status) === 'Interview').length;
      const hiredCount = jobCands.filter((c) => getNormalizedStage(c.status) === 'Hired').length;
      return {
        job,
        total: jobCands.length,
        strongCount,
        shortlistedCount,
        interviewCount,
        hiredCount,
      };
    }).sort((a, b) => b.total - a.total);
  }, [jobs, candidates]);

  // Qualification alignment breakdown
  const alignmentDistribution = useMemo(() => {
    const levels: Record<string, number> = {
      'Strong alignment': 0,
      'Good alignment': 0,
      'Moderate alignment': 0,
      'Limited evidence': 0,
      'Insufficient evidence': 0,
    };

    filteredCandidates.forEach((c) => {
      if (levels[c.alignmentLevel] !== undefined) {
        levels[c.alignmentLevel]++;
      }
    });

    return [
      { label: 'Strong Alignment', count: levels['Strong alignment'], color: 'bg-emerald-500', text: 'text-emerald-700' },
      { label: 'Good Alignment', count: levels['Good alignment'], color: 'bg-blue-500', text: 'text-blue-700' },
      { label: 'Moderate Alignment', count: levels['Moderate alignment'], color: 'bg-amber-500', text: 'text-amber-700' },
      { label: 'Limited / Insufficient', count: levels['Limited evidence'] + levels['Insufficient evidence'], color: 'bg-slate-400', text: 'text-slate-600' },
    ];
  }, [filteredCandidates]);

  // Recent activity list (sorted strictly by timestamp)
  const recentActivities = useMemo(() => {
    return [...filteredCandidates]
      .sort((a, b) => (b.createdAt || b.analyzedAt || '').localeCompare(a.createdAt || a.analyzedAt || ''))
      .slice(0, 6);
  }, [filteredCandidates]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Executive Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-8 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-500" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Executive Recruitment Intelligence
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Talent Pipeline & Hiring Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Real-time executive oversight across active job requisitions, candidate evidence screening, and interview pipeline velocity.
            </p>
          </div>

          {/* Quick Actions & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onViewJobs}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-slate-500" />
              <span>Jobs Overview</span>
            </button>
            <button
              onClick={onViewCandidates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Candidate Pool</span>
            </button>
            <button
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Screen Candidate</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Job */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">Filter by Job:</span>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="all">All Requisitions ({jobs.length})</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.department}) {job.status === 'Closed' ? '· Closed' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Stage */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Stage:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="all">All Stages</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    Stage: {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-0.5 rounded-md border border-slate-200/80 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTimeframe('all')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeframe === 'all'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('30d')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeframe === '30d'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('7d')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeframe === '7d'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>
            </div>
          </div>

          {/* Active Filter Scope Summary */}
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Showing verified metrics for</span>
            <span className="font-semibold text-slate-700">
              {selectedJob ? selectedJob.title : 'All Active & Stored Openings'}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Jobs Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Job Requisitions
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {totalActiveJobs}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{totalJobsCount} total recorded roles</span>
            <span className="text-blue-700 font-semibold">{totalJobsCount - totalActiveJobs} closed</span>
          </div>
        </div>

        {/* Total Candidates Evaluated */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Candidates Evaluated
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {totalCandidatesCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Stored in cloud Firestore</span>
            <span className="text-indigo-700 font-semibold">{analyses.length} raw analyses</span>
          </div>
        </div>

        {/* Shortlisted Candidates */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Candidates Shortlisted
              </div>
              <div className="text-3xl font-extrabold text-amber-600 mt-2">
                {shortlistedCandidatesCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Stage: Shortlisted</span>
            <span className="text-emerald-700 font-semibold">
              {aiHighAlignmentCount} AI high-match
            </span>
          </div>
        </div>

        {/* Interviews & Hires */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Interviews & Hires
              </div>
              <div className="text-3xl font-extrabold text-purple-700 mt-2 flex items-baseline gap-2">
                <span>{interviewsCount}</span>
                <span className="text-base font-normal text-slate-400">/</span>
                <span className="text-emerald-700">{hiredCount}</span>
                <span className="text-xs font-semibold text-emerald-600 uppercase">Hired</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{interviewsCount} active interview loop(s)</span>
            <span className="text-emerald-700 font-semibold">{hiredCount} offer(s) accepted</span>
          </div>
        </div>
      </div>

      {/* 2. Main Analytics Section: Pipeline Funnel & Alignment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruitment Pipeline Funnel (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-700" />
                <span>Candidate Pipeline Funnel by Stage</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution of candidate records across current verification lifecycle stages.
              </p>
            </div>
            <button
              onClick={onViewCandidates}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
            >
              <span>Manage Candidates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {totalCandidatesCount === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-600">
                <p className="font-semibold text-slate-800">No candidates in pipeline</p>
                <p className="text-slate-500 mt-1">
                  Candidates will appear in the pipeline as resumes are uploaded and screened.
                </p>
              </div>
              <button
                onClick={onStartNewAnalysis}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded text-xs transition-colors cursor-pointer"
              >
                Screen Candidate Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {funnelStages.map((stage, idx) => {
                const percentage =
                  totalCandidatesCount > 0 ? Math.round((stage.count / totalCandidatesCount) * 100) : 0;
                return (
                  <div key={stage.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{stage.label}</span>
                        <span className="text-[11px] text-slate-400">· {stage.description}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <strong className="text-slate-900 text-xs font-bold">{stage.count}</strong>
                        <span className="text-slate-400 text-[11px]">({percentage}%)</span>
                      </div>
                    </div>

                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${stage.color} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.max(percentage, stage.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Executive Note on Hiring Status */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">Recruitment Data Integrity</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Stage progression strictly reflects confirmed Firestore candidate documents (<code className="text-slate-700">Screened</code>, <code className="text-slate-700">Reviewing</code>, <code className="text-slate-700">Interview</code>, <code className="text-slate-700">Archived</code>). Mihora never infers hypothetical hires or synthetic progression metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Qualification & Alignment Distribution (1 Col) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Evidence Alignment</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of verified candidate qualification matches.
            </p>
          </div>

          {totalCandidatesCount === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
              No alignment data available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {alignmentDistribution.map((item) => {
                const pct =
                  totalCandidatesCount > 0 ? Math.round((item.count / totalCandidatesCount) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className={`font-mono font-bold ${item.text}`}>
                        {item.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.max(pct, item.count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700">Standardized Verification Rule</div>
              <p className="text-[11px] leading-relaxed">
                Rankings represent objective match between verified resume text and role specifications. Unstated requirements are never marked as failed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Job-Level Recruitment Progress & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job-Level Breakdown Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <span>Job-Level Recruitment Progress</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Candidate pipeline volume and quality indicators for each job requisition.
              </p>
            </div>
            <button
              onClick={onViewJobs}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
            >
              <span>Manage Requisitions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {jobMetrics.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 space-y-2">
              <p>No job requisitions recorded in workspace.</p>
              <button
                onClick={onViewJobs}
                className="px-3 py-1.5 bg-blue-700 text-white font-medium rounded text-xs"
              >
                Create Job Requisition
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Job Title & Department</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Candidates</th>
                    <th className="p-3 text-center">Shortlisted</th>
                    <th className="p-3 text-center">Interviews</th>
                    <th className="p-3 text-center">Hired</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobMetrics.map(({ job, total, shortlistedCount, interviewCount, hiredCount }) => (
                    <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 max-w-[200px]">
                        <div className="font-bold text-slate-900 truncate">{job.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{job.department}</span>
                          {job.location && <span>· {job.location}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                            job.status === 'Open'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {total}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-amber-700">
                        {shortlistedCount}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-purple-700">
                        {interviewCount}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-emerald-700">
                        {hiredCount}
                      </td>
                      <td className="p-3 text-right">
                        {onStartAnalysisForJob && job.status === 'Open' && (
                          <button
                            onClick={() => onStartAnalysisForJob(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Analyze</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Candidate Activity (1 Col) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-700" />
                <span>Recent Activity</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest candidate screenings and evaluations.
              </p>
            </div>
            <button
              onClick={onViewCandidates}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
              No recent candidate activities.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden">
              {recentActivities.map((cand) => (
                <div
                  key={cand.id}
                  className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {cand.name}
                      </span>
                      {(() => {
                        const stage = getNormalizedStage(cand.status);
                        const badgeStyle = 
                          stage === 'Hired'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : stage === 'Interview'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : stage === 'Shortlisted'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : stage === 'Reviewed'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : stage === 'Rejected'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200';
                        return (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${badgeStyle}`}>
                            {stage}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <span>{cand.jobTitle}</span>
                      {cand.location && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-slate-600">
                            <MapPin className="w-3 h-3 text-blue-600" />
                            {cand.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCandidateAnalysis(cand.analysisId)}
                    className="p-1.5 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors shrink-0"
                    title="View candidate analysis"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
