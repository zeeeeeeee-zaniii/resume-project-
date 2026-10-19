import React, { useState, useEffect } from 'react';
import {
  Calendar,
  X,
  Plus,
  Clock,
  Video,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarDays,
  Edit3,
  ExternalLink,
  Trash2,
  MessageSquare
} from 'lucide-react';
import {
  AnalysisResult,
  CandidateRecord,
  CandidateInterview,
  InterviewSlotStatus
} from '../types';

export const getInterviewStatusBadgeStyle = (status: InterviewSlotStatus): string => {
  switch (status) {
    case 'Scheduled':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Rescheduled':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

interface CandidateInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateAnalysis: AnalysisResult | null;
  candidateRecord?: CandidateRecord | null;
  onUpdateCandidateInterviews?: (
    candidateIdOrAnalysisId: string,
    interviews: CandidateInterview[]
  ) => Promise<void>;
  currentUserEmail?: string;
  currentUserName?: string;
}

export const CandidateInterviewModal: React.FC<CandidateInterviewModalProps> = ({
  isOpen,
  onClose,
  candidateAnalysis,
  candidateRecord,
  onUpdateCandidateInterviews,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Round Form State
  const [isAddingNewRound, setIsAddingNewRound] = useState(false);
  const [newInterviewType, setNewInterviewType] = useState<CandidateInterview['interviewType']>('Technical Round');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [newDurationMinutes, setNewDurationMinutes] = useState(45);
  const [newInterviewers, setNewInterviewers] = useState('');
  const [newMeetingLink, setNewMeetingLink] = useState('');
  const [newFeedbackNotes, setNewFeedbackNotes] = useState('');

  // Editing Round State (for status update, rescheduling, and debrief notes)
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<InterviewSlotStatus>('Scheduled');
  const [editingScheduledAt, setEditingScheduledAt] = useState('');
  const [editingMeetingLink, setEditingMeetingLink] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  // Delete confirmation state
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);

  // Reset and initialize default scheduled time when opening
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsAddingNewRound(false);
      setEditingRoundId(null);
      setDeletingRoundId(null);

      // Default scheduled time: tomorrow at 10:00 AM local time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const tzOffset = tomorrow.getTimezoneOffset() * 60000;
      const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
      setNewScheduledAt(localISOTime);
      setNewInterviewType('Technical Round');
      setNewDurationMinutes(45);
      setNewInterviewers('');
      setNewMeetingLink('');
      setNewFeedbackNotes('');
    }
  }, [isOpen]);

  if (!isOpen || (!candidateAnalysis && !candidateRecord)) {
    return null;
  }

  const candidateName =
    candidateRecord?.name ||
    candidateAnalysis?.candidateOverview.detectedName ||
    candidateAnalysis?.fileName ||
    'Candidate';

  const jobTitle =
    candidateRecord?.jobTitle ||
    candidateAnalysis?.roleSummary.jobTitle ||
    'Target Requisition';

  const interviewsList = candidateRecord?.interviews || [];
  const candidateTargetId = candidateRecord?.id || candidateAnalysis?.id;

  const handleStartEditingRound = (round: CandidateInterview) => {
    setEditingRoundId(round.id);
    setEditingStatus(round.status);
    setEditingNotes(round.feedbackNotes || '');
    setEditingMeetingLink(round.meetingLinkOrLocation || '');

    // Format ISO string to datetime-local value
    const roundDate = new Date(round.scheduledAt);
    if (!isNaN(roundDate.getTime())) {
      const tzOffset = roundDate.getTimezoneOffset() * 60000;
      const localISO = new Date(roundDate.getTime() - tzOffset).toISOString().slice(0, 16);
      setEditingScheduledAt(localISO);
    } else {
      setEditingScheduledAt('');
    }
    setErrorMessage(null);
  };

  const handleCreateInterviewRound = async () => {
    if (!onUpdateCandidateInterviews || !candidateTargetId) return;

    if (!newScheduledAt) {
      setErrorMessage('Please select an interview date and start time.');
      return;
    }

    const interviewersList = newInterviewers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (interviewersList.length === 0) {
      setErrorMessage('Please specify at least one interviewer name or email address.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    try {
      const newRound: CandidateInterview = {
        id: `int-${Date.now()}`,
        candidateId: candidateTargetId,
        interviewType: newInterviewType,
        interviewers: interviewersList,
        scheduledAt: new Date(newScheduledAt).toISOString(),
        durationMinutes: Number(newDurationMinutes) || 45,
        meetingLinkOrLocation: newMeetingLink.trim() || undefined,
        status: 'Scheduled',
        feedbackNotes: newFeedbackNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedInterviews = [...interviewsList, newRound];
      await onUpdateCandidateInterviews(candidateTargetId, updatedInterviews);

      setIsAddingNewRound(false);
      setNewInterviewers('');
      setNewMeetingLink('');
      setNewFeedbackNotes('');
    } catch (err: any) {
      console.error('Failed to create interview round:', err);
      setErrorMessage('Failed to save interview round. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRoundChanges = async (roundId: string) => {
    if (!onUpdateCandidateInterviews || !candidateTargetId) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updatedInterviews = interviewsList.map((item) => {
        if (item.id === roundId) {
          let updatedScheduledAt = item.scheduledAt;
          if (editingStatus === 'Rescheduled' && editingScheduledAt) {
            const parsed = new Date(editingScheduledAt);
            if (!isNaN(parsed.getTime())) {
              updatedScheduledAt = parsed.toISOString();
            }
          }

          return {
            ...item,
            status: editingStatus,
            scheduledAt: updatedScheduledAt,
            meetingLinkOrLocation: editingMeetingLink.trim() || item.meetingLinkOrLocation,
            feedbackNotes: editingNotes.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      await onUpdateCandidateInterviews(candidateTargetId, updatedInterviews);
      setEditingRoundId(null);
    } catch (err: any) {
      console.error('Failed to update interview round:', err);
      setErrorMessage('Failed to update interview round. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!onUpdateCandidateInterviews || !candidateTargetId) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updatedInterviews = interviewsList.filter((item) => item.id !== roundId);
      await onUpdateCandidateInterviews(candidateTargetId, updatedInterviews);
      setDeletingRoundId(null);
      if (editingRoundId === roundId) {
        setEditingRoundId(null);
      }
    } catch (err: any) {
      console.error('Failed to delete interview round:', err);
      setErrorMessage('Failed to delete interview round.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Interview Scheduling & Status
              </h3>
              <p className="text-xs text-slate-500">
                Candidate: <strong className="text-slate-800">{candidateName}</strong> · Requisition:{' '}
                <span className="text-slate-700 font-medium">{jobTitle}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-2 text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body: Scrollable */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Top Action Bar: Add Round Toggle */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Scheduled Rounds ({interviewsList.length})
              </span>
            </div>

            {!isAddingNewRound && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingNewRound(true);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule New Round</span>
              </button>
            )}
          </div>

          {/* Form: Add New Interview Round */}
          {isAddingNewRound && (
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <span className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-purple-600" />
                  <span>Schedule Interview Round</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewRound(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Interview Type */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block text-[11px]">
                    Round Type *
                  </label>
                  <select
                    value={newInterviewType}
                    onChange={(e) =>
                      setNewInterviewType(e.target.value as CandidateInterview['interviewType'])
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-md focus:border-purple-600 focus:outline-hidden text-xs"
                  >
                    <option value="Phone Screen">Phone Screen (Recruiter)</option>
                    <option value="Technical Round">Technical Round / Coding</option>
                    <option value="Hiring Manager">Hiring Manager Debrief</option>
                    <option value="Culture Fit">Culture Fit / Values</option>
                    <option value="Final Round">Final Round / Executive</option>
                  </select>
                </div>

                {/* Date and Time */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block text-[11px]">
                    Date & Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={newScheduledAt}
                    onChange={(e) => setNewScheduledAt(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md focus:border-purple-600 focus:outline-hidden text-xs font-mono"
                  />
                </div>

                {/* Duration in minutes */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block text-[11px]">
                    Duration (Minutes)
                  </label>
                  <select
                    value={newDurationMinutes}
                    onChange={(e) => setNewDurationMinutes(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-md focus:border-purple-600 focus:outline-hidden text-xs"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </div>

                {/* Interviewers */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block text-[11px]">
                    Interviewers * (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={newInterviewers}
                    onChange={(e) => setNewInterviewers(e.target.value)}
                    placeholder="e.g. Sarah Jenkins (Lead), David Kim"
                    className="w-full p-2 bg-white border border-slate-300 rounded-md focus:border-purple-600 focus:outline-hidden text-xs"
                  />
                </div>
              </div>

              {/* Meeting Link or Location */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block text-[11px]">
                  Meeting Link or Office Location
                </label>
                <div className="relative">
                  <Video className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={newMeetingLink}
                    onChange={(e) => setNewMeetingLink(e.target.value)}
                    placeholder="e.g. https://meet.google.com/abc-defg-hij or Room 302"
                    className="w-full pl-8 p-2 bg-white border border-slate-300 rounded-md focus:border-purple-600 focus:outline-hidden text-xs"
                  />
                </div>
              </div>

              {/* Initial Focus / Debrief notes */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block text-[11px]">
                  Initial Focus or Interview Prep Notes
                </label>
                <textarea
                  rows={2}
                  value={newFeedbackNotes}
                  onChange={(e) => setNewFeedbackNotes(e.target.value)}
                  placeholder="e.g. Assess cloud architecture experience and distributed systems depth..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-md focus:border-purple-600 focus:outline-hidden text-xs resize-none"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNewRound(false)}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateInterviewRound}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-md shadow-2xs disabled:opacity-60 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? 'Saving Round...' : 'Confirm Schedule'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Chronological List of Interview Rounds */}
          {interviewsList.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
              <div className="w-10 h-10 mx-auto rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 text-xs">
                  No interview rounds scheduled yet
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Schedule phone screens, technical evaluations, or hiring manager rounds to coordinate candidate evaluations.
                </p>
              </div>
              {!isAddingNewRound && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewRound(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule First Interview Round</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {[...interviewsList]
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((round, idx) => {
                  const isEditingThisRound = editingRoundId === round.id;
                  const roundDate = new Date(round.scheduledAt);
                  const formattedDate = isNaN(roundDate.getTime())
                    ? round.scheduledAt
                    : roundDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                  return (
                    <div
                      key={round.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-3 transition-colors"
                    >
                      {/* Round Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">
                              Round {idx + 1}: {round.interviewType}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getInterviewStatusBadgeStyle(
                                round.status
                              )}`}
                            >
                              {round.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                            <span>{formattedDate}</span>
                            <span>·</span>
                            <span>{round.durationMinutes} min</span>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isEditingThisRound && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditingRound(round)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                              title="Update outcome, reschedule date, or enter feedback notes"
                            >
                              <Edit3 className="w-3 h-3 text-slate-500" />
                              <span>Update / Reschedule</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingRoundId(round.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete this interview round"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Delete Confirmation Alert */}
                      {deletingRoundId === round.id && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-3 text-xs text-rose-800 animate-in fade-in">
                          <span>Delete this interview round record?</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDeletingRoundId(null)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRound(round.id)}
                              disabled={isSaving}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-2xs cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Interviewers & Location */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-700">Interviewers:</span>{' '}
                          <span>{round.interviewers?.join(', ') || 'Not specified'}</span>
                        </div>
                        {round.meetingLinkOrLocation && (
                          <div className="truncate">
                            <span className="font-semibold text-slate-700">Location:</span>{' '}
                            {round.meetingLinkOrLocation.startsWith('http') ? (
                              <a
                                href={round.meetingLinkOrLocation}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                <span className="truncate">{round.meetingLinkOrLocation}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            ) : (
                              <span className="font-mono text-[10px]">{round.meetingLinkOrLocation}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Debrief & Feedback Notes */}
                      {round.feedbackNotes && !isEditingThisRound && (
                        <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200/80 leading-relaxed font-sans">
                          <span className="font-bold text-slate-700 block mb-0.5 flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            <span>Debrief & Feedback Notes:</span>
                          </span>
                          <p className="whitespace-pre-wrap">{round.feedbackNotes}</p>
                        </div>
                      )}

                      {/* In-Place Status, Rescheduling & Feedback Editing Form */}
                      {isEditingThisRound && (
                        <div className="pt-2 border-t border-slate-100 space-y-3 bg-slate-50/80 p-3.5 rounded-lg border border-slate-200 animate-in fade-in duration-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-semibold text-slate-700 text-[11px] block">
                                Round Outcome Status:
                              </label>
                              <select
                                value={editingStatus}
                                onChange={(e) => setEditingStatus(e.target.value as InterviewSlotStatus)}
                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs focus:border-purple-600 focus:outline-hidden"
                              >
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed (Passed / Feedback Logged)</option>
                                <option value="Rescheduled">Rescheduled (Move Date/Time)</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </div>

                            {/* When Rescheduled, show date/time input to update the slot */}
                            {editingStatus === 'Rescheduled' && (
                              <div className="space-y-1 animate-in fade-in">
                                <label className="font-semibold text-slate-700 text-[11px] block">
                                  New Date & Start Time *
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editingScheduledAt}
                                  onChange={(e) => setEditingScheduledAt(e.target.value)}
                                  className="w-full p-1.5 bg-white border border-amber-300 rounded text-xs focus:border-amber-600 focus:outline-hidden font-mono"
                                />
                              </div>
                            )}
                          </div>

                          {/* Meeting Link Edit (Available when editing or rescheduling) */}
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-700 text-[11px] block">
                              Meeting Link or Location
                            </label>
                            <input
                              type="text"
                              value={editingMeetingLink}
                              onChange={(e) => setEditingMeetingLink(e.target.value)}
                              placeholder="e.g. https://meet.google.com/abc-defg-hij or Room 302"
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs focus:border-purple-600 focus:outline-hidden"
                            />
                          </div>

                          {/* Feedback / Debrief notes */}
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-700 text-[11px] block">
                              Debrief / Interviewer Feedback Notes:
                            </label>
                            <textarea
                              rows={3}
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Document candidate evaluation, strengths, gaps clarified, and recommendations..."
                              className="w-full p-2 bg-white border border-slate-300 rounded text-xs focus:border-purple-600 focus:outline-hidden resize-none"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingRoundId(null)}
                              disabled={isSaving}
                              className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveRoundChanges(round.id)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded shadow-2xs disabled:opacity-60 cursor-pointer"
                            >
                              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
