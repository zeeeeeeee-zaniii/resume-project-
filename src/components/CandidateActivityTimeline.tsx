import React, { useState, useMemo } from 'react';
import {
  Clock,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Mail,
  Edit3,
  FileText,
  TrendingUp,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Info,
  Copy,
  Check,
  Filter,
  ArrowUpDown,
  User,
  ShieldCheck
} from 'lucide-react';
import {
  CandidateRecord,
  AnalysisResult,
  CandidateActivityEvent,
  ActivityEventType
} from '../types';
import {
  buildUnifiedCandidateTimeline,
  formatTimelineDate,
  formatRelativeTime
} from '../lib/timeline-helpers';

interface CandidateActivityTimelineProps {
  candidate?: CandidateRecord | null;
  analysis?: AnalysisResult | null;
  className?: string;
  showCardWrapper?: boolean;
}

type TimelineFilter = 'all' | 'interviews' | 'outreach' | 'status' | 'notes';
type SortOrder = 'newest' | 'oldest';

export const CandidateActivityTimeline: React.FC<CandidateActivityTimelineProps> = ({
  candidate,
  analysis,
  className = '',
  showCardWrapper = true,
}) => {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [copiedAudit, setCopiedAudit] = useState(false);

  // Build unified chronological timeline
  const allEvents = useMemo(() => {
    return buildUnifiedCandidateTimeline(candidate, analysis);
  }, [candidate, analysis]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = allEvents;

    if (filter === 'interviews') {
      result = result.filter((e) =>
        e.type.startsWith('interview_')
      );
    } else if (filter === 'outreach') {
      result = result.filter((e) => e.type === 'outreach_logged');
    } else if (filter === 'status') {
      result = result.filter((e) => e.type === 'status_changed');
    } else if (filter === 'notes') {
      result = result.filter((e) => e.type === 'notes_updated');
    }

    if (sortOrder === 'oldest') {
      result = [...result].reverse();
    }

    return result;
  }, [allEvents, filter, sortOrder]);

  // Copy timeline audit trail to clipboard
  const handleCopyAuditTrail = () => {
    if (allEvents.length === 0) return;

    const candidateName = candidate?.name || analysis?.candidateOverview?.detectedName || 'Candidate';
    const jobTitle = candidate?.jobTitle || analysis?.roleSummary?.jobTitle || 'Role';

    const lines = [
      `MIHORA RESUME INTELLIGENCE — CANDIDATE ACTIVITY TIMELINE`,
      `Candidate: ${candidateName}`,
      `Role: ${jobTitle}`,
      `Total Recorded Events: ${allEvents.length}`,
      `Generated: ${new Date().toLocaleString()}`,
      `------------------------------------------------------------`,
      ...allEvents.map((e, idx) => {
        const dateStr = formatTimelineDate(e.timestamp);
        const sourceLabel = e.source === 'recorded' ? '[RECORDED]' : '[BASELINE]';
        const actorStr = e.actorName ? ` (By ${e.actorName})` : '';
        return `${idx + 1}. ${sourceLabel} ${dateStr} — ${e.title}${actorStr}\n   Details: ${e.details || 'None'}`;
      }),
      `------------------------------------------------------------`,
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedAudit(true);
      setTimeout(() => setCopiedAudit(false), 2500);
    });
  };

  // Get icon and styling for event type
  const getEventBadge = (type: ActivityEventType) => {
    switch (type) {
      case 'analysis_completed':
      case 'resume_uploaded':
        return {
          icon: <Sparkles className="w-4 h-4 text-blue-700" />,
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          dotBg: 'bg-blue-600',
        };
      case 'interview_scheduled':
        return {
          icon: <CalendarClock className="w-4 h-4 text-purple-700" />,
          bg: 'bg-purple-50 border-purple-200 text-purple-800',
          dotBg: 'bg-purple-600',
        };
      case 'interview_completed':
        return {
          icon: <CalendarCheck className="w-4 h-4 text-emerald-700" />,
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dotBg: 'bg-emerald-600',
        };
      case 'interview_rescheduled':
        return {
          icon: <Clock className="w-4 h-4 text-amber-700" />,
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dotBg: 'bg-amber-600',
        };
      case 'interview_cancelled':
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-700" />,
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          dotBg: 'bg-rose-600',
        };
      case 'status_changed':
        return {
          icon: <TrendingUp className="w-4 h-4 text-indigo-700" />,
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
          dotBg: 'bg-indigo-600',
        };
      case 'notes_updated':
        return {
          icon: <Edit3 className="w-4 h-4 text-slate-700" />,
          bg: 'bg-slate-50 border-slate-200 text-slate-800',
          dotBg: 'bg-slate-600',
        };
      case 'outreach_logged':
        return {
          icon: <Mail className="w-4 h-4 text-sky-700" />,
          bg: 'bg-sky-50 border-sky-200 text-sky-800',
          dotBg: 'bg-sky-600',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-slate-700" />,
          bg: 'bg-slate-50 border-slate-200 text-slate-800',
          dotBg: 'bg-slate-600',
        };
    }
  };

  const content = (
    <div className="space-y-5">
      {/* Timeline Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter:</span>
          </span>

          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All ({allEvents.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('interviews')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filter === 'interviews'
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Interviews ({allEvents.filter((e) => e.type.startsWith('interview_')).length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('outreach')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filter === 'outreach'
                ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Outreach ({allEvents.filter((e) => e.type === 'outreach_logged').length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('status')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filter === 'status'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Stages ({allEvents.filter((e) => e.type === 'status_changed').length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('notes')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filter === 'notes'
                ? 'bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Notes ({allEvents.filter((e) => e.type === 'notes_updated').length})
          </button>
        </div>

        {/* Right actions: Sort & Copy */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="Toggle chronological sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAuditTrail}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="Copy audit log to clipboard"
          >
            {copiedAudit ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Trail</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Timeline Events List */}
      {filteredEvents.length === 0 ? (
        <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
          <Clock className="w-7 h-7 text-slate-300 mx-auto" />
          <div className="text-xs text-slate-600">
            <p className="font-semibold text-slate-700">No activity events found</p>
            <p className="text-slate-400 mt-0.5">
              No events matched the selected filter criteria.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((event) => {
            const badge = getEventBadge(event.type);
            const isRecorded = event.source === 'recorded';

            return (
              <div key={event.id} className="relative group">
                {/* Timeline Node Dot */}
                <span
                  className={`absolute -left-[19px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${badge.dotBg} shadow-xs ring-2 ring-slate-100 flex items-center justify-center`}
                  aria-hidden="true"
                />

                {/* Event Card */}
                <div className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg p-3.5 sm:p-4 shadow-2xs transition-all space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md border ${badge.bg}`}>
                        {badge.icon}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                        {event.title}
                      </h4>
                    </div>

                    {/* Metadata Pill & Verification Source */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isRecorded ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200"
                          title="Verified historical event stored in Firestore audit trail"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Recorded Event</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                          title="Baseline document state (prior to granular transition logging)"
                        >
                          <Info className="w-3 h-3 text-slate-400" />
                          <span>Current Record</span>
                        </span>
                      )}

                      <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                        <span>{formatTimelineDate(event.timestamp)}</span>
                        {formatRelativeTime(event.timestamp) && (
                          <span className="text-slate-400 ml-1.5 font-sans">
                            ({formatRelativeTime(event.timestamp)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details Description */}
                  {event.details && (
                    <div className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-md border border-slate-100 leading-relaxed font-sans">
                      {event.details}
                    </div>
                  )}

                  {/* Actor Pill if available */}
                  {event.actorName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-100">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Logged by:</span>
                      <strong className="text-slate-700 font-semibold">{event.actorName}</strong>
                      {event.actorEmail && (
                        <span className="text-slate-400">({event.actorEmail})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ethical Governance Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
        <span>
          <strong>Audit Transparency:</strong> Mihora Timeline strictly reflects confirmed events and timestamps.
          Historical events are never invented or reconstructed post-facto.
        </span>
      </div>
    </div>
  );

  if (!showCardWrapper) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={`bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-700" />
            <span>Unified Activity Timeline</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit trail of resume evaluations, interview rounds, recruiter notes, and candidate communications.
          </p>
        </div>
        <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {allEvents.length} Event{allEvents.length === 1 ? '' : 's'}
        </span>
      </div>
      {content}
    </div>
  );
};
