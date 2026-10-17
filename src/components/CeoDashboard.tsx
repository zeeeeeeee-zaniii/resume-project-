import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Users,
  CheckCircle2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  TrendingUp,
  MapPin,
  Clock,
  Filter,
  ArrowRight,
  ChevronRight,
  Award,
  Layers,
  FileText,
  BarChart3,
  Building2,
  Video,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  Search,
  HelpCircle,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import {
  AnalysisResult,
  CandidateRecord,
  Job,
  CandidateStage,
  CandidateInterview,
  getNormalizedStage,
  PIPELINE_STAGES
} from '../types';

export interface CeoDashboardProps {
  jobs: Job[];
  candidates: CandidateRecord[];
  analyses: AnalysisResult[];
  onViewJobs: () => void;
  onViewCandidates: () => void;
  onStartNewAnalysis: () => void;
  onSelectCandidateAnalysis: (analysisId: string) => void;
  onStartAnalysisForJob?: (job: Job) => void;
  onViewReminders?: () => void;
}

export type TimeframeFilter = 'all' | '7d' | '30d' | '90d' | 'ytd';

export const CeoDashboard: React.FC<CeoDashboardProps> = ({
  jobs,
  candidates,
  analyses,
  onViewJobs,
  onViewCandidates,
  onStartNewAnalysis,
  onSelectCandidateAnalysis,
  onStartAnalysisForJob,
  onViewReminders,
}) => {
  // Filter state
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [interviewTab, setInterviewTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Filter candidates by timeframe, job, and stage
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
          if (timeframe === '90d' && diffDays > 90) return false;
          if (timeframe === 'ytd') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            if (itemDate < startOfYear) return false;
          }
        }
      }

      return true;
    });
  }, [candidates, selectedJobId, timeframe, statusFilter]);

  // Filter jobs by timeframe if active (for KPI consistency)
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (selectedJobId !== 'all' && job.id !== selectedJobId) {
        return false;
      }

      if (timeframe !== 'all') {
        const jobDate = new Date(job.createdAt);
        if (!isNaN(jobDate.getTime())) {
          const now = new Date();
          const diffDays = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24);
          if (timeframe === '7d' && diffDays > 7) return false;
          if (timeframe === '30d' && diffDays > 30) return false;
          if (timeframe === '90d' && diffDays > 90) return false;
          if (timeframe === 'ytd') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            if (jobDate < startOfYear) return false;
          }
        }
      }

      return true;
    });
  }, [jobs, selectedJobId, timeframe]);

  // Job Requisition status metrics (using actual job status model: 'Draft' | 'Open' | 'On Hold' | 'Closed')
  const totalOpenJobs = useMemo(() => jobs.filter((j) => j.status === 'Open').length, [jobs]);
  const totalClosedJobs = useMemo(() => jobs.filter((j) => j.status === 'Closed').length, [jobs]);
  const totalOnHoldJobs = useMemo(() => jobs.filter((j) => j.status === 'On Hold').length, [jobs]);
  const totalDraftJobs = useMemo(() => jobs.filter((j) => j.status === 'Draft').length, [jobs]);
  const totalJobsCount = jobs.length;

  const totalCandidatesCount = filteredCandidates.length;

  // Breakdown across all 6 canonical pipeline stages
  const stageCounts = useMemo(() => {
    const counts: Record<CandidateStage, number> = {
      New: 0,
      Reviewed: 0,
      Shortlisted: 0,
      Interview: 0,
      Hired: 0,
      Rejected: 0,
    };

    filteredCandidates.forEach((c) => {
      const stage = getNormalizedStage(c.status);
      counts[stage] = (counts[stage] || 0) + 1;
    });

    return counts;
  }, [filteredCandidates]);

  // Extract all interview records across candidates
  const allInterviewRecords = useMemo(() => {
    const list: {
      interview: CandidateInterview;
      candidate: CandidateRecord;
    }[] = [];

    candidates.forEach((cand) => {
      // Respect job filter if set
      if (selectedJobId !== 'all' && cand.jobId !== selectedJobId) {
        return;
      }

      (cand.interviews || []).forEach((interview) => {
        list.push({ interview, candidate: cand });
      });
    });

    return list;
  }, [candidates, selectedJobId]);

  // Timeframe-filtered interview records
  const filteredInterviews = useMemo(() => {
    if (timeframe === 'all') return allInterviewRecords;

    const now = new Date();
    return allInterviewRecords.filter(({ interview }) => {
      const rawDate = interview.scheduledAt || interview.createdAt;
      if (!rawDate) return true;
      const itemDate = new Date(rawDate);
      if (isNaN(itemDate.getTime())) return true;
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
      if (timeframe === '7d') return diffDays <= 7;
      if (timeframe === '30d') return diffDays <= 30;
      if (timeframe === '90d') return diffDays <= 90;
      if (timeframe === 'ytd') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return itemDate >= startOfYear;
      }
      return true;
    });
  }, [allInterviewRecords, timeframe]);

  // Upcoming interviews vs Completed interviews
  const upcomingInterviews = useMemo(() => {
    return filteredInterviews
      .filter(({ interview }) => interview.status === 'Scheduled' || interview.status === 'Rescheduled')
      .sort((a, b) => {
        const dateA = new Date(a.interview.scheduledAt || a.interview.createdAt).getTime();
        const dateB = new Date(b.interview.scheduledAt || b.interview.createdAt).getTime();
        return dateA - dateB;
      });
  }, [filteredInterviews]);

  const completedInterviews = useMemo(() => {
    return filteredInterviews
      .filter(({ interview }) => interview.status === 'Completed')
      .sort((a, b) => {
        const dateA = new Date(a.interview.scheduledAt || a.interview.createdAt).getTime();
        const dateB = new Date(b.interview.scheduledAt || b.interview.createdAt).getTime();
        return dateB - dateA;
      });
  }, [filteredInterviews]);

  const cancelledInterviews = useMemo(() => {
    return filteredInterviews.filter(({ interview }) => interview.status === 'Cancelled');
  }, [filteredInterviews]);

  // 6 Pipeline Funnel Stages
  const pipelineFunnel = useMemo(() => {
    return [
      {
        id: 'New' as CandidateStage,
        label: 'New Applications',
        count: stageCounts.New,
        color: 'bg-blue-600',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        desc: 'Awaiting initial recruiter review',
      },
      {
        id: 'Reviewed' as CandidateStage,
        label: 'Reviewed',
        count: stageCounts.Reviewed,
        color: 'bg-indigo-600',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        desc: 'Resume evidence vetted against requirements',
      },
      {
        id: 'Shortlisted' as CandidateStage,
        label: 'Shortlisted',
        count: stageCounts.Shortlisted,
        color: 'bg-amber-600',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        desc: 'Selected for hiring manager consideration',
      },
      {
        id: 'Interview' as CandidateStage,
        label: 'Interview in Progress',
        count: stageCounts.Interview,
        color: 'bg-purple-600',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        desc: 'Active interview loops underway',
      },
      {
        id: 'Hired' as CandidateStage,
        label: 'Hired',
        count: stageCounts.Hired,
        color: 'bg-emerald-600',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        desc: 'Offer accepted and placement confirmed',
      },
      {
        id: 'Rejected' as CandidateStage,
        label: 'Rejected / Archived',
        count: stageCounts.Rejected,
        color: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        desc: 'Not progressing for current opening',
      },
    ];
  }, [stageCounts]);

  // Department-Level Breakdown (computed strictly when reliable data exists)
  const departmentMetrics = useMemo(() => {
    const deptMap = new Map<
      string,
      {
        department: string;
        openJobs: number;
        closedJobs: number;
        totalCandidates: number;
        shortlistedCount: number;
        interviewCount: number;
        hiredCount: number;
      }
    >();

    // 1. Map departments from jobs
    jobs.forEach((job) => {
      const raw = (job.department || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      const existing = deptMap.get(key) || {
        department: raw,
        openJobs: 0,
        closedJobs: 0,
        totalCandidates: 0,
        shortlistedCount: 0,
        interviewCount: 0,
        hiredCount: 0,
      };
      if (job.status === 'Open') {
        existing.openJobs++;
      } else {
        existing.closedJobs++;
      }
      deptMap.set(key, existing);
    });

    // 2. Map candidates into department buckets
    filteredCandidates.forEach((cand) => {
      const raw = (cand.jobDepartment || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      const existing = deptMap.get(key) || {
        department: raw,
        openJobs: 0,
        closedJobs: 0,
        totalCandidates: 0,
        shortlistedCount: 0,
        interviewCount: 0,
        hiredCount: 0,
      };
      existing.totalCandidates++;
      const stage = getNormalizedStage(cand.status);
      if (stage === 'Shortlisted') existing.shortlistedCount++;
      if (stage === 'Interview') existing.interviewCount++;
      if (stage === 'Hired') existing.hiredCount++;
      deptMap.set(key, existing);
    });

    // Reliable check: filter out empty, 'general', 'unspecified'
    const reliable = Array.from(deptMap.values()).filter(
      (d) =>
        d.department.toLowerCase() !== 'general' &&
        d.department.toLowerCase() !== 'unspecified' &&
        (d.openJobs > 0 || d.totalCandidates > 0)
    );

    return reliable.sort((a, b) => b.totalCandidates - a.totalCandidates || b.openJobs - a.openJobs);
  }, [jobs, filteredCandidates]);

  const hasReliableDepartmentData = departmentMetrics.length > 0;

  // Job Requisition Breakdown Table
  const jobMetrics = useMemo(() => {
    return jobs
      .map((job) => {
        const jobCands = candidates.filter((c) => c.jobId === job.id);
        const shortlisted = jobCands.filter((c) => getNormalizedStage(c.status) === 'Shortlisted').length;
        const inInterview = jobCands.filter((c) => getNormalizedStage(c.status) === 'Interview').length;
        const hired = jobCands.filter((c) => getNormalizedStage(c.status) === 'Hired').length;
        const strongAlignment = jobCands.filter((c) => c.alignmentLevel === 'Strong alignment').length;

        return {
          job,
          total: jobCands.length,
          shortlisted,
          inInterview,
          hired,
          strongAlignment,
        };
      })
      .sort((a, b) => {
        if (a.job.status !== b.job.status) {
          return a.job.status === 'Open' ? -1 : 1;
        }
        return b.total - a.total;
      });
  }, [jobs, candidates]);

  // Evidence Alignment Breakdown
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
      {
        label: 'Limited / Insufficient',
        count: levels['Limited evidence'] + levels['Insufficient evidence'],
        color: 'bg-slate-400',
        text: 'text-slate-600',
      },
    ];
  }, [filteredCandidates]);

  // Recent candidate activity
  const recentActivities = useMemo(() => {
    return [...filteredCandidates]
      .sort((a, b) => (b.createdAt || b.analyzedAt || '').localeCompare(a.createdAt || a.analyzedAt || ''))
      .slice(0, 5);
  }, [filteredCandidates]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Format date helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Unspecified date';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Executive Header & Control Hub */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-8 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Recruitment Analytics & Operations
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Talent Acquisition & Pipeline Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Real-time recruitment oversight across job requisitions, candidate pipeline progression, and scheduled interview rounds.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onViewJobs}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-slate-500" />
              <span>Job Requisitions</span>
            </button>
            <button
              onClick={onViewCandidates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Candidates Pipeline</span>
            </button>
            <button
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Screen Resume</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Job */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">Requisition:</span>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Requisitions ({jobs.length})</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.department}) {job.status !== 'Open' ? `· [${job.status}]` : ''}
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
                className="bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Stages ({filteredCandidates.length})</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    Stage: {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Practical Date Range Filters */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-0.5 rounded-md border border-slate-200/80 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTimeframe('all')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timeframe === 'all'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('7d')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timeframe === '7d'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7d
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('30d')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timeframe === '30d'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 30d
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('90d')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timeframe === '90d'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 90d
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('ytd')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timeframe === 'ytd'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Year to Date
              </button>
            </div>
          </div>

          {/* Active Filter Scope Summary */}
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Scope:</span>
            <span className="font-semibold text-slate-800">
              {selectedJob ? selectedJob.title : 'All Active & Recorded Roles'}
            </span>
            {timeframe !== 'all' && (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-medium">
                {timeframe === '7d'
                  ? 'Past 7 Days'
                  : timeframe === '30d'
                  ? 'Past 30 Days'
                  : timeframe === '90d'
                  ? 'Past 90 Days'
                  : 'Current Year (YTD)'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Candidates Evaluated */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Candidates Evaluated
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                {totalCandidatesCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Stored in Firestore</span>
            <span className="text-blue-700 font-semibold">{analyses.length} total analyses</span>
          </div>
        </div>

        {/* Active Job Requisitions */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Job Requisitions
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                {totalOpenJobs}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{totalJobsCount} total requisitions</span>
            <span className="text-slate-600 font-medium">
              {totalClosedJobs} closed{totalOnHoldJobs > 0 ? ` · ${totalOnHoldJobs} on hold` : ''}
            </span>
          </div>
        </div>

        {/* Shortlisted Candidates */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Shortlisted Candidates
              </div>
              <div className="text-3xl font-extrabold text-amber-600 mt-2 font-mono">
                {stageCounts.Shortlisted}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Stage: Shortlisted</span>
            <span className="text-emerald-700 font-semibold">
              {stageCounts.Hired} hired to date
            </span>
          </div>
        </div>

        {/* Saved Interview Rounds (Upcoming & Completed) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Interview Operations
              </div>
              <div className="text-3xl font-extrabold text-purple-700 mt-2 flex items-baseline gap-2 font-mono">
                <span>{upcomingInterviews.length}</span>
                <span className="text-sm font-normal text-slate-400">up</span>
                <span className="text-base font-normal text-slate-300">/</span>
                <span className="text-emerald-700">{completedInterviews.length}</span>
                <span className="text-sm font-normal text-slate-400">done</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{filteredInterviews.length} total recorded round(s)</span>
            <span className="text-purple-700 font-semibold">
              {upcomingInterviews.length > 0 ? 'Active schedule' : 'No pending loops'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Pipeline Funnel by Stage & Evidence Alignment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Pipeline Funnel across all 6 Canonical Stages (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-700" />
                <span>Candidate Pipeline Breakdown by Stage</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Full lifecycle distribution across New, Reviewed, Shortlisted, Interview, Hired, and Rejected.
              </p>
            </div>
            <button
              onClick={onViewCandidates}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Open Candidate Board</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {totalCandidatesCount === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-600">
                <p className="font-semibold text-slate-800">No candidates match current filters</p>
                <p className="text-slate-500 mt-1">
                  Adjust date or requisition filters above, or screen candidate resumes to populate the pipeline.
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
              {pipelineFunnel.map((stage, idx) => {
                const percentage =
                  totalCandidatesCount > 0 ? Math.round((stage.count / totalCandidatesCount) * 100) : 0;
                const isSelected = statusFilter === stage.id;

                return (
                  <div
                    key={stage.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50/40'
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter(isSelected ? 'all' : stage.id)}
                          className="font-bold text-slate-900 hover:text-blue-700 text-left cursor-pointer"
                        >
                          {stage.label}
                        </button>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          · {stage.desc}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <strong className="text-slate-900 text-xs font-bold">{stage.count}</strong>
                        <span className="text-slate-400 text-[11px]">({percentage}%)</span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${stage.color} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.max(percentage, stage.count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pipeline Data Integrity Notice */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">Recruiter Governance & Factual Grounding</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Stage progression strictly reflects confirmed Firestore candidate documents. Mihora never calculates hypothetical hires or synthetic conversion metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Evidence Alignment Distribution (1 Col) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Evidence Alignment</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evidence ratings verified against job specifications.
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
              <div className="font-semibold text-slate-700">Verification Rule</div>
              <p className="text-[11px] leading-relaxed">
                Rankings represent objective match between verified resume text and role specifications. Unstated requirements are never marked as failed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interview Operations & Schedule Intelligence */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-700" />
              <span>Interview Operations & Saved Rounds</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upcoming scheduled rounds, interviewer assignments, and historical interview completions.
            </p>
          </div>

          {/* Sub-Tabs: Upcoming vs Completed & Reminders Link */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInterviewTab('upcoming')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  interviewTab === 'upcoming'
                    ? 'bg-white text-purple-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>Upcoming ({upcomingInterviews.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setInterviewTab('completed')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  interviewTab === 'completed'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Completed ({completedInterviews.length})</span>
              </button>
            </div>

            {onViewReminders && (
              <button
                type="button"
                onClick={onViewReminders}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="View actionable interview & hiring reminders"
              >
                <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                <span>Hiring Reminders</span>
              </button>
            )}
          </div>
        </div>

        {/* Interview Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-purple-50/70 border border-purple-200/60 rounded-lg">
            <div className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
              Upcoming Rounds
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-1 font-mono">
              {upcomingInterviews.length}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5">Awaiting execution</div>
          </div>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-lg">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Completed Rounds
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-1 font-mono">
              {completedInterviews.length}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Feedback saved</div>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Rescheduled
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1 font-mono">
              {filteredInterviews.filter(({ interview }) => interview.status === 'Rescheduled').length}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Adjusted times</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Cancelled
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">
              {cancelledInterviews.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Archived loops</div>
          </div>
        </div>

        {/* Schedule List */}
        {interviewTab === 'upcoming' ? (
          upcomingInterviews.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs text-slate-600">
                <p className="font-semibold text-slate-800">No upcoming interviews scheduled</p>
                <p className="text-slate-500 mt-0.5">
                  Recruiters can schedule interviews directly from candidate cards in the Candidates view.
                </p>
              </div>
              <button
                onClick={onViewCandidates}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs cursor-pointer"
              >
                <span>View Candidates Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Candidate & Role</th>
                    <th className="p-3">Interview Round</th>
                    <th className="p-3">Scheduled Date & Time</th>
                    <th className="p-3">Interviewer(s)</th>
                    <th className="p-3">Meeting / Location</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcomingInterviews.map(({ interview, candidate }) => (
                    <tr key={interview.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{candidate.name}</div>
                        <div className="text-[11px] text-slate-500">{candidate.jobTitle}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px]">
                          {interview.interviewType}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {interview.durationMinutes} minutes
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {formatDate(interview.scheduledAt)}
                      </td>
                      <td className="p-3 text-slate-600">
                        {interview.interviewers && interview.interviewers.length > 0 ? (
                          <span>{interview.interviewers.join(', ')}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[180px] truncate">
                        {interview.meetingLinkOrLocation ? (
                          <div className="flex items-center gap-1 text-blue-700">
                            <Video className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{interview.meetingLinkOrLocation}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          {interview.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : completedInterviews.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-1 text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">No completed interviews recorded yet</p>
            <p className="text-slate-400">
              When recruiters complete interview rounds and save feedback notes, records will show here.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Candidate & Role</th>
                  <th className="p-3">Interview Round</th>
                  <th className="p-3">Completed Date</th>
                  <th className="p-3">Interviewer(s)</th>
                  <th className="p-3">Recruiter Feedback / Notes</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedInterviews.map(({ interview, candidate }) => (
                  <tr key={interview.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{candidate.name}</div>
                      <div className="text-[11px] text-slate-500">{candidate.jobTitle}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                        {interview.interviewType}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      {formatDate(interview.scheduledAt || interview.updatedAt)}
                    </td>
                    <td className="p-3 text-slate-600">
                      {interview.interviewers && interview.interviewers.length > 0 ? (
                        <span>{interview.interviewers.join(', ')}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[240px]">
                      {interview.feedbackNotes ? (
                        <p className="text-[11px] text-slate-700 line-clamp-2">
                          {interview.feedbackNotes}
                        </p>
                      ) : (
                        <span className="text-slate-400 italic">No notes logged</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Department-Level Breakdown (Shown when reliable department data exists) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>Department Recruitment Breakdown</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Candidate volume and pipeline velocity across organizational departments.
            </p>
          </div>
          {hasReliableDepartmentData && (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
              {departmentMetrics.length} Active Departments
            </span>
          )}
        </div>

        {hasReliableDepartmentData ? (
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Department Name</th>
                  <th className="p-3 text-center">Active Jobs</th>
                  <th className="p-3 text-center">Total Candidates</th>
                  <th className="p-3 text-center">Shortlisted</th>
                  <th className="p-3 text-center">Interviews</th>
                  <th className="p-3 text-center">Hired</th>
                  <th className="p-3">Pipeline Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departmentMetrics.map((dept) => {
                  const pct =
                    totalCandidatesCount > 0
                      ? Math.round((dept.totalCandidates / totalCandidatesCount) * 100)
                      : 0;

                  return (
                    <tr key={dept.department} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{dept.department}</div>
                        <div className="text-[11px] text-slate-400">
                          {dept.openJobs} open role(s) · {dept.closedJobs} closed
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {dept.openJobs}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700">
                        {dept.totalCandidates}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-amber-700">
                        {dept.shortlistedCount}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-purple-700">
                        {dept.interviewCount}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-emerald-700">
                        {dept.hiredCount}
                      </td>
                      <td className="p-3 w-40">
                        <div className="space-y-1">
                          <div className="text-[11px] font-mono text-slate-600 text-right">
                            {pct}%
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${Math.max(pct, dept.totalCandidates > 0 ? 5 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-600 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-slate-800">Department Categorization Notice</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Department-level metrics automatically appear once job requisitions specify distinct organizational departments (e.g. Engineering, Product, Sales, Talent). Currently recorded roles use general or unassigned departments.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 6. Job-Level Recruitment Requisition Performance Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job Requisition Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <span>Job-Level Requisition Performance</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Volume, qualification quality, and pipeline status by role.
              </p>
            </div>
            <button
              onClick={onViewJobs}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Jobs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {jobMetrics.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 space-y-2">
              <p>No job requisitions recorded in workspace.</p>
              <button
                onClick={onViewJobs}
                className="px-3 py-1.5 bg-blue-700 text-white font-medium rounded text-xs cursor-pointer"
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
                  {jobMetrics.map(({ job, total, shortlisted, inInterview, hired }) => (
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
                              : job.status === 'On Hold'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : job.status === 'Draft'
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {total}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-amber-700">
                        {shortlisted}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-purple-700">
                        {inInterview}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-emerald-700">
                        {hired}
                      </td>
                      <td className="p-3 text-right">
                        {onStartAnalysisForJob && job.status === 'Open' && (
                          <button
                            onClick={() => onStartAnalysisForJob(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Screen</span>
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
                Latest evaluations in your candidate pool.
              </p>
            </div>
            <button
              onClick={onViewCandidates}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
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
                    className="p-1.5 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors shrink-0 cursor-pointer"
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

// Also export as RecruitmentAnalytics for modular clarity
export const RecruitmentAnalytics = CeoDashboard;
