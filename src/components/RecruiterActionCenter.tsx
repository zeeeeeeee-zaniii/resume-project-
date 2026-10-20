import React, { useState, useMemo } from 'react';
import {
  Clock,
  Calendar,
  CalendarCheck,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  User,
  Sparkles,
  ExternalLink,
  FileText,
  MapPin,
  CheckCircle2,
  CalendarClock,
  Briefcase
} from 'lucide-react';
import {
  AnalysisResult,
  CandidateRecord,
  Job,
  CandidateInterview,
  InterviewSlotStatus,
  getNormalizedStage
} from '../types';
import {
  isSameDay,
  formatReminderDateTime,
  formatReminderRelative
} from '../lib/reminder-helpers';

export interface RecruiterActionCenterProps {
  candidates?: CandidateRecord[];
  recentResults: AnalysisResult[];
  jobs: Job[];
  onViewAnalysisResult: (result: AnalysisResult) => void;
  onViewCandidates: () => void;
  onOpenCandidateInterviews?: (candidateId: string) => void;
}

export interface PendingReviewItem {
  id: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  department: string;
  location?: string | null;
  alignmentLevel: string;
  screenedAt: string;
  analysis?: AnalysisResult;
  candidateRecord?: CandidateRecord;
}

export interface ActionCenterInterview {
  id: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDepartment: string;
  interviewType: CandidateInterview['interviewType'];
  interviewers: string[];
  scheduledAt: string;
  durationMinutes: number;
  meetingLinkOrLocation?: string;
  status: InterviewSlotStatus;
  feedbackNotes?: string;
  candidateRecord: CandidateRecord;
  matchingAnalysis?: AnalysisResult;
  scheduledMs: number;
  isValidDate: boolean;
}

type ActionCenterTab = 'all' | 'today' | 'pending' | 'upcoming' | 'past_due';

