import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Calendar,
  Users,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Mail,
  Video,
  MapPin,
  Briefcase,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import {
  CandidateRecord,
  Job,
  AnalysisResult,
  HiringReminderItem,
  ReminderCategory
} from '../types';
import {
  computeHiringReminders,
  formatReminderDateTime,
  formatReminderRelative
} from '../lib/reminder-helpers';

interface RemindersViewProps {
  candidates: CandidateRecord[];
  analyses: AnalysisResult[];
  jobs: Job[];
  onSelectCandidateAnalysis: (analysisId: string) => void;
  onNavigateToCandidates: (candidateId?: string) => void;
  onOpenInterviewsModal?: (candidate: CandidateRecord) => void;
  onOpenOutreachModal?: (candidate: CandidateRecord) => void;
  onOpenTimelineModal?: (candidate: CandidateRecord) => void;
  onStartNewAnalysis: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
}

type CategoryFilter = 'all' | ReminderCategory;
type UrgencyFilter = 'all' | 'urgent' | 'upcoming';

export const RemindersView: React.FC<RemindersViewProps> = ({
  candidates,
  analyses,
  jobs,
  onSelectCandidateAnalysis,
  onNavigateToCandidates,
  onOpenInterviewsModal,
  onOpenOutreachModal,
  onOpenTimelineModal,
  onStartNewAnalysis,
  currentUserEmail,
  currentUserName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');

  // Compute all reminders based exclusively on real stored Firestore data
  const allReminders = useMemo(() => {
    return computeHiringReminders(candidates, jobs, analyses);
  }, [candidates, jobs, analyses]);

  // Metric counts
  const overdueCount = useMemo(
    () => allReminders.filter((r) => r.category === 'overdue_interview').length,
    [allReminders]
  );
  const upcomingCount = useMemo(
    () => allReminders.filter((r) => r.category === 'upcoming_interview').length,
    [allReminders]
  );
  const missingFeedbackCount = useMemo(
    () => allReminders.filter((r) => r.category === 'missing_feedback').length,
    [allReminders]
  );
  const stalledCount = useMemo(
    () => allReminders.filter((r) => r.category === 'stalled_stage').length,
    [allReminders]
  );

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    return allReminders.filter((item) => {
      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // Urgency filter
      if (urgencyFilter === 'urgent') {
        if (item.urgency !== 'overdue' && item.urgency !== 'today' && item.urgency !== 'action_needed') {
          return false;
        }
      } else if (urgencyFilter === 'upcoming') {
        if (item.category !== 'upcoming_interview') {
          return false;
        }
      }

      // Job Requisition filter
      if (selectedJobId !== 'all' && item.jobId !== selectedJobId) {
        return false;
      }

      // Search query (Candidate name, role, interviewers, details)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = item.candidateName.toLowerCase().includes(query);
        const roleMatch = item.jobTitle.toLowerCase().includes(query);
        const deptMatch = item.jobDepartment.toLowerCase().includes(query);
        const interviewersMatch = (item.interviewers || []).some((i) =>
          i.toLowerCase().includes(query)
        );
        const typeMatch = (item.interviewType || '').toLowerCase().includes(query);

        if (!nameMatch && !roleMatch && !deptMatch && !interviewersMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allReminders, categoryFilter, urgencyFilter, selectedJobId, searchQuery]);

  // Helper to retrieve matching CandidateRecord
  const getCandidateRecord = (candidateId: string): CandidateRecord | undefined => {
    return candidates.find((c) => c.id === candidateId || c.analysisId === candidateId);
  };

  // Helper for badge styling based on urgency/category
  const getReminderBadge = (item: HiringReminderItem) => {
    switch (item.urgency) {
      case 'overdue':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dotBg: 'bg-rose-600',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
          label: 'Overdue Round',
        };
      case 'today':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dotBg: 'bg-amber-500',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          label: 'Interview Today',
        };
      case 'tomorrow':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dotBg: 'bg-blue-600',
          icon: <CalendarClock className="w-3.5 h-3.5 text-blue-600 shrink-0" />,
          label: 'Interview Tomorrow',
        };
      case 'action_needed':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          dotBg: 'bg-purple-600',
          icon: <AlertCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />,
          label: item.category === 'missing_feedback' ? 'Missing Feedback' : 'Action Needed',
        };
      case 'upcoming':
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dotBg: 'bg-slate-500',
          icon: <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
          label: 'Upcoming Scheduled',
        };
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-7 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 uppercase tracking-wider">
              <CalendarClock className="w-4 h-4 text-purple-600" />
              <span>Phase 4 · Interview & Hiring Reminders</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Recruitment Follow-ups & Reminders
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Track upcoming scheduled interviews, overdue interview rounds, and completed rounds awaiting debrief feedback notes.
              Grounded exclusively in stored Firestore records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateToCandidates()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Candidate Pipeline</span>
            </button>
            <button
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Screen Candidate</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-100">
          <div
            onClick={() => {
              setCategoryFilter('all');
              setUrgencyFilter('all');
            }}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              categoryFilter === 'all' && urgencyFilter === 'all'
                ? 'bg-purple-50/80 border-purple-200 ring-1 ring-purple-300'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-500">Total Actionable Items</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{allReminders.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across active requisitions</div>
          </div>

          <div
            onClick={() => {
              setCategoryFilter('upcoming_interview');
              setUrgencyFilter('all');
            }}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              categoryFilter === 'upcoming_interview'
                ? 'bg-blue-50/80 border-blue-200 ring-1 ring-blue-300'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-500">Upcoming Interviews</div>
            <div className="text-2xl font-bold text-blue-700 mt-0.5">{upcomingCount}</div>
            <div className="text-[11px] text-blue-600 mt-0.5">Chronologically ordered</div>
          </div>

          <div
            onClick={() => {
              setCategoryFilter('missing_feedback');
              setUrgencyFilter('all');
            }}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              categoryFilter === 'missing_feedback'
                ? 'bg-amber-50/80 border-amber-200 ring-1 ring-amber-300'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-500">Missing Debrief Notes</div>
            <div className="text-2xl font-bold text-amber-700 mt-0.5">{missingFeedbackCount}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Completed without notes</div>
          </div>

          <div
            onClick={() => {
              setCategoryFilter('overdue_interview');
              setUrgencyFilter('all');
            }}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              categoryFilter === 'overdue_interview'
                ? 'bg-rose-50/80 border-rose-200 ring-1 ring-rose-300'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-500">Overdue Scheduled</div>
            <div className="text-2xl font-bold text-rose-700 mt-0.5">{overdueCount}</div>
            <div className="text-[11px] text-rose-600 mt-0.5">Slot elapsed; outcome pending</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter:</span>
            </span>

            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-purple-100 text-purple-900 border border-purple-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All ({allReminders.length})
            </button>

            <button
              onClick={() => setCategoryFilter('upcoming_interview')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                categoryFilter === 'upcoming_interview'
                  ? 'bg-blue-100 text-blue-900 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Upcoming ({upcomingCount})
            </button>

            <button
              onClick={() => setCategoryFilter('missing_feedback')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                categoryFilter === 'missing_feedback'
                  ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Missing Feedback ({missingFeedbackCount})
            </button>

            <button
              onClick={() => setCategoryFilter('overdue_interview')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                categoryFilter === 'overdue_interview'
                  ? 'bg-rose-100 text-rose-900 border border-rose-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Overdue ({overdueCount})
            </button>

            {stalledCount > 0 && (
              <button
                onClick={() => setCategoryFilter('stalled_stage')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  categoryFilter === 'stalled_stage'
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Stalled Pipeline ({stalledCount})
              </button>
            )}
          </div>

          {/* Job Requisition dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Job:</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-hidden focus:border-purple-600 shadow-2xs"
            >
              <option value="all">All Jobs ({jobs.length})</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.department}) {job.status !== 'Open' ? `· [${job.status}]` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by candidate name, role title, interviewer, or round type..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 absolute right-2.5 top-2 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Reminders List */}
      {filteredReminders.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-xl p-10 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              {allReminders.length === 0
                ? 'All Caught Up! No Pending Reminders'
                : 'No reminders matched your filters'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {allReminders.length === 0
                ? 'All completed interview rounds have documented debrief notes, and there are no overdue scheduled interviews. Great job keeping the hiring pipeline organized!'
                : 'Try adjusting your search query, requisition filter, or category selection above.'}
            </p>
          </div>

          {allReminders.length > 0 && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setSearchQuery('');
                setSelectedJobId('all');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReminders.map((reminder) => {
            const badge = getReminderBadge(reminder);
            const candidateRecord = getCandidateRecord(reminder.candidateId);

            return (
              <div
                key={reminder.id}
                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-4 sm:p-5 shadow-2xs transition-all space-y-3"
              >
                {/* Header row: Badge, Urgency, Dates */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-xs text-slate-400">·</span>

                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {reminder.statusText}
                    </span>
                  </div>

                  {reminder.scheduledAt && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatReminderDateTime(reminder.scheduledAt)}</span>
                      {reminder.durationMinutes && (
                        <span className="text-slate-400 font-sans">
                          ({reminder.durationMinutes}m)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Main Body */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        {reminder.candidateName}
                      </h3>
                      {candidateRecord?.status && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {candidateRecord.status}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-600">
                        {reminder.jobTitle} ({reminder.jobDepartment})
                      </span>
                    </div>

                    {reminder.interviewType && (
                      <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>{reminder.interviewType}</span>
                        </span>

                        {reminder.interviewers && reminder.interviewers.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Interviewers: {reminder.interviewers.join(', ')}</span>
                          </span>
                        )}

                        {reminder.meetingLinkOrLocation && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                            <Video className="w-3.5 h-3.5 text-slate-400" />
                            <span>{reminder.meetingLinkOrLocation}</span>
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 leading-relaxed font-sans mt-1">
                      {reminder.description}
                    </p>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0 pt-1">
                    {/* Primary Action Button */}
                    {candidateRecord && onOpenInterviewsModal && (
                      <button
                        type="button"
                        onClick={() => onOpenInterviewsModal(candidateRecord)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer ${
                          reminder.category === 'missing_feedback'
                            ? 'text-white bg-amber-600 hover:bg-amber-700'
                            : reminder.category === 'overdue_interview'
                            ? 'text-white bg-rose-600 hover:bg-rose-700'
                            : 'text-white bg-purple-700 hover:bg-purple-800'
                        }`}
                        title="Open interview manager to update round status or record feedback notes"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {reminder.category === 'missing_feedback'
                            ? 'Log Debrief Notes'
                            : reminder.category === 'overdue_interview'
                            ? 'Update Round Outcome'
                            : 'Manage Interviews'}
                        </span>
                      </button>
                    )}

                    {/* Secondary Navigation Actions */}
                    <div className="flex items-center gap-1.5">
                      {reminder.analysisId && (
                        <button
                          type="button"
                          onClick={() => onSelectCandidateAnalysis(reminder.analysisId!)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                          title="View evidence-based resume screening report"
                        >
                          <span>Analysis</span>
                        </button>
                      )}

                      {candidateRecord && onOpenOutreachModal && (
                        <button
                          type="button"
                          onClick={() => onOpenOutreachModal(candidateRecord)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                          title="Draft grounded email outreach"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {candidateRecord && onOpenTimelineModal && (
                        <button
                          type="button"
                          onClick={() => onOpenTimelineModal(candidateRecord)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                          title="View unified activity and audit timeline"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ethical Governance Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 flex items-start gap-2.5 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800 block">
            Hiring Governance & Human Recruiter Accountability
          </span>
          <p className="mt-0.5">
            Reminders are computed strictly from real stored interview schedules, debrief notes, and pipeline stages in Firestore.
            Mihora Resume Intelligence never fabricates deadlines or sends unsolicited automated emails without recruiter verification.
          </p>
        </div>
      </div>
    </div>
  );
};
