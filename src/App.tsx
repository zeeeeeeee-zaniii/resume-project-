import React, { useState, useEffect } from 'react';
import { TabType, AnalysisResult, ResumeFile, Job, CandidateRecord, CandidateOutreachLog } from './types';
import { Header, MihoraLogo } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CeoDashboard } from './components/CeoDashboard';
import { JobsView } from './components/JobsView';
import { NewAnalysis } from './components/NewAnalysis';
import { AnalysisResults } from './components/AnalysisResults';
import { CandidateComparison } from './components/CandidateComparison';
import { CandidatesView } from './components/CandidatesView';
import { SettingsView } from './components/SettingsView';
import { SignInView } from './components/SignInView';
import { UnauthorizedView } from './components/UnauthorizedView';
import { checkUserAuthorization } from './lib/auth-policy';
import { 
  auth, 
  testConnection, 
  signInWithGoogle, 
  signOutUser, 
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
  subscribeToUserAnalyses
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [strictDomainEnforcement, setStrictDomainEnforcement] = useState(() => {
    const saved = localStorage.getItem('mihora_strict_domain');
    return saved !== null ? saved === 'true' : true;
  });

  // Real Persistent State from Firestore
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [candidatesList, setCandidatesList] = useState<CandidateRecord[]>([]);
  const [analysesList, setAnalysesList] = useState<AnalysisResult[]>([]);
  
  // Navigation & Workflow state
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [candidatesToCompare, setCandidatesToCompare] = useState<AnalysisResult[] | null>(null);
  const [jobForAnalysis, setJobForAnalysis] = useState<Job | null>(null);
  const [cachedResumeFile, setCachedResumeFile] = useState<ResumeFile | null>(null);

  // Initialize and check connection on boot
  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore Jobs, Candidates, and Analyses when authenticated
  useEffect(() => {
    if (!currentUser) {
      setJobsList([]);
      setCandidatesList([]);
      setAnalysesList([]);
      return;
    }

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
  }, [currentUser]);

  // Auth actions
  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    setSelectedResult(null);
    setJobForAnalysis(null);
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
    job: Job
  ) => {
    setCachedResumeFile(resumeFile);

    if (currentUser) {
      // 1. Generate candidate record
      const candidateId = `cand-${Date.now()}`;
      const candidateName = result.candidateOverview.detectedName || resumeFile?.name || 'Candidate';
      
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
    }

    setSelectedResult(result);
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
      await updateCandidateInFirestore(targetCandidate.id, { notes });
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, notes, updatedAt: new Date().toISOString() }
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

    if (targetCandidate) {
      await updateCandidateInFirestore(targetCandidate.id, { interviews });
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, interviews, updatedAt: new Date().toISOString() }
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

      await updateCandidateInFirestore(targetCandidate.id, { outreachLogs: updatedLogs });

      // Optimistically update candidate in state
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, outreachLogs: updatedLogs, updatedAt: new Date().toISOString() }
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
      await updateCandidateInFirestore(targetCandidate.id, { status });
      setCandidatesList((prev) =>
        prev.map((c) =>
          c.id === targetCandidate!.id
            ? { ...c, status, updatedAt: new Date().toISOString() }
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

  const authResult = checkUserAuthorization(currentUser, strictDomainEnforcement);
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
        onSelectTab={(tab) => {
          setSelectedResult(null);
          setCandidatesToCompare(null);
          setActiveTab(tab);
        }}
        onStartNewAnalysis={() => {
          setCandidatesToCompare(null);
          handleStartNewAnalysis();
        }}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 print:max-w-none print:w-full print:p-0 print:m-0">
        {candidatesToCompare ? (
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
            candidateRecord={candidatesList.find(c => c.analysisId === selectedResult.id || c.id === selectedResult.id)}
            jobs={jobsList}
            currentUserEmail={currentUser?.email || undefined}
            currentUserName={currentUser?.displayName || undefined}
            onSaveOutreachLog={handleSaveCandidateOutreachLog}
            onModifyInputs={() => {
              setSelectedResult(null);
              setActiveTab('new-analysis');
            }}
            onStartNewAnalysis={handleStartNewAnalysis}
            onReanalyze={handleReanalyze}
            onDeleteAnalysis={handleDeleteAnalysis}
            onBackToJob={(jobId) => {
              setSelectedResult(null);
              setActiveTab('jobs');
            }}
            onBackToCandidates={() => {
              setSelectedResult(null);
              setActiveTab('candidates');
            }}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <Dashboard
                onStartNewAnalysis={handleStartNewAnalysis}
                onViewCandidates={() => setActiveTab('candidates')}
                onViewJobs={() => setActiveTab('jobs')}
                onViewAnalytics={() => setActiveTab('analytics')}
                onViewAnalysisResult={handleViewAnalysisResult}
                onStartAnalysisForJob={handleStartAnalysisForJob}
                recentResults={analysesList}
                jobs={jobsList}
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