export const RecruiterActionCenter: React.FC<RecruiterActionCenterProps> = ({
  candidates = [],
  recentResults = [],
  jobs = [],
  onViewAnalysisResult,
  onViewCandidates,
  onOpenCandidateInterviews,
}) => {
  const [activeTab, setActiveTab] = useState<ActionCenterTab>('all');

  // Job Map for quick lookup
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [jobs]);

  // 1. PENDING RESUME REVIEWS: Candidates in the 'New' stage
  const pendingReviews = useMemo(() => {
    const items: PendingReviewItem[] = [];
    const seenIds = new Set<string>();

    // First: Candidates from candidatesList in 'New' stage
    candidates.forEach((cand) => {
      const stage = getNormalizedStage(cand.status);
      if (stage === 'New') {
        const matchingAnalysis = recentResults.find(
          (a) => a.id === cand.analysisId || a.id === cand.id || a.candidateId === cand.id
        );
        const matchingJob = jobMap.get(cand.jobId);

        items.push({
          id: cand.id,
          candidateName: cand.name || 'Candidate',
          jobId: cand.jobId,
          jobTitle: cand.jobTitle || matchingJob?.title || 'Open Requisition',
          department: cand.jobDepartment || matchingJob?.department || 'General',
          location: cand.location || matchingAnalysis?.candidateOverview.detectedLocation,
          alignmentLevel:
            cand.alignmentLevel ||
            matchingAnalysis?.overallRoleAlignment.level ||
            'Pending Review',
          screenedAt: cand.analyzedAt || cand.createdAt,
          analysis: matchingAnalysis,
          candidateRecord: cand,
        });

        seenIds.add(cand.id);
        if (cand.analysisId) seenIds.add(cand.analysisId);
      }
    });

    // Second: Recent screening analyses that don't yet have a candidateRecord or haven't been transitioned
    recentResults.forEach((res) => {
      if (seenIds.has(res.id)) return;
      const matchingCand = candidates.find(
        (c) => c.analysisId === res.id || c.id === res.id || c.id === res.candidateId
      );
      if (!matchingCand) {
        const matchingJob = jobMap.get(res.jobId || '');
        items.push({
          id: res.id,
          candidateName:
            res.candidateOverview.detectedName || res.fileName || 'Candidate',
          jobId: res.jobId || '',
          jobTitle:
            res.roleSummary.jobTitle || matchingJob?.title || 'Open Requisition',
          department:
            res.roleSummary.department || matchingJob?.department || 'General',
          location: res.candidateOverview.detectedLocation,
          alignmentLevel: res.overallRoleAlignment.level,
          screenedAt: res.analyzedAt,
          analysis: res,
        });
        seenIds.add(res.id);
      }
    });

    // Sort: newest first
    return items.sort((a, b) => {
      const tA = new Date(a.screenedAt).getTime() || 0;
      const tB = new Date(b.screenedAt).getTime() || 0;
      return tB - tA;
    });
  }, [candidates, recentResults, jobMap]);

  // 2. SCHEDULED INTERVIEWS: Extracted from candidate records
  const allScheduledInterviews = useMemo(() => {
    const list: ActionCenterInterview[] = [];
    const seenInterviewIds = new Set<string>();

    candidates.forEach((cand) => {
      const matchingJob = jobMap.get(cand.jobId);
      // Skip interviews for closed job requisitions
      if (matchingJob?.status === 'Closed') return;

      const matchingAnalysis = recentResults.find(
        (a) => a.id === cand.analysisId || a.id === cand.id || a.candidateId === cand.id
      );

      const candInterviews = Array.isArray(cand.interviews) ? cand.interviews : [];
      candInterviews.forEach((int) => {
        if (int.status !== 'Scheduled' && int.status !== 'Rescheduled') return;
        if (seenInterviewIds.has(int.id)) return;
        seenInterviewIds.add(int.id);

        const scheduledMs = int.scheduledAt ? new Date(int.scheduledAt).getTime() : 0;
        const isValidDate = !isNaN(scheduledMs) && scheduledMs > 0;

        list.push({
          id: int.id,
          candidateId: cand.id,
          candidateName: cand.name || 'Candidate',
          jobTitle: cand.jobTitle || matchingJob?.title || 'Open Role',
          jobDepartment: cand.jobDepartment || matchingJob?.department || 'General',
          interviewType: int.interviewType,
          interviewers: int.interviewers || [],
          scheduledAt: int.scheduledAt,
          durationMinutes: int.durationMinutes || 45,
          meetingLinkOrLocation: int.meetingLinkOrLocation,
          status: int.status,
          feedbackNotes: int.feedbackNotes,
          candidateRecord: cand,
          matchingAnalysis,
          scheduledMs,
          isValidDate,
        });
      });
    });

    return list;
  }, [candidates, recentResults, jobMap]);

  // 3. NON-CONFLICTING CATEGORIZATION:
  // Every scheduled interview belongs to exactly one category:
  // - pastDueInterviews: scheduled time has passed (< now)
  // - todayInterviews: scheduled for today and scheduled time has not yet passed (>= now)
  // - upcomingInterviews: scheduled for future calendar days (from tomorrow onward)
  const { pastDueInterviews, todayInterviews, upcomingInterviews } = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();

    const pastDue: ActionCenterInterview[] = [];
    const today: ActionCenterInterview[] = [];
    const upcoming: ActionCenterInterview[] = [];

    allScheduledInterviews.forEach((item) => {
      if (!item.isValidDate) {
        // Safe fallback for unparseable dates: route to past due for review
        pastDue.push(item);
        return;
      }

      const scheduledDate = new Date(item.scheduledMs);

      if (item.scheduledMs < nowMs) {
        // 1. Past-Due: Scheduled time has passed
        pastDue.push(item);
      } else if (isSameDay(scheduledDate, now)) {
        // 2. Today: Takes place on the current local date and is upcoming
        today.push(item);
      } else {
        // 3. Upcoming: Future dates
        upcoming.push(item);
      }
    });

    // Sort Past-Due: most overdue first
    pastDue.sort((a, b) => a.scheduledMs - b.scheduledMs);

    // Sort Today: earliest first
    today.sort((a, b) => a.scheduledMs - b.scheduledMs);

    // Sort Upcoming: earliest first
    upcoming.sort((a, b) => a.scheduledMs - b.scheduledMs);

    return {
      pastDueInterviews: pastDue,
      todayInterviews: today,
      upcomingInterviews: upcoming,
    };
  }, [allScheduledInterviews]);

  const totalActionCount =
    pendingReviews.length +
    todayInterviews.length +
    pastDueInterviews.length +
    upcomingInterviews.length;

  const handleReviewCandidate = (item: PendingReviewItem) => {
    if (item.analysis) {
      onViewAnalysisResult(item.analysis);
    } else {
      onViewCandidates();
    }
  };

  const handleManageInterview = (interview: ActionCenterInterview) => {
    if (onOpenCandidateInterviews) {
      onOpenCandidateInterviews(interview.candidateId);
    } else if (interview.matchingAnalysis) {
      onViewAnalysisResult(interview.matchingAnalysis);
    } else {
      onViewCandidates();
    }
  };

  const getAlignmentBadgeStyle = (level: string) => {
    switch (level) {
      case 'Strong alignment':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Good alignment':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'Moderate alignment':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-2xs space-y-5">
      {/* Header and Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <CalendarClock className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Recruiter Action Center
            </h2>
            {totalActionCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {totalActionCount} Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time hiring queue for new candidate submissions, scheduled loops, and overdue actions.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200/70 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            All Items
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'today'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span>Today</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                todayInterviews.length > 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              {todayInterviews.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span>Pending Reviews</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                pendingReviews.length > 0
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              {pendingReviews.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'bg-white text-purple-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span>Upcoming</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                upcomingInterviews.length > 0
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              {upcomingInterviews.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past_due')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'past_due'
                ? 'bg-white text-rose-700 shadow-2xs'
                : pastDueInterviews.length > 0
                ? 'text-rose-700 hover:bg-rose-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span>Past-Due</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                pastDueInterviews.length > 0
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-200/70 text-slate-500'
              }`}
            >
              {pastDueInterviews.length}
            </span>
          </button>
        </div>
      </div>

      {/* Action Center Content */}
      <div className="space-y-6">
        {/* SECTION 1: PAST-DUE INTERVIEWS (High Priority Alert) */}
        {(activeTab === 'all' || activeTab === 'past_due') && pastDueInterviews.length > 0 && (
          <div className="bg-rose-50/50 border border-rose-200/90 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                  Past-Due Interviews ({pastDueInterviews.length})
                </h3>
              </div>
              <span className="text-[11px] text-rose-700 font-medium">
                Scheduled time has passed · Awaiting status or debrief notes
              </span>
            </div>

            <div className="divide-y divide-rose-100 bg-white border border-rose-200/70 rounded-lg overflow-hidden">
              {pastDueInterviews.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 hover:bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {item.candidateName}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-700 font-medium truncate">
                        {item.jobTitle}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        {item.interviewType}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="text-rose-700 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-rose-600" />
                        <span>Slot: {formatReminderDateTime(item.scheduledAt)}</span>
                        {item.isValidDate && (
                          <span className="font-semibold">
                            ({formatReminderRelative(item.scheduledAt)})
                          </span>
                        )}
                      </span>
                      <span>·</span>
                      <span>
                        Interviewers:{' '}
                        {item.interviewers.length > 0
                          ? item.interviewers.join(', ')
                          : 'Hiring Team'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleManageInterview(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>Update Status / Feedback</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {item.matchingAnalysis && (
                      <button
                        type="button"
                        onClick={() => onViewAnalysisResult(item.matchingAnalysis!)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        title="View Candidate Analysis"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: TODAY'S INTERVIEWS */}
        {(activeTab === 'all' || activeTab === 'today') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Today's Interviews ({todayInterviews.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Scheduled rounds taking place today
              </span>
            </div>

            {todayInterviews.length === 0 ? (
              <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-lg text-center text-xs text-slate-500">
                No scheduled interviews remaining on today's calendar.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                {todayInterviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 hover:bg-blue-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {item.candidateName}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-700 font-medium truncate">
                          {item.jobTitle}
                        </span>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                          {item.interviewType}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="text-blue-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>
                            {new Date(item.scheduledMs).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>({item.durationMinutes}m)</span>
                          <span className="font-semibold text-blue-800">
                            · {formatReminderRelative(item.scheduledAt)}
                          </span>
                        </span>
                        <span>·</span>
                        <span>
                          Interviewers:{' '}
                          {item.interviewers.length > 0
                            ? item.interviewers.join(', ')
                            : 'Hiring Team'}
                        </span>
                        {item.meetingLinkOrLocation && (
                          <>
                            <span>·</span>
                            <span className="text-slate-600 truncate max-w-xs">
                              {item.meetingLinkOrLocation}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleManageInterview(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                      >
                        <span>Manage / Notes</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      {item.matchingAnalysis && (
                        <button
                          type="button"
                          onClick={() => onViewAnalysisResult(item.matchingAnalysis!)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="View Candidate Analysis"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: PENDING RESUME REVIEWS */}
        {(activeTab === 'all' || activeTab === 'pending') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Pending Resume Reviews ({pendingReviews.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Candidates in 'New' stage awaiting recruiter screening
              </span>
            </div>

            {pendingReviews.length === 0 ? (
              <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-lg text-center text-xs text-slate-500">
                No pending resume reviews. All candidate profiles have been triaged.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                {(activeTab === 'all' ? pendingReviews.slice(0, 4) : pendingReviews).map(
                  (item) => (
                    <div
                      key={item.id}
                      className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {item.candidateName}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-700 font-medium truncate">
                            {item.jobTitle}
                          </span>
                          <span
                            className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded ${getAlignmentBadgeStyle(
                              item.alignmentLevel
                            )}`}
                          >
                            {item.alignmentLevel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.location && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <MapPin className="w-3 h-3 text-blue-600" />
                              <span>{item.location}</span>
                              <span>·</span>
                            </span>
                          )}
                          <span>Department: {item.department}</span>
                          <span>·</span>
                          <span>Screened {formatReminderRelative(item.screenedAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReviewCandidate(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md shadow-2xs transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>Review</span>
                        </button>
                        {onOpenCandidateInterviews && item.candidateRecord && (
                          <button
                            type="button"
                            onClick={() => onOpenCandidateInterviews(item.candidateRecord!.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                          >
                            <Calendar className="w-3 h-3 text-purple-600" />
                            <span>Schedule Round</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
                {activeTab === 'all' && pendingReviews.length > 4 && (
                  <div className="p-2.5 bg-slate-50/70 text-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('pending')}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                    >
                      <span>View all {pendingReviews.length} pending reviews</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: UPCOMING INTERVIEWS (Future Calendar Days) */}
        {(activeTab === 'all' || activeTab === 'upcoming') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Upcoming Interviews ({upcomingInterviews.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Scheduled rounds on future dates
              </span>
            </div>

            {upcomingInterviews.length === 0 ? (
              <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-lg text-center text-xs text-slate-500">
                No future interviews currently scheduled.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                {(activeTab === 'all'
                  ? upcomingInterviews.slice(0, 4)
                  : upcomingInterviews
                ).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 hover:bg-purple-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {item.candidateName}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-700 font-medium truncate">
                          {item.jobTitle}
                        </span>
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                          {item.interviewType}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="text-purple-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-600" />
                          <span>{formatReminderDateTime(item.scheduledAt)}</span>
                          <span>({item.durationMinutes}m)</span>
                        </span>
                        <span>·</span>
                        <span>
                          Interviewers:{' '}
                          {item.interviewers.length > 0
                            ? item.interviewers.join(', ')
                            : 'Hiring Team'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleManageInterview(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                      >
                        <span>Manage Round</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      {item.matchingAnalysis && (
                        <button
                          type="button"
                          onClick={() => onViewAnalysisResult(item.matchingAnalysis!)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="View Candidate Analysis"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {activeTab === 'all' && upcomingInterviews.length > 4 && (
                  <div className="p-2.5 bg-slate-50/70 text-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upcoming')}
                      className="text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
                    >
                      <span>View all {upcomingInterviews.length} upcoming interviews</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
