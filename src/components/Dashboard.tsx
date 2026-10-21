import React, { useMemo } from 'react';
import { 
  FileText, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  HelpCircle, 
  UserCheck, 
  Briefcase,
  Users,
  Plus,
  Sparkles,
  MapPin,
  CalendarClock,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { AnalysisResult, Job, CandidateRecord } from '../types';
import { computeHiringReminders } from '../lib/reminder-helpers';
import { RecruiterActionCenter } from './RecruiterActionCenter';

interface DashboardProps {
  onStartNewAnalysis: () => void;
  onViewCandidates: () => void;
  onViewJobs: () => void;
  onViewAnalytics?: () => void;
  onViewReminders?: () => void;
  onViewAnalysisResult: (result: AnalysisResult) => void;
  onStartAnalysisForJob?: (job: Job) => void;
  onOpenCandidateInterviews?: (candidateId: string) => void;
  recentResults: AnalysisResult[];
  candidates?: CandidateRecord[];
  jobs: Job[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewAnalysis,
  onViewCandidates,
  onViewJobs,
  onViewAnalytics,
  onViewReminders,
  onViewAnalysisResult,
  onStartAnalysisForJob,
  onOpenCandidateInterviews,
  recentResults,
  candidates = [],
  jobs,
}) => {
  const openJobs = jobs.filter((j) => j.status === 'Open');
  const strongAlignments = recentResults.filter(
    (r) => r.overallRoleAlignment.level === 'Strong alignment'
  ).length;

  const reminders = useMemo(() => {
    return computeHiringReminders(candidates, jobs, recentResults);
  }, [candidates, jobs, recentResults]);

  const urgentReminders = useMemo(() => {
    return reminders.filter(
      (r) => r.urgency === 'overdue' || r.urgency === 'today' || r.category === 'missing_feedback'
    );
  }, [reminders]);

  const hiringVelocity = useMemo(() => {
    // Candidates who reached Interview stage
    const interviewCandidates = candidates.filter((c) => {
      const isInterview = c.status === 'Interview' || (c.interviews && c.interviews.length > 0);
      if (!isInterview) return false;
      if (!c.createdAt || !c.updatedAt) return false;
      const createdTime = new Date(c.createdAt).getTime();
      const updatedTime = new Date(c.updatedAt).getTime();
      return !isNaN(createdTime) && !isNaN(updatedTime) && updatedTime >= createdTime;
    });

    if (interviewCandidates.length === 0) {
      return {
        formatted: '—',
        detail: 'No candidates in interview yet',
        count: 0,
      };
    }

    const totalDiffMs = interviewCandidates.reduce((sum, c) => {
      const createdTime = new Date(c.createdAt).getTime();
      const updatedTime = new Date(c.updatedAt).getTime();
      return sum + (updatedTime - createdTime);
    }, 0);

    const avgDiffMs = totalDiffMs / interviewCandidates.length;
    const avgDays = avgDiffMs / (1000 * 60 * 60 * 24);

    if (avgDays < 1) {
      const avgHours = Math.round(avgDiffMs / (1000 * 60 * 60));
      return {
        formatted: avgHours <= 1 ? '< 1 day' : `${avgHours} hrs`,
        detail: `New → Interview (${interviewCandidates.length} candidate${interviewCandidates.length === 1 ? '' : 's'})`,
        count: interviewCandidates.length,
      };
    }

    const formattedDays = avgDays >= 10 ? Math.round(avgDays) : avgDays.toFixed(1);
    return {
      formatted: `${formattedDays} ${Number(formattedDays) === 1 ? 'day' : 'days'}`,
      detail: `New → Interview (${interviewCandidates.length} candidate${interviewCandidates.length === 1 ? '' : 's'})`,
      count: interviewCandidates.length,
    };
  }, [candidates]);

  return (
    <div className="space-y-8 pb-16">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-8 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Internal Talent Screening System
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Mihora Resume Intelligence
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Screen candidate resumes against verified job requisitions with evidence-based verification and Candidate Location Intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onViewReminders && (
              <button
                onClick={onViewReminders}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <CalendarClock className="w-4 h-4 text-purple-600" />
                <span>Reminders</span>
                {reminders.length > 0 && (
                  <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-mono">
                    {reminders.length}
                  </span>
                )}
              </button>
            )}

            {onViewAnalytics && (
              <button
                onClick={onViewAnalytics}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Users className="w-4 h-4 text-blue-700" />
                <span>Recruitment Analytics</span>
              </button>
            )}

            <button
              onClick={onViewJobs}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-slate-500" />
              <span>Manage Jobs</span>
            </button>

            <button
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Screen Candidate</span>
            </button>
          </div>
        </div>

        {/* Real Metrics Banner (no fake numbers) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium">Active Job Requisitions</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{openJobs.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {jobs.length} total positions in workspace
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium">Screened Candidates</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{recentResults.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Backed by persistent Firestore records
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium">Strong Alignment Matches</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{strongAlignments}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Fully verified against core role criteria
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>Hiring Velocity</span>
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{hiringVelocity.formatted}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {hiringVelocity.detail}
            </div>
          </div>

          <div
            onClick={onViewReminders}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              reminders.length > 0
                ? 'bg-purple-50/80 border-purple-200 hover:bg-purple-100/60'
                : 'bg-slate-50/80 border-slate-200/70'
            }`}
          >
            <div className="text-xs text-purple-700 font-semibold flex items-center justify-between">
              <span>Hiring Reminders</span>
              <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{reminders.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {reminders.length === 0
                ? 'All debriefs & schedules current'
                : `${urgentReminders.length} priority action items`}
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Action Center */}
      <RecruiterActionCenter
        candidates={candidates}
        recentResults={recentResults}
        jobs={jobs}
        onViewAnalysisResult={onViewAnalysisResult}
        onViewCandidates={onViewCandidates}
        onOpenCandidateInterviews={onOpenCandidateInterviews}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Requisitions & Recent Screenings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Job Requisitions Section */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Active Job Requisitions
                </h2>
                <p className="text-xs text-slate-500">
                  Select a role to analyze candidates against its requirements.
                </p>
              </div>

              <button
                onClick={onViewJobs}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
              >
                <span>All Jobs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {openJobs.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 space-y-2">
                <p>No active job requisitions found.</p>
                <button
                  onClick={onViewJobs}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded text-xs transition-colors cursor-pointer"
                >
                  Create First Job
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden">
                {openJobs.slice(0, 4).map((job) => {
                  const candidateCount = recentResults.filter((r) => r.jobId === job.id).length;
                  return (
                    <div
                      key={job.id}
                      className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {job.title}
                          </span>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                            {job.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {job.location && <span>{job.location} · </span>}
                          <span>{candidateCount} screened {candidateCount === 1 ? 'candidate' : 'candidates'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onStartAnalysisForJob && (
                          <button
                            onClick={() => onStartAnalysisForJob(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Analyze</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Candidate Screenings */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Recent Candidate Screenings
                </h2>
                <p className="text-xs text-slate-500">
                  Latest evidence evaluations and role alignment analyses.
                </p>
              </div>

              <button
                onClick={onViewCandidates}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
              >
                <span>All Candidates</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentResults.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">No candidates screened yet</p>
                  <p className="text-slate-500">
                    Upload a real PDF or DOCX resume to perform evidence-based qualification verification.
                  </p>
                </div>
                <button
                  onClick={onStartNewAnalysis}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded text-xs transition-colors cursor-pointer"
                >
                  Screen Candidate Now
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden">
                {recentResults.slice(0, 5).map((result) => {
                  const candidateName = result.candidateOverview.detectedName || result.fileName;
                  return (
                    <div
                      key={result.id}
                      className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {candidateName}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs font-medium text-slate-600 truncate">
                            {result.roleSummary.jobTitle}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {result.candidateOverview.detectedLocation && (
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                              <MapPin className="w-3 h-3 text-blue-600" />
                              <span>{result.candidateOverview.detectedLocation}</span>
                              <span>·</span>
                            </span>
                          )}
                          <span className="text-blue-700 font-semibold">
                            {result.overallRoleAlignment.level}
                          </span>
                          <span>·</span>
                          <span>{result.analyzedAt}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onViewAnalysisResult(result)}
                        className="px-3 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors shrink-0"
                      >
                        View Analysis
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Screening Principles & Governance */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Screening Principles</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-800">Evidence-Based Verification</div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    Evaluations strictly reference actual text from the uploaded resume. No synthetic qualification inference.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-800">Unstated ≠ Missing</div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    "Not detected in resume" strictly means unevidenced in document text, guiding constructive interview inquiries.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-800">Human Decision Governance</div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    The analysis engine acts as an objective screening assistant. Hiring decisions remain exclusively with human recruiters.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
            <span className="font-semibold text-slate-800 block">Candidate Location Intelligence</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Detects explicit candidate location from contact headers and resume content to help talent teams assess geographic match without assumptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
