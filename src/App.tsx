import React, { useState, useEffect } from 'react';
import { TabType, AnalysisResult, ResumeFile, Job, CandidateRecord, CandidateOutreachLog, CandidateActivityEvent, UserProfile } from './types';
import { formatOutreachTemplateLabel } from './lib/timeline-helpers';
import { Header, MihoraLogo } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CeoDashboard } from './components/CeoDashboard';
import { JobsView } from './components/JobsView';
import { NewAnalysis } from './components/NewAnalysis';
import { AnalysisResults } from './components/AnalysisResults';
import { CandidateComparison } from './components/CandidateComparison';
import { CandidatesView } from './components/CandidatesView';
import { RemindersView } from './components/RemindersView';
import { SettingsView } from './components/SettingsView';
import { MyAnalysesView } from './components/MyAnalysesView';
import { MasterAdminDashboard } from './components/MasterAdminDashboard';
import { computeHiringReminders } from './lib/reminder-helpers';
import { SignInView } from './components/SignInView';
import { UnauthorizedView } from './components/UnauthorizedView';
import { checkUserAuthorization } from './lib/auth-policy';
import { 
  auth, 
  testConnection, 
  signInWithGoogle, 
  signOutUser, 
  saveUserProfile,
  subscribeToUserProfile,
  saveJobToFirestore,
  updateJobInFirestore,
  deleteJobFromFirestore,
  subscribeToUserJobs,
  saveCandidateToFirestore,
  updateCandidateInFirestore,
  deleteCandidateFromFirestore,
  subscribeToUserCandidates,
  saveAnalysisToFirestore, 
  deleteAnalysisFromFirestore,
  subscribeToUserAnalyses,
  savePersonalAnalysisToFirestore,
  deletePersonalAnalysisFromFirestore,
  subscribeToUserPersonalAnalyses
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [strictDomainEnforcement, setStrictDomainEnforcement] = useState(() => {
    const saved = localStorage.getItem('mihora_strict_domain');
    return saved !== null ? saved === 'true' : true;
  });

  // Real Persistent State from Firestore
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [candidatesList, setCandidatesList] = useState<CandidateRecord[]>([]);
  const [analysesList, setAnalysesList] = useState<AnalysisResult[]>([]);
  const [personalAnalysesList, setPersonalAnalysesList] = useState<AnalysisResult[]>([]);
  
  // Navigation & Workflow state
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [candidatesToCompare, setCandidatesToCompare] = useState<AnalysisResult[] | null>(null);
  const [jobForAnalysis, setJobForAnalysis] = useState<Job | null>(null);
  const [cachedResumeFile, setCachedResumeFile] = useState<ResumeFile | null>(null);
  const [candidateActionTarget, setCandidateActionTarget] = useState<{
    candidateId: string;
    action: 'interviews' | 'outreach' | 'timeline';
  } | null>(null);
  const [candidateFilterJobId, setCandidateFilterJobId] = useState<string | null>(null);

  // Compute real actionable reminders across candidates, jobs, and interviews
  const hiringReminders = React.useMemo(() => {
    return computeHiringReminders(candidatesList, jobsList, analysesList);
  }, [candidatesList, jobsList, analysesList]);

  // Initialize, subscribe to user profile, and check connection on boot
  useEffect(() => {
    testConnection();

    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);

      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (user) {
        // Safe profile write/sync
        try {
          await saveUserProfile(user);
        } catch (profileErr) {
          console.warn('Note: Profile write note:', profileErr);
        }

        // Realtime subscription to the user's profile document in Firestore
        unsubProfile = subscribeToUserProfile(user.uid, (profile) => {
          setUserProfile(profile);
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubscribe();
    };
  }, []);

  // Listen to Firestore Jobs, Candidates, and Analyses when authenticated and authorized
  useEffect(() => {
    const authStatus = currentUser
      ? checkUserAuthorization(currentUser, userProfile, strictDomainEnforcement)
      : { isAuthorized: false, isRecruiter: false, role: 'PUBLIC_USER', status: 'PENDING', isMasterAdmin: false };

    if (!currentUser || !authStatus.isAuthorized) {
      setJobsList([]);
      setCandidatesList([]);
      setAnalysesList([]);
      setPersonalAnalysesList([]);
      setSelectedResult(null);
      setCandidatesToCompare(null);
      setJobForAnalysis(null);
      setCachedResumeFile(null);
      setCandidateActionTarget(null);
      setCandidateFilterJobId(null);
      return;
    }

    if (authStatus.isRecruiter && authStatus.status === 'APPROVED') {
      // Approved Recruiter or Master Admin: subscribe to company jobs, candidates, and internal recruitment analyses
      const unsubJobs = subscribeToUserJobs(
        currentUser.uid,
        (jobs) => setJobsList(jobs),
        (err) => console.error('Jobs subscription error:', err)
      );

      const unsubCandidates = subscribeToUserCandidates(
        currentUser.uid,
        (candidates) => setCandidatesList(candidates),
        (err) => console.error('Candidates subscription error:', err)
      );

      const unsubAnalyses = subscribeToUserAnalyses(
        currentUser.uid,
        (analyses) => setAnalysesList(analyses),
        (err) => console.error('Analyses subscription error:', err)
      );

      return () => {
        unsubJobs();
        unsubCandidates();
        unsubAnalyses();
      };
    } else {
      // Public User or Pending: ONLY subscribe to dedicated personal analyses subcollection (/users/{userId}/analyses)
      // Never attempt to query private company jobs, candidates, or analyses
      const unsubPersonal = subscribeToUserPersonalAnalyses(
        currentUser.uid,
        (analyses) => setPersonalAnalysesList(analyses),
        (err) => console.error('Personal analyses subscription error:', err)
      );

      return () => {
        unsubPersonal();
      };
    }
  }, [currentUser, userProfile, strictDomainEnforcement]);

  // Ensure public, pending, or non-admin users are routed away from restricted tabs
  useEffect(() => {
    if (currentUser) {
      const authStatus = checkUserAuthorization(currentUser, userProfile, strictDomainEnforcement);
      if (activeTab === 'admin' && !authStatus.isMasterAdmin) {
        setActiveTab(authStatus.isRecruiter ? 'overview' : 'new-analysis');
        return;
      }
      if (!authStatus.isRecruiter || authStatus.status !== 'APPROVED') {
        const recruiterTabs: TabType[] = ['overview', 'analytics', 'reminders', 'jobs', 'candidates'];
        if (recruiterTabs.includes(activeTab)) {
          setActiveTab('new-analysis');
        }
      }
    }
  }, [currentUser, userProfile, strictDomainEnforcement, activeTab]);

  // Auth actions
  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    setJobsList([]);
    setCandidatesList([]);
    setAnalysesList([]);
    setPersonalAnalysesList([]);
    setSelectedResult(null);
    setCandidatesToCompare(null);
    setJobForAnalysis(null);
    setCachedResumeFile(null);
    setCandidateActionTarget(null);
    setCandidateFilterJobId(null);
    setUserProfile(null);
    setActiveTab('overview');
    await signOutUser();
  };

  // Job CRUD Handlers
  const handleCreateJob = async (jobData: Omit<Job, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser) return;
    const newJob: Job = {
      ...jobData,
      id: `job-${Date.now()}`,
      userId: currentUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveJobToFirestore(newJob, currentUser);
  };

  const handleUpdateJob = async (jobId: string, updates: Partial<Job>) => {
    await updateJobInFirestore(jobId, updates);
  };

  const handleDeleteJob = async (jobId: string, deleteAssociatedCandidates: boolean) => {
    await deleteJobFromFirestore(jobId, { deleteAssociatedCandidates, userId: currentUser?.uid });
    // If the currently viewed result was associated with this job, clear it
    if (selectedResult && selectedResult.jobId === jobId) {
      setSelectedResult(null);
      setActiveTab('jobs');
    }
  };

  // Start analysis workflow from a specific Job
  const handleStartAnalysisForJob = (job: Job) => {
    setSelectedResult(null);
    setCandidatesToCompare(null);
    setJobForAnalysis(job);
    setActiveTab('new-analysis');
  };

  // Start standalone New Analysis
  const handleStartNewAnalysis = () => {
    setSelectedResult(null);
    setCandidatesToCompare(null);
    // Keep jobForAnalysis if set, otherwise NewAnalysis will prompt job selection
    setActiveTab('new-analysis');
  };

  // Analysis Completion Handler
  const handleAnalysisCompleted = async (
    result: AnalysisResult,
    resumeFile: ResumeFile | null,
    _description: string,
    job?: Job | null
  ) => {
    setCachedResumeFile(resumeFile);

    if (currentUser) {
      const authStatus = checkUserAuthorization(currentUser, userProfile, strictDomainEnforcement);
      if (authStatus.isRecruiter && job) {
        // 1. Generate candidate record with initial recorded screening activity event
        const candidateId = `cand-${Date.now()}`;
        const candidateName = result.candidateOverview.detectedName || resumeFile?.name || 'Candidate';
        const actorName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Recruiter';
        const actorEmail = currentUser.email || undefined;

        const initialEvent: CandidateActivityEvent = {
          id: `act-analysis-${Date.now()}`,
          type: 'analysis_completed',
          title: 'Resume Screened & Analysis Completed',
          timestamp: new Date().toISOString(),
          actorName,
          actorEmail,
          details: `Screened for ${job.title} (${job.department}). Overall alignment: ${result.overallRoleAlignment.level}. File: ${resumeFile?.name || result.fileName}.`,
          metadata: {
            fileName: resumeFile?.name || result.fileName,
            alignmentLevel: result.overallRoleAlignment.level,
            jobTitle: job.title,
          },
          source: 'recorded',
        };
        
        const newCandidate: CandidateRecord = {
          id: candidateId,
          jobId: job.id,
          jobTitle: job.title,
          jobDepartment: job.department,
          userId: currentUser.uid,
          name: candidateName,
          location: result.candidateOverview.detectedLocation,
          currentRole: result.candidateOverview.currentOrRecentRole,
          alignmentLevel: result.overallRoleAlignment.level,
          analysisId: result.id,
          analyzedAt: result.analyzedAt,
          status: 'New',
          interviews: [],
          outreachLogs: [],
          activityTimeline: [initialEvent],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          // Save candidate record
          await saveCandidateToFirestore(newCandidate, currentUser);
          // Save analysis linked to job and candidate
          await saveAnalysisToFirestore(result, currentUser, job.id, candidateId);
        } catch (err) {
          console.error('Failed to persist analysis to Firestore:', err);
        }
      } else {
        // PUBLIC USER: Save strictly to personal analyses subcollection (/users/{userId}/analyses/{analysisId})
        // NEVER save public users as internal company candidates or company analyses
        try {
          await savePersonalAnalysisToFirestore(result, currentUser);
        } catch (err) {
          console.error('Failed to persist personal analysis to Firestore:', err);
        }
      }
    }

    setSelectedResult(result);
  };

  // Delete Personal Analysis Record (for public users)
  const handleDeletePersonalAnalysis = async (analysisId: string) => {
    if (!currentUser) return;
    try {
      await deletePersonalAnalysisFromFirestore(currentUser.uid, analysisId);
      if (selectedResult && selectedResult.id === analysisId) {
        setSelectedResult(null);
        setActiveTab('my-analyses');
      }
    } catch (err) {
      console.error('Failed to delete personal analysis:', err);
    }
  };

  // Re-analyze action
  const handleReanalyze = (targetResult: AnalysisResult) => {
    // Find matching job
    const matchingJob = jobsList.find((j) => j.id === targetResult.jobId);
    if (matchingJob) {
      setJobForAnalysis(matchingJob);
    }
    setSelectedResult(null);
    setActiveTab('new-analysis');
  };

  // Delete Analysis Record
  const handleDeleteAnalysis = async (analysisId: string) => {
    // Find candidate record pointing to this analysis or matching id
    const matchingCand = candidatesList.find((c) => c.analysisId === analysisId || c.id === analysisId);
    if (matchingCand) {
      await deleteCandidateFromFirestore(matchingCand.id, matchingCand.analysisId || analysisId);
    } else {
      await deleteAnalysisFromFirestore(analysisId);
    }
    setSelectedResult(null);
    setActiveTab('candidates');
  };

  // Delete Candidate Record directly
  const handleDeleteCandidate = async (candidateIdOrAnalysisId: string) => {
    const matchingCand = candidatesList.find(
      (c) => c.id === candidateIdOrAnalysisId || c.analysisId === candidateIdOrAnalysisId
    );
    if (matchingCand) {
      await deleteCandidateFromFirestore(matchingCand.id, matchingCand.analysisId || candidateIdOrAnalysisId);
    } else {
      await deleteAnalysisFromFirestore(candidateIdOrAnalysisId);
    }
    if (selectedResult && (selectedResult.id === candidateIdOrAnalysisId || selectedResult.candidateId === candidateIdOrAnalysisId)) {
      setSelectedResult(null);
    }
  };

  // Update Candidate Notes (resolves both candidateId and analysisId)
  const handleUpdateCandidateNotes = async (candidateIdOrAnalysisId: string, notes: string) => {
    let targetCandidate = candidatesList.find(
      (c) => c.id === candidateIdOrAnalysisId || c.analysisId === candidateIdOrAnalysisId
    );

    if (!targetCandidate) {
      const matchAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchAnalysis?.candidateId) {
        targetCandidate = candidatesList.find((c) => c.id === matchAnalysis.candidateId);
      }
    }

    if (targetCandidate) {
      const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Recruiter';
      const actorEmail = currentUser?.email || undefined;
      const noteEvent: CandidateActivityEvent = {
        id: `act-notes-${Date.now()}`,
        type: 'notes_updated',
        title: 'Recruiter notes updated',
        timestamp: new Date().toISOString(),
        actorName,
        actorEmail,
        details: notes?.trim() ? (notes.length > 120 ? `${notes.slice(0, 120)}...` : notes) : 'Cleared notes.',
        source: 'recorded',
      };
      const updatedTimeline = [noteEvent, ...(targetCandidate.activityTimeline || [])];

      await updateCandidateInFirestore(targetCandidate.id, { notes, activityTimeline: updatedTimeline });
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, notes, activityTimeline: updatedTimeline, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      const matchingAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchingAnalysis && currentUser) {
        const matchingJob = jobsList.find((j) => j.id === matchingAnalysis.jobId);
        const candidateDocId =
          matchingAnalysis.candidateId && /^[a-zA-Z0-9_-]+$/.test(matchingAnalysis.candidateId)
            ? matchingAnalysis.candidateId
            : `cand-${matchingAnalysis.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const actorName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Recruiter';
        const actorEmail = currentUser.email || undefined;
        const noteEvent: CandidateActivityEvent = {
          id: `act-notes-${Date.now()}`,
          type: 'notes_updated',
          title: 'Recruiter notes recorded',
          timestamp: new Date().toISOString(),
          actorName,
          actorEmail,
          details: notes?.trim() ? (notes.length > 120 ? `${notes.slice(0, 120)}...` : notes) : 'Initial note recorded.',
          source: 'recorded',
        };

        const newRecord: CandidateRecord = {
          id: candidateDocId,
          jobId: matchingAnalysis.jobId || matchingJob?.id || '',
          jobTitle: matchingJob?.title || matchingAnalysis.roleSummary.jobTitle,
          jobDepartment: matchingJob?.department || matchingAnalysis.roleSummary.department,
          userId: currentUser.uid,
          name: matchingAnalysis.candidateOverview.detectedName || matchingAnalysis.fileName,
          location: matchingAnalysis.candidateOverview.detectedLocation,
          currentRole: matchingAnalysis.candidateOverview.currentOrRecentRole,
          alignmentLevel: matchingAnalysis.overallRoleAlignment.level,
          analysisId: matchingAnalysis.id,
          analyzedAt: matchingAnalysis.analyzedAt,
          status: 'New',
          notes,
          interviews: [],
          outreachLogs: [],
          activityTimeline: [noteEvent],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveCandidateToFirestore(newRecord, currentUser);
        matchingAnalysis.candidateId = candidateDocId;
        setCandidatesList((prev) => {
          const exists = prev.some((c) => c.id === newRecord.id || c.analysisId === newRecord.analysisId);
          return exists ? prev.map((c) => (c.id === newRecord.id ? newRecord : c)) : [newRecord, ...prev];
        });
      }
    }
  };

  // Update Candidate Interviews (resolves both candidateId and analysisId)
  const handleUpdateCandidateInterviews = async (
    candidateIdOrAnalysisId: string,
    interviews: CandidateRecord['interviews']
  ) => {
    let targetCandidate = candidatesList.find(
      (c) => c.id === candidateIdOrAnalysisId || c.analysisId === candidateIdOrAnalysisId
    );

    if (!targetCandidate) {
      const matchAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchAnalysis?.candidateId) {
        targetCandidate = candidatesList.find((c) => c.id === matchAnalysis.candidateId);
      }
    }

    const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Recruiter';
    const actorEmail = currentUser?.email || undefined;
    const updatedInterviews = interviews || [];

    if (targetCandidate) {
      const prevInterviews = targetCandidate.interviews || [];
      let eventType: CandidateActivityEvent['type'] = 'interview_scheduled';
      let eventTitle = 'Interview rounds updated';
      let eventDetails = `Active interview rounds updated (${updatedInterviews.length} scheduled/recorded).`;

      if (updatedInterviews.length > prevInterviews.length) {
        const newestRound = updatedInterviews[0];
        eventType = 'interview_scheduled';
        eventTitle = `Interview Scheduled: ${newestRound.interviewType}`;
        eventDetails = `Scheduled with ${newestRound.interviewers?.join(', ') || 'team'}. Slot: ${new Date(newestRound.scheduledAt).toLocaleString()} (${newestRound.durationMinutes}m).`;
      } else if (updatedInterviews.length === prevInterviews.length && updatedInterviews.length > 0) {
        const modified = updatedInterviews.find((curr) => {
          const prev = prevInterviews.find((p) => p.id === curr.id);
          return prev && (prev.status !== curr.status || prev.feedbackNotes !== curr.feedbackNotes || prev.scheduledAt !== curr.scheduledAt);
        });
        if (modified) {
          if (modified.status === 'Completed') {
            eventType = 'interview_completed';
            eventTitle = `Interview Completed: ${modified.interviewType}`;
            eventDetails = `Marked as Completed.${modified.feedbackNotes ? ` Debrief note: "${modified.feedbackNotes}"` : ''}`;
          } else if (modified.status === 'Cancelled') {
            eventType = 'interview_cancelled';
            eventTitle = `Interview Cancelled: ${modified.interviewType}`;
            eventDetails = `Cancelled.${modified.feedbackNotes ? ` Note: "${modified.feedbackNotes}"` : ''}`;
          } else if (modified.status === 'Rescheduled') {
            eventType = 'interview_rescheduled';
            eventTitle = `Interview Rescheduled: ${modified.interviewType}`;
            eventDetails = `Slot moved to: ${new Date(modified.scheduledAt).toLocaleString()}.${modified.feedbackNotes ? ` Note: "${modified.feedbackNotes}"` : ''}`;
          } else {
            eventTitle = `Interview Updated: ${modified.interviewType}`;
            eventDetails = `Status: ${modified.status}.${modified.feedbackNotes ? ` Debrief: "${modified.feedbackNotes}"` : ''}`;
          }
        }
      }

      const interviewEvent: CandidateActivityEvent = {
        id: `act-interview-${Date.now()}`,
        type: eventType,
        title: eventTitle,
        timestamp: new Date().toISOString(),
        actorName,
        actorEmail,
        details: eventDetails,
        source: 'recorded',
      };
      const updatedTimeline = [interviewEvent, ...(targetCandidate.activityTimeline || [])];

      await updateCandidateInFirestore(targetCandidate.id, { interviews, activityTimeline: updatedTimeline });
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, interviews, activityTimeline: updatedTimeline, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      const matchingAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchingAnalysis && currentUser) {
        const matchingJob = jobsList.find((j) => j.id === matchingAnalysis.jobId);
        const candidateDocId =
          matchingAnalysis.candidateId && /^[a-zA-Z0-9_-]+$/.test(matchingAnalysis.candidateId)
            ? matchingAnalysis.candidateId
            : `cand-${matchingAnalysis.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const newestRound = updatedInterviews[0];
        const initialInterviewEvent: CandidateActivityEvent = {
          id: `act-interview-${Date.now()}`,
          type: newestRound?.status === 'Completed' ? 'interview_completed' : 'interview_scheduled',
          title: newestRound ? `Interview ${newestRound.status}: ${newestRound.interviewType}` : 'Interview scheduled',
          timestamp: new Date().toISOString(),
          actorName,
          actorEmail,
          details: newestRound
            ? `Initial round scheduled with ${newestRound.interviewers?.join(', ') || 'team'}. Slot: ${new Date(newestRound.scheduledAt).toLocaleString()}.`
            : 'Initial interview round scheduled.',
          source: 'recorded',
        };

        const newRecord: CandidateRecord = {
          id: candidateDocId,
          jobId: matchingAnalysis.jobId || matchingJob?.id || '',
          jobTitle: matchingJob?.title || matchingAnalysis.roleSummary.jobTitle,
          jobDepartment: matchingJob?.department || matchingAnalysis.roleSummary.department,
          userId: currentUser.uid,
          name: matchingAnalysis.candidateOverview.detectedName || matchingAnalysis.fileName,
          location: matchingAnalysis.candidateOverview.detectedLocation,
          currentRole: matchingAnalysis.candidateOverview.currentOrRecentRole,
          alignmentLevel: matchingAnalysis.overallRoleAlignment.level,
          analysisId: matchingAnalysis.id,
          analyzedAt: matchingAnalysis.analyzedAt,
          status: 'Interview',
          interviews: interviews || [],
          outreachLogs: [],
          activityTimeline: [initialInterviewEvent],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveCandidateToFirestore(newRecord, currentUser);
        matchingAnalysis.candidateId = candidateDocId;
        setCandidatesList((prev) => {
          const exists = prev.some((c) => c.id === newRecord.id || c.analysisId === newRecord.analysisId);
          return exists ? prev.map((c) => (c.id === newRecord.id ? newRecord : c)) : [newRecord, ...prev];
        });
      }
    }
  };

  // Log Candidate Outreach
  const handleSaveCandidateOutreachLog = async (
    candidateIdOrAnalysisId: string,
    log: CandidateOutreachLog
  ) => {
    if (!currentUser) {
      throw new Error('Authentication required to save candidate outreach.');
    }

    // Sanitize log to guarantee no undefined fields are passed to Firestore
    const sanitizedLog: CandidateOutreachLog = {
      id: log.id || `outreach-${Date.now()}`,
      templateType: log.templateType,
      subject: log.subject?.trim() || 'Outreach Communication',
      sentAt: log.sentAt || new Date().toISOString(),
      senderName: log.senderName?.trim() || (currentUser.displayName || currentUser.email?.split('@')[0] || 'Recruiter'),
      ...(log.recipientEmail?.trim() ? { recipientEmail: log.recipientEmail.trim() } : {}),
      ...(log.notes?.trim() ? { notes: log.notes.trim() } : {}),
    };

    // 1. Locate existing candidate record by ID or by analysisId
    let targetCandidate = candidatesList.find(
      (c) => c.id === candidateIdOrAnalysisId || c.analysisId === candidateIdOrAnalysisId
    );

    // If not found directly, check if candidateIdOrAnalysisId matches an analysis that points to a candidateId
    if (!targetCandidate) {
      const matchAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchAnalysis?.candidateId) {
        targetCandidate = candidatesList.find((c) => c.id === matchAnalysis.candidateId);
      }
    }

    if (targetCandidate) {
      const existingLogs = Array.isArray(targetCandidate.outreachLogs) ? targetCandidate.outreachLogs : [];
      const updatedLogs = [sanitizedLog, ...existingLogs];

      const actorName = sanitizedLog.senderName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Recruiter';
      const actorEmail = currentUser.email || undefined;
      const outreachEvent: CandidateActivityEvent = {
        id: `act-outreach-${sanitizedLog.id}`,
        type: 'outreach_logged',
        title: `Outreach Logged: ${formatOutreachTemplateLabel(sanitizedLog.templateType)}`,
        timestamp: sanitizedLog.sentAt,
        actorName,
        actorEmail,
        details: `Subject: "${sanitizedLog.subject}"${sanitizedLog.recipientEmail ? ` · To: ${sanitizedLog.recipientEmail}` : ''}${sanitizedLog.notes ? ` · Note: ${sanitizedLog.notes}` : ''}`,
        source: 'recorded',
      };
      const updatedTimeline = [outreachEvent, ...(targetCandidate.activityTimeline || [])];

      await updateCandidateInFirestore(targetCandidate.id, { outreachLogs: updatedLogs, activityTimeline: updatedTimeline });

      // Optimistically update candidate in state
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, outreachLogs: updatedLogs, activityTimeline: updatedTimeline, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      // Candidate doc does not exist yet; create from matching analysis
      const matchingAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );

      if (matchingAnalysis) {
        const matchingJob = jobsList.find((j) => j.id === matchingAnalysis.jobId);
        // Use deterministic document ID to prevent duplicate candidate records
        const candidateDocId =
          matchingAnalysis.candidateId && /^[a-zA-Z0-9_-]+$/.test(matchingAnalysis.candidateId)
            ? matchingAnalysis.candidateId
            : `cand-${matchingAnalysis.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const actorName = sanitizedLog.senderName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Recruiter';
        const actorEmail = currentUser.email || undefined;
        const outreachEvent: CandidateActivityEvent = {
          id: `act-outreach-${sanitizedLog.id}`,
          type: 'outreach_logged',
          title: `Outreach Logged: ${formatOutreachTemplateLabel(sanitizedLog.templateType)}`,
          timestamp: sanitizedLog.sentAt,
          actorName,
          actorEmail,
          details: `Subject: "${sanitizedLog.subject}"${sanitizedLog.recipientEmail ? ` · To: ${sanitizedLog.recipientEmail}` : ''}${sanitizedLog.notes ? ` · Note: ${sanitizedLog.notes}` : ''}`,
          source: 'recorded',
        };

        const newRecord: CandidateRecord = {
          id: candidateDocId,
          jobId: matchingAnalysis.jobId || matchingJob?.id || '',
          jobTitle: matchingJob?.title || matchingAnalysis.roleSummary.jobTitle,
          jobDepartment: matchingJob?.department || matchingAnalysis.roleSummary.department,
          userId: currentUser.uid,
          name: matchingAnalysis.candidateOverview.detectedName || matchingAnalysis.fileName,
          location: matchingAnalysis.candidateOverview.detectedLocation,
          currentRole: matchingAnalysis.candidateOverview.currentOrRecentRole,
          alignmentLevel: matchingAnalysis.overallRoleAlignment.level,
          analysisId: matchingAnalysis.id,
          analyzedAt: matchingAnalysis.analyzedAt,
          status: 'New',
          outreachLogs: [sanitizedLog],
          activityTimeline: [outreachEvent],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveCandidateToFirestore(newRecord, currentUser);

        // Update analysis reference
        matchingAnalysis.candidateId = candidateDocId;

        // Optimistically update candidatesList to prevent duplicates
        setCandidatesList((prev) => {
          const exists = prev.some((c) => c.id === newRecord.id || c.analysisId === newRecord.analysisId);
          return exists ? prev.map((c) => (c.id === newRecord.id ? newRecord : c)) : [newRecord, ...prev];
        });
      } else {
        throw new Error(`Candidate or analysis record not found for ID: ${candidateIdOrAnalysisId}`);
      }
    }
  };

  // Update Candidate Pipeline Status
  const handleUpdateCandidateStatus = async (candidateIdOrAnalysisId: string, status: CandidateRecord['status']) => {
    let targetCandidate = candidatesList.find(
      (c) => c.id === candidateIdOrAnalysisId || c.analysisId === candidateIdOrAnalysisId
    );

    if (!targetCandidate) {
      const matchAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchAnalysis?.candidateId) {
        targetCandidate = candidatesList.find((c) => c.id === matchAnalysis.candidateId);
      }
    }

    if (targetCandidate) {
      const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Recruiter';
      const actorEmail = currentUser?.email || undefined;
      const prevStage = targetCandidate.status || 'New';
      const statusEvent: CandidateActivityEvent = {
        id: `act-status-${Date.now()}`,
        type: 'status_changed',
        title: `Stage moved to ${status}`,
        timestamp: new Date().toISOString(),
        actorName,
        actorEmail,
        details: `Candidate stage moved from ${prevStage} to ${status}.`,
        source: 'recorded',
      };
      const updatedTimeline = [statusEvent, ...(targetCandidate.activityTimeline || [])];

      await updateCandidateInFirestore(targetCandidate.id, { status, activityTimeline: updatedTimeline });
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, status, activityTimeline: updatedTimeline, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      // Find matching analysis if candidate doc doesn't exist yet in Firestore
      const matchingAnalysis = analysesList.find(
        (a) => a.id === candidateIdOrAnalysisId || a.candidateId === candidateIdOrAnalysisId
      );
      if (matchingAnalysis && currentUser) {
        const matchingJob = jobsList.find((j) => j.id === matchingAnalysis.jobId);
        const candidateDocId =
          matchingAnalysis.candidateId && /^[a-zA-Z0-9_-]+$/.test(matchingAnalysis.candidateId)
            ? matchingAnalysis.candidateId
            : `cand-${matchingAnalysis.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const actorName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Recruiter';
        const actorEmail = currentUser.email || undefined;
        const statusEvent: CandidateActivityEvent = {
          id: `act-status-${Date.now()}`,
          type: 'status_changed',
          title: `Stage moved to ${status}`,
          timestamp: new Date().toISOString(),
          actorName,
          actorEmail,
          details: `Initial candidate stage set to ${status}.`,
          source: 'recorded',
        };

        const newRecord: CandidateRecord = {
          id: candidateDocId,
          jobId: matchingAnalysis.jobId || matchingJob?.id || '',
          jobTitle: matchingJob?.title || matchingAnalysis.roleSummary.jobTitle,
          jobDepartment: matchingJob?.department || matchingAnalysis.roleSummary.department,
          userId: currentUser.uid,
          name: matchingAnalysis.candidateOverview.detectedName || matchingAnalysis.fileName,
          location: matchingAnalysis.candidateOverview.detectedLocation,
          currentRole: matchingAnalysis.candidateOverview.currentOrRecentRole,
          alignmentLevel: matchingAnalysis.overallRoleAlignment.level,
          analysisId: matchingAnalysis.id,
          analyzedAt: matchingAnalysis.analyzedAt,
          status,
          interviews: [],
          outreachLogs: [],
          activityTimeline: [statusEvent],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveCandidateToFirestore(newRecord, currentUser);
        matchingAnalysis.candidateId = candidateDocId;
        setCandidatesList((prev) => {
          const exists = prev.some((c) => c.id === newRecord.id || c.analysisId === newRecord.analysisId);
          return exists ? prev.map((c) => (c.id === newRecord.id ? newRecord : c)) : [newRecord, ...prev];
        });
      }
    }
  };

  // View specific analysis
  const handleViewAnalysisResult = (result: AnalysisResult) => {
    setSelectedResult(result);
  };

  const handleViewAnalysisById = (analysisId: string) => {
    const matching = analysesList.find((a) => a.id === analysisId);
    if (matching) {
      setSelectedResult(matching);
    }
  };

  /* =======================================================================
     REQUIREMENT 1: AUTHENTICATION MUST COME FIRST
     Unauthenticated users must NOT be able to access dashboard data, jobs,
     candidates, or analyses.
     ======================================================================= */
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
          <div className="text-sm font-semibold tracking-tight text-slate-800">
            Initializing Mihora Resume Intelligence...
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <SignInView onSignIn={handleSignIn} />;
  }

  const authResult = checkUserAuthorization(currentUser, userProfile, strictDomainEnforcement);
  if (!authResult.isAuthorized) {
    return (
      <UnauthorizedView
        user={currentUser}
        onSignOut={handleSignOut}
        onSwitchAccount={handleSignIn}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 bg-mihora-grid print:min-h-0 print:bg-white print:bg-none print:p-0 print:m-0">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        userRole={authResult.role}
        onSelectTab={(tab) => {
          setSelectedResult(null);
          setCandidatesToCompare(null);
          setActiveTab(tab);
        }}
        onStartNewAnalysis={() => {
          setSelectedResult(null);
          setCandidatesToCompare(null);
          handleStartNewAnalysis();
        }}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        reminderCount={authResult.isRecruiter ? hiringReminders.length : 0}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 print:max-w-none print:w-full print:p-0 print:m-0">
        {activeTab === 'admin' && authResult.isMasterAdmin ? (
          <MasterAdminDashboard currentUser={currentUser} />
        ) : candidatesToCompare ? (
          <CandidateComparison
            candidates={candidatesToCompare}
            candidateRecords={candidatesList}
            jobs={jobsList}
            onBack={() => setCandidatesToCompare(null)}
            onViewCandidateAnalysis={(analysis) => {
              setSelectedResult(analysis);
            }}
            onUpdateCandidateStatus={handleUpdateCandidateStatus}
            onUpdateCandidateNotes={handleUpdateCandidateNotes}
            currentUserEmail={currentUser?.email || undefined}
            currentUserName={currentUser?.displayName || undefined}
            onSaveCandidateOutreach={handleSaveCandidateOutreachLog}
          />
        ) : selectedResult ? (
          <AnalysisResults
            result={selectedResult}
            candidateRecord={
              authResult.isRecruiter
                ? candidatesList.find((c) => c.analysisId === selectedResult.id || c.id === selectedResult.id)
                : null
            }
            jobs={jobsList}
            currentUserEmail={currentUser?.email || undefined}
            currentUserName={currentUser?.displayName || undefined}
            onSaveOutreachLog={authResult.isRecruiter ? handleSaveCandidateOutreachLog : undefined}
            onUpdateCandidateInterviews={authResult.isRecruiter ? handleUpdateCandidateInterviews : undefined}
            onUpdateCandidateStatus={authResult.isRecruiter ? handleUpdateCandidateStatus : undefined}
            onModifyInputs={() => {
              setSelectedResult(null);
              setActiveTab('new-analysis');
            }}
            onStartNewAnalysis={handleStartNewAnalysis}
            onReanalyze={authResult.isRecruiter ? handleReanalyze : undefined}
            onDeleteAnalysis={authResult.isRecruiter ? handleDeleteAnalysis : handleDeletePersonalAnalysis}
            onBackToJob={
              authResult.isRecruiter
                ? (jobId) => {
                    setSelectedResult(null);
                    setActiveTab('jobs');
                  }
                : undefined
            }
            onBackToCandidates={
              authResult.isRecruiter
                ? () => {
                    setSelectedResult(null);
                    setActiveTab('candidates');
                  }
                : undefined
            }
            onBackToAnalyses={
              !authResult.isRecruiter
                ? () => {
                    setSelectedResult(null);
                    setActiveTab('my-analyses');
                  }
                : undefined
            }
          />
        ) : authResult.isRecruiter ? (
          // ================= RECRUITER WORKSPACE TABS =================
          <>
            {activeTab === 'overview' && (
              <Dashboard
                onStartNewAnalysis={handleStartNewAnalysis}
                onViewCandidates={() => setActiveTab('candidates')}
                onViewJobs={() => setActiveTab('jobs')}
                onViewAnalytics={() => setActiveTab('analytics')}
                onViewReminders={() => setActiveTab('reminders')}
                onViewAnalysisResult={handleViewAnalysisResult}
                onStartAnalysisForJob={handleStartAnalysisForJob}
                onOpenCandidateInterviews={(candidateId) => {
                  setCandidateActionTarget({ candidateId, action: 'interviews' });
                  setActiveTab('candidates');
                }}
                recentResults={analysesList}
                candidates={candidatesList}
                jobs={jobsList}
              />
            )}

            {activeTab === 'reminders' && (
              <RemindersView
                candidates={candidatesList}
                analyses={analysesList}
                jobs={jobsList}
                onSelectCandidateAnalysis={handleViewAnalysisById}
                onNavigateToCandidates={(candId) => {
                  if (candId) {
                    setCandidateActionTarget({ candidateId: candId, action: 'interviews' });
                  }
                  setActiveTab('candidates');
                }}
                onOpenInterviewsModal={(candidate) => {
                  setCandidateActionTarget({ candidateId: candidate.id, action: 'interviews' });
                  setActiveTab('candidates');
                }}
                onOpenOutreachModal={(candidate) => {
                  setCandidateActionTarget({ candidateId: candidate.id, action: 'outreach' });
                  setActiveTab('candidates');
                }}
                onOpenTimelineModal={(candidate) => {
                  setCandidateActionTarget({ candidateId: candidate.id, action: 'timeline' });
                  setActiveTab('candidates');
                }}
                onStartNewAnalysis={handleStartNewAnalysis}
                currentUserEmail={currentUser?.email || undefined}
                currentUserName={currentUser?.displayName || undefined}
              />
            )}

            {activeTab === 'analytics' && (
              <CeoDashboard
                jobs={jobsList}
                candidates={candidatesList}
                analyses={analysesList}
                onViewJobs={() => setActiveTab('jobs')}
                onViewCandidates={() => setActiveTab('candidates')}
                onStartNewAnalysis={handleStartNewAnalysis}
                onSelectCandidateAnalysis={handleViewAnalysisById}
                onStartAnalysisForJob={handleStartAnalysisForJob}
                onViewReminders={() => setActiveTab('reminders')}
              />
            )}

            {activeTab === 'jobs' && (
              <JobsView
                jobs={jobsList}
                candidates={candidatesList}
                onCreateJob={handleCreateJob}
                onUpdateJob={handleUpdateJob}
                onDeleteJob={handleDeleteJob}
                onStartAnalysisForJob={handleStartAnalysisForJob}
                onViewCandidateAnalysis={handleViewAnalysisById}
                onViewJobCandidates={(jobId) => {
                  setCandidateFilterJobId(jobId);
                  setActiveTab('candidates');
                }}
              />
            )}

            {activeTab === 'new-analysis' && (
              <NewAnalysis
                jobs={jobsList}
                selectedJobId={jobForAnalysis?.id}
                onSelectJob={(j) => setJobForAnalysis(j)}
                onCreateJobClick={() => setActiveTab('jobs')}
                onAnalysisCompleted={handleAnalysisCompleted}
                onCancel={() => {
                  setJobForAnalysis(null);
                  setActiveTab('jobs');
                }}
                initialResumeFile={cachedResumeFile}
                isRecruiter={true}
              />
            )}

            {activeTab === 'candidates' && (
              <CandidatesView
                candidates={analysesList}
                candidateRecords={candidatesList}
                jobs={jobsList}
                onSelectCandidate={handleViewAnalysisResult}
                onStartNewAnalysis={handleStartNewAnalysis}
                onDeleteCandidate={handleDeleteCandidate}
                onUpdateCandidateNotes={handleUpdateCandidateNotes}
                onUpdateCandidateStatus={handleUpdateCandidateStatus}
                onUpdateCandidateInterviews={handleUpdateCandidateInterviews}
                currentUserEmail={currentUser?.email || undefined}
                currentUserName={currentUser?.displayName || undefined}
                onSaveCandidateOutreach={handleSaveCandidateOutreachLog}
                onCompareCandidates={(selected) => setCandidatesToCompare(selected)}
                initialTargetCandidateId={candidateActionTarget?.candidateId}
                initialAction={candidateActionTarget?.action}
                onClearInitialAction={() => setCandidateActionTarget(null)}
                initialSelectedJobId={candidateFilterJobId}
                onClearInitialJobFilter={() => setCandidateFilterJobId(null)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                strictDomainEnforcement={strictDomainEnforcement}
                onToggleStrictDomain={(val) => {
                  setStrictDomainEnforcement(val);
                  localStorage.setItem('mihora_strict_domain', String(val));
                }}
              />
            )}
          </>
        ) : (
          // ================= PUBLIC USER WORKSPACE TABS =================
          <>
            {activeTab === 'new-analysis' && (
              <NewAnalysis
                jobs={[]}
                onAnalysisCompleted={handleAnalysisCompleted}
                onCancel={() => {
                  setSelectedResult(null);
                  setActiveTab('my-analyses');
                }}
                initialResumeFile={cachedResumeFile}
                isRecruiter={false}
              />
            )}

            {(activeTab === 'my-analyses' || activeTab === 'overview' || activeTab === 'candidates' || activeTab === 'jobs' || activeTab === 'analytics' || activeTab === 'reminders') && (
              <MyAnalysesView
                analyses={personalAnalysesList}
                onSelectAnalysis={handleViewAnalysisResult}
                onStartNewAnalysis={handleStartNewAnalysis}
                onDeleteAnalysis={handleDeletePersonalAnalysis}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                strictDomainEnforcement={strictDomainEnforcement}
                onToggleStrictDomain={(val) => {
                  setStrictDomainEnforcement(val);
                  localStorage.setItem('mihora_strict_domain', String(val));
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Corporate Enterprise Footer */}
      <footer className="mt-auto border-t border-slate-200/90 bg-white/80 backdrop-blur-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <MihoraLogo className="w-5 h-5 text-slate-400" />
            <span className="font-semibold text-slate-700">Mihora Tech</span>
            <span>·</span>
            <span>Resume Intelligence</span>
            <span>·</span>
            <span>Internal Talent Screening</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Firebase Firestore europe-west2</span>
            <span>·</span>
            <span>Candidate Location Intelligence</span>
            <span>·</span>
            <span>Human-Governed Decisions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
