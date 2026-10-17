import { CandidateRecord, AnalysisResult, CandidateActivityEvent, OutreachTemplateType, InterviewSlotStatus } from '../types';

/**
 * Format outreach template type for human-readable display
 */
export function formatOutreachTemplateLabel(type: OutreachTemplateType): string {
  switch (type) {
    case 'interview_invitation':
      return 'Interview Invitation';
    case 'clarification_request':
      return 'Request for Clarification';
    case 'rejection':
      return 'Respectful Rejection Notice';
    case 'screening_followup':
      return 'Screening Follow-up';
    default:
      return 'Outreach Message';
  }
}

/**
 * Parses and returns a valid timestamp in milliseconds, or fallback
 */
export function getSafeTimestampMs(timestampStr?: string): number {
  if (!timestampStr) return 0;
  const parsed = new Date(timestampStr).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a timestamp into a clean, human-readable date and time
 */
export function formatTimelineDate(timestampStr?: string): string {
  if (!timestampStr) return 'Date not recorded';
  const d = new Date(timestampStr);
  if (isNaN(d.getTime())) {
    // If it's already a formatted string like "Oct 13, 2026, 04:30 PM", return it
    return timestampStr;
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Relative time helper (e.g., "10m ago", "2h ago", "3d ago")
 */
export function formatRelativeTime(timestampStr?: string): string {
  if (!timestampStr) return '';
  const d = new Date(timestampStr);
  if (isNaN(d.getTime())) return '';
  
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Assembles a unified, chronological activity timeline for a candidate.
 * Strictly separates 'recorded' historical events from 'inferred' baseline state.
 */
export function buildUnifiedCandidateTimeline(
  candidate?: CandidateRecord | null,
  analysis?: AnalysisResult | null
): CandidateActivityEvent[] {
  if (!candidate && !analysis) {
    return [];
  }

  const events: CandidateActivityEvent[] = [];
  const recordedEventIds = new Set<string>();

  // 1. Explicitly recorded activity events from candidate.activityTimeline
  if (candidate?.activityTimeline && Array.isArray(candidate.activityTimeline)) {
    candidate.activityTimeline.forEach((ev) => {
      if (ev && ev.id) {
        recordedEventIds.add(ev.id);
        events.push({
          ...ev,
          source: 'recorded',
        });
      }
    });
  }

  // 2. Outreach Logs (Verified Historical Communications)
  if (candidate?.outreachLogs && Array.isArray(candidate.outreachLogs)) {
    candidate.outreachLogs.forEach((log) => {
      const eventId = `outreach-${log.id}`;
      // Check if an outreach event matching this log is already in timeline
      const alreadyLogged = events.some(
        (e) =>
          e.type === 'outreach_logged' &&
          (e.id === eventId ||
            e.id === log.id ||
            e.id === `act-outreach-${log.id}` ||
            (e.timestamp === log.sentAt && e.metadata?.subject === log.subject))
      );

      if (!alreadyLogged && !recordedEventIds.has(eventId) && !recordedEventIds.has(log.id)) {
        recordedEventIds.add(eventId);
        events.push({
          id: eventId,
          type: 'outreach_logged',
          title: `Candidate Outreach Logged (${formatOutreachTemplateLabel(log.templateType)})`,
          timestamp: log.sentAt,
          actorName: log.senderName,
          details: `Subject: "${log.subject}"${log.recipientEmail ? ` · Recipient: ${log.recipientEmail}` : ''}${
            log.notes ? ` · Note: ${log.notes}` : ''
          }`,
          metadata: {
            templateType: log.templateType,
            recipientEmail: log.recipientEmail,
            subject: log.subject,
          },
          source: 'recorded',
        });
      }
    });
  }

  // 3. Interview Records (Verified Historical / Scheduled Rounds)
  if (candidate?.interviews && Array.isArray(candidate.interviews)) {
    candidate.interviews.forEach((interview) => {
      // Map based on status
      const isCompleted = interview.status === 'Completed';
      const isCancelled = interview.status === 'Cancelled';
      const isRescheduled = interview.status === 'Rescheduled';

      let type: CandidateActivityEvent['type'] = 'interview_scheduled';
      let title = `Interview Scheduled: ${interview.interviewType}`;

      if (isCompleted) {
        type = 'interview_completed';
        title = `Interview Completed: ${interview.interviewType}`;
      } else if (isCancelled) {
        type = 'interview_cancelled';
        title = `Interview Cancelled: ${interview.interviewType}`;
      } else if (isRescheduled) {
        type = 'interview_rescheduled';
        title = `Interview Rescheduled: ${interview.interviewType}`;
      }

      const eventId = `interview-${interview.id}-${interview.status}`;
      const alreadyLogged = events.some(
        (e) =>
          e.type.startsWith('interview_') &&
          (e.id === eventId || (e.metadata?.interviewId === interview.id && e.metadata?.status === interview.status))
      );

      if (!alreadyLogged && !recordedEventIds.has(eventId)) {
        recordedEventIds.add(eventId);

        const detailsParts: string[] = [];
        if (interview.scheduledAt) {
          detailsParts.push(`Slot: ${formatTimelineDate(interview.scheduledAt)} (${interview.durationMinutes}m)`);
        }
        if (interview.interviewers && interview.interviewers.length > 0) {
          detailsParts.push(`Interviewers: ${interview.interviewers.join(', ')}`);
        }
        if (interview.meetingLinkOrLocation) {
          detailsParts.push(`Location/Meeting: ${interview.meetingLinkOrLocation}`);
        }
        if (interview.feedbackNotes) {
          detailsParts.push(`Feedback Notes: "${interview.feedbackNotes}"`);
        }

        events.push({
          id: eventId,
          type,
          title,
          timestamp: isCompleted || isCancelled || isRescheduled
            ? interview.updatedAt || interview.scheduledAt || interview.createdAt
            : interview.createdAt || interview.scheduledAt,
          actorName: interview.interviewers?.[0] || undefined,
          details: detailsParts.join(' · '),
          metadata: {
            interviewId: interview.id,
            interviewType: interview.interviewType,
            status: interview.status,
            meetingLinkOrLocation: interview.meetingLinkOrLocation,
          },
          source: 'recorded',
        });
      }
    });
  }

  // 4. Baseline Resume Upload & Analysis Event (Distinguished as 'recorded' if createdAt exists or 'inferred')
  const hasRecordedScreening = events.some(
    (e) => e.type === 'analysis_completed' || e.type === 'resume_uploaded'
  );

  if (!hasRecordedScreening) {
    const screeningTimestamp = candidate?.createdAt || candidate?.analyzedAt || analysis?.analyzedAt;
    const candidateName = candidate?.name || analysis?.candidateOverview?.detectedName || analysis?.fileName || 'Candidate';
    const jobTitle = candidate?.jobTitle || analysis?.roleSummary?.jobTitle || 'Role';
    const alignmentLevel = candidate?.alignmentLevel || analysis?.overallRoleAlignment?.level || 'Evaluated';

    events.push({
      id: `screening-baseline-${candidate?.id || analysis?.id}`,
      type: 'analysis_completed',
      title: 'Resume Screened & Evidence Citations Generated',
      timestamp: screeningTimestamp || new Date().toISOString(),
      details: `Evidence-based screening evaluated for ${jobTitle}. Alignment classification: ${alignmentLevel}. Document source: ${analysis?.fileName || 'Resume document'}.`,
      actorName: candidate?.userId ? 'Recruiter' : undefined,
      metadata: {
        fileName: analysis?.fileName,
        alignmentLevel,
        jobTitle,
      },
      // If exact ISO timestamp exists in candidate.createdAt it is recorded; otherwise inferred from analyzedAt
      source: candidate?.createdAt ? 'recorded' : 'inferred',
    });
  }

  // 5. Baseline Current Stage (If no status_changed event was explicitly logged yet for this candidate)
  const hasRecordedStatusChange = events.some((e) => e.type === 'status_changed');
  if (!hasRecordedStatusChange && candidate?.status) {
    events.push({
      id: `baseline-status-${candidate.id}`,
      type: 'status_changed',
      title: `Current Stage: ${candidate.status}`,
      timestamp: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
      details: `Candidate is currently in the ${candidate.status} stage. (No prior status transitions logged).`,
      source: 'inferred',
    });
  }

  // 6. Baseline Recruiter Notes (If candidate has notes and no notes_updated event was recorded)
  const hasRecordedNoteUpdate = events.some((e) => e.type === 'notes_updated');
  if (!hasRecordedNoteUpdate && candidate?.notes && candidate.notes.trim()) {
    events.push({
      id: `baseline-notes-${candidate.id}`,
      type: 'notes_updated',
      title: 'Recruiter Notes Recorded',
      timestamp: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
      details: `"${candidate.notes}"`,
      source: 'inferred',
    });
  }

  // 7. Sort chronologically (newest first by default)
  events.sort((a, b) => {
    const timeA = getSafeTimestampMs(a.timestamp);
    const timeB = getSafeTimestampMs(b.timestamp);
    return timeB - timeA;
  });

  return events;
}
