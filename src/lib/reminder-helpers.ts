import { CandidateRecord, Job, AnalysisResult, HiringReminderItem } from '../types';

/**
 * Checks if two dates fall on the exact same calendar day (local time)
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Checks if d1 is the calendar day immediately following d2
 */
export function isTomorrow(d1: Date, now: Date): boolean {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(d1, tomorrow);
}

/**
 * Formats date/time for reminders display
 */
export function formatReminderDateTime(timestampStr?: string): string {
  if (!timestampStr) return 'Date not specified';
  const d = new Date(timestampStr);
  if (isNaN(d.getTime())) return timestampStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats time difference as human-readable string (e.g. "2 hours ago", "In 3 hours")
 */
export function formatReminderRelative(timestampStr?: string): string {
  if (!timestampStr) return '';
  const d = new Date(timestampStr);
  if (isNaN(d.getTime())) return '';

  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absDiffSec = Math.floor(Math.abs(diffMs) / 1000);

  const isPast = diffMs < 0;

  if (absDiffSec < 60) return isPast ? 'Just now' : 'Right now';
  if (absDiffSec < 3600) {
    const mins = Math.floor(absDiffSec / 60);
    return isPast ? `${mins}m ago` : `In ${mins}m`;
  }
  if (absDiffSec < 86400) {
    const hours = Math.floor(absDiffSec / 3600);
    return isPast ? `${hours}h ago` : `In ${hours}h`;
  }
  const days = Math.floor(absDiffSec / 86400);
  return isPast ? `${days}d ago` : `In ${days}d`;
}

/**
 * Computes all actionable interview and hiring reminders from real application data.
 * Adheres strictly to stored data; no fabricated deadlines or tasks.
 */
export function computeHiringReminders(
  candidates: CandidateRecord[],
  jobs: Job[],
  analyses: AnalysisResult[] = []
): HiringReminderItem[] {
  const reminders: HiringReminderItem[] = [];
  const now = new Date();
  const nowMs = now.getTime();

  // Create lookup map for jobs
  const jobMap = new Map<string, Job>();
  jobs.forEach((j) => jobMap.set(j.id, j));

  candidates.forEach((candidate) => {
    const matchingJob = jobMap.get(candidate.jobId);
    // If the candidate's job requisition is closed, do not generate active hiring/interview reminders
    if (matchingJob?.status === 'Closed') {
      return;
    }

    const jobTitle = candidate.jobTitle || matchingJob?.title || 'Open Role';
    const jobDepartment = candidate.jobDepartment || matchingJob?.department || 'General';

    const candidateInterviews = Array.isArray(candidate.interviews) ? candidate.interviews : [];
    let hasUpcomingInterview = false;

    // 1. Check each scheduled interview round
    candidateInterviews.forEach((interview) => {
      const scheduledMs = interview.scheduledAt ? new Date(interview.scheduledAt).getTime() : 0;
      const isValidDate = !isNaN(scheduledMs) && scheduledMs > 0;
      const scheduledDate = isValidDate ? new Date(scheduledMs) : null;

      // Status: Scheduled or Rescheduled
      if (interview.status === 'Scheduled' || interview.status === 'Rescheduled') {
        if (isValidDate && scheduledMs < nowMs) {
          // OVERDUE INTERVIEW: Stored schedule time has passed, but status wasn't updated
          reminders.push({
            id: `rem-overdue-${interview.id}`,
            category: 'overdue_interview',
            candidateId: candidate.id,
            candidateName: candidate.name,
            analysisId: candidate.analysisId,
            jobId: candidate.jobId,
            jobTitle,
            jobDepartment,
            interviewId: interview.id,
            interviewType: interview.interviewType,
            scheduledAt: interview.scheduledAt,
            durationMinutes: interview.durationMinutes,
            interviewers: interview.interviewers,
            meetingLinkOrLocation: interview.meetingLinkOrLocation,
            statusText: `Overdue (${formatReminderRelative(interview.scheduledAt)})`,
            urgency: 'overdue',
            description: `Scheduled slot (${formatReminderDateTime(interview.scheduledAt)}) has elapsed. Recruiter action required to update status or record debrief notes.`,
            createdAt: interview.createdAt,
          });
        } else {
          // UPCOMING INTERVIEW: Today, Tomorrow, or Future
          hasUpcomingInterview = true;
          let urgency: HiringReminderItem['urgency'] = 'upcoming';
          let statusText = 'Upcoming';

          if (scheduledDate && isSameDay(scheduledDate, now)) {
            urgency = 'today';
            statusText = `Today (${formatReminderRelative(interview.scheduledAt)})`;
          } else if (scheduledDate && isTomorrow(scheduledDate, now)) {
            urgency = 'tomorrow';
            statusText = `Tomorrow (${formatReminderDateTime(interview.scheduledAt)})`;
          } else if (isValidDate) {
            statusText = formatReminderRelative(interview.scheduledAt);
          }

          reminders.push({
            id: `rem-upcoming-${interview.id}`,
            category: 'upcoming_interview',
            candidateId: candidate.id,
            candidateName: candidate.name,
            analysisId: candidate.analysisId,
            jobId: candidate.jobId,
            jobTitle,
            jobDepartment,
            interviewId: interview.id,
            interviewType: interview.interviewType,
            scheduledAt: interview.scheduledAt,
            durationMinutes: interview.durationMinutes,
            interviewers: interview.interviewers,
            meetingLinkOrLocation: interview.meetingLinkOrLocation,
            statusText,
            urgency,
            description: `Scheduled with ${interview.interviewers?.join(', ') || 'hiring team'}. Slot: ${formatReminderDateTime(interview.scheduledAt)} (${interview.durationMinutes}m).`,
            createdAt: interview.createdAt,
          });
        }
      }

      // Status: Completed, but missing feedback notes
      if (interview.status === 'Completed') {
        const hasNotes = interview.feedbackNotes && interview.feedbackNotes.trim().length > 0;
        if (!hasNotes) {
          reminders.push({
            id: `rem-missing-feedback-${interview.id}`,
            category: 'missing_feedback',
            candidateId: candidate.id,
            candidateName: candidate.name,
            analysisId: candidate.analysisId,
            jobId: candidate.jobId,
            jobTitle,
            jobDepartment,
            interviewId: interview.id,
            interviewType: interview.interviewType,
            scheduledAt: interview.scheduledAt,
            durationMinutes: interview.durationMinutes,
            interviewers: interview.interviewers,
            meetingLinkOrLocation: interview.meetingLinkOrLocation,
            statusText: 'Debrief Notes Missing',
            urgency: 'action_needed',
            description: `Interview round completed on ${formatReminderDateTime(interview.updatedAt || interview.scheduledAt)}, but debrief feedback notes are empty. Record candidate debrief notes to preserve hiring team evaluation.`,
            createdAt: interview.updatedAt || interview.createdAt,
          });
        }
      }
    });

    // 2. Check Candidate Pipeline Stalls (Only if explicit stored status supports it)
    if (candidate.status === 'Interview' && !hasUpcomingInterview) {
        // In Interview stage with no upcoming rounds scheduled
        const completedCount = candidateInterviews.filter((i) => i.status === 'Completed').length;
        reminders.push({
          id: `rem-stalled-interview-${candidate.id}`,
          category: 'stalled_stage',
          candidateId: candidate.id,
          candidateName: candidate.name,
          analysisId: candidate.analysisId,
          jobId: candidate.jobId,
          jobTitle,
          jobDepartment,
          statusText: completedCount > 0 ? 'Next Step Required' : 'Schedule Round 1',
          urgency: 'action_needed',
          description:
            completedCount > 0
              ? `Candidate completed ${completedCount} round${completedCount === 1 ? '' : 's'} but has no next interview scheduled. Schedule next round or update pipeline stage.`
              : `Candidate was moved to the Interview stage but no interview has been scheduled yet.`,
          createdAt: candidate.updatedAt || candidate.createdAt,
        });
      } else if (candidate.status === 'Shortlisted' && candidateInterviews.length === 0) {
        // Shortlisted for > 5 days with no interview scheduled
        const refDate = new Date(candidate.updatedAt || candidate.createdAt);
        if (!isNaN(refDate.getTime())) {
          const diffDays = (nowMs - refDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= 5) {
            reminders.push({
              id: `rem-shortlisted-${candidate.id}`,
              category: 'stalled_stage',
              candidateId: candidate.id,
              candidateName: candidate.name,
              analysisId: candidate.analysisId,
              jobId: candidate.jobId,
              jobTitle,
              jobDepartment,
              statusText: `Shortlisted (${Math.floor(diffDays)}d ago)`,
              urgency: 'action_needed',
              description: `Shortlisted on ${formatReminderDateTime(candidate.updatedAt || candidate.createdAt)} without scheduled interview round.`,
              createdAt: candidate.updatedAt || candidate.createdAt,
            });
          }
        }
      }
  });

  // Sort reminders:
  // 1. Overdue items first (highest priority)
  // 2. Today's upcoming items
  // 3. Tomorrow's upcoming items
  // 4. Missing feedback items
  // 5. Future upcoming items by earliest scheduled date
  // 6. Stalled stage items
  const urgencyWeight: Record<HiringReminderItem['urgency'], number> = {
    overdue: 1,
    today: 2,
    tomorrow: 3,
    action_needed: 4,
    upcoming: 5,
  };

  reminders.sort((a, b) => {
    const weightA = urgencyWeight[a.urgency] ?? 10;
    const weightB = urgencyWeight[b.urgency] ?? 10;

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // Secondary sort by scheduledAt date or createdAt
    const timeA = new Date(a.scheduledAt || a.createdAt || '').getTime() || 0;
    const timeB = new Date(b.scheduledAt || b.createdAt || '').getTime() || 0;

    if (a.category === 'upcoming_interview' && b.category === 'upcoming_interview') {
      return timeA - timeB; // Earliest upcoming first
    }

    return timeB - timeA; // Most recent overdue/action item first
  });

  return reminders;
}
