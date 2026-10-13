import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc,
  getDocFromServer,
  collection, 
  query, 
  where, 
  onSnapshot,
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AnalysisResult, Job, CandidateRecord } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Initialize Firestore with the exact database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Sign in with Google Popup
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await saveUserProfile(result.user);
    }
    return result.user;
  } catch (error) {
    console.error('Google Sign-in failed:', error);
    return null;
  }
}

// Sign out
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
  }
}

// Save/update user profile in /users/{userId}
export async function saveUserProfile(user: User) {
  const path = `users/${user.uid}`;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Mihora Recruiter',
      createdAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Sanitize objects to prevent Firestore "Unsupported field value: undefined" errors
export function cleanUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefinedFields(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/* =========================================================================
   JOB REQUISITIONS CRUD
   ========================================================================= */

// Create / overwrite a job
export async function saveJobToFirestore(job: Job, user: User) {
  const path = `jobs/${job.id}`;
  try {
    const payload = cleanUndefinedFields({
      id: job.id,
      userId: user.uid,
      title: job.title.trim(),
      department: job.department.trim(),
      description: job.description.trim(),
      responsibilities: job.responsibilities?.trim() || '',
      requirements: job.requirements?.trim() || '',
      employmentType: job.employmentType || 'Full-time',
      location: job.location?.trim() || '',
      workplaceType: job.workplaceType || 'Hybrid',
      status: job.status || 'Open',
      createdAt: job.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await setDoc(doc(db, 'jobs', job.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Update specific fields on a job
export async function updateJobInFirestore(jobId: string, updates: Partial<Job>) {
  const path = `jobs/${jobId}`;
  try {
    const payload = cleanUndefinedFields({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'jobs', jobId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete job with optional cascade confirmation
export async function deleteJobFromFirestore(
  jobId: string,
  options?: { deleteAssociatedCandidates?: boolean; userId?: string }
) {
  const path = `jobs/${jobId}`;
  try {
    if (options?.deleteAssociatedCandidates) {
      const currentUid = options?.userId || auth.currentUser?.uid;

      // Find associated candidates and analyses to clean up (filtered by owner for security rules compliance)
      const candidatesQuery = currentUid
        ? query(collection(db, 'candidates'), where('userId', '==', currentUid), where('jobId', '==', jobId))
        : query(collection(db, 'candidates'), where('jobId', '==', jobId));
      const candSnap = await getDocs(candidatesQuery);
      const batch = writeBatch(db);

      candSnap.forEach((cDoc) => {
        const cData = cDoc.data();
        if (cData.analysisId) {
          batch.delete(doc(db, 'analyses', cData.analysisId));
        }
        batch.delete(cDoc.ref);
      });

      // Also clean any unlinked analyses for this jobId
      const analysesQuery = currentUid
        ? query(collection(db, 'analyses'), where('userId', '==', currentUid), where('jobId', '==', jobId))
        : query(collection(db, 'analyses'), where('jobId', '==', jobId));
      const analSnap = await getDocs(analysesQuery);
      analSnap.forEach((aDoc) => {
        batch.delete(aDoc.ref);
      });

      batch.delete(doc(db, 'jobs', jobId));
      await batch.commit();
    } else {
      await deleteDoc(doc(db, 'jobs', jobId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Realtime subscription for jobs
export function subscribeToUserJobs(
  userId: string,
  onData: (jobs: Job[]) => void,
  onError?: (err: any) => void
) {
  const path = 'jobs';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const jobs: Job[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          jobs.push({
            id: data.id || docSnap.id,
            userId: data.userId || userId,
            title: data.title || 'Untitled Role',
            department: data.department || 'General',
            description: data.description || '',
            responsibilities: data.responsibilities || '',
            requirements: data.requirements || '',
            employmentType: data.employmentType || 'Full-time',
            location: data.location || '',
            workplaceType: data.workplaceType || 'Hybrid',
            status: data.status === 'Closed' ? 'Closed' : 'Open',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });

        // Sort newest first
        jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onData(jobs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

/* =========================================================================
   CANDIDATE RECORDS CRUD
   ========================================================================= */



export async function saveCandidateToFirestore(candidate: CandidateRecord, user: User) {
  const path = `candidates/${candidate.id}`;
  try {
    const payload = cleanUndefinedFields({
      id: candidate.id,
      jobId: candidate.jobId,
      jobTitle: candidate.jobTitle,
      jobDepartment: candidate.jobDepartment,
      userId: user.uid,
      name: candidate.name || 'Unspecified Candidate',
      location: candidate.location || null,
      currentRole: candidate.currentRole || null,
      alignmentLevel: candidate.alignmentLevel || 'Good alignment',
      analysisId: candidate.analysisId,
      analyzedAt: candidate.analyzedAt,
      notes: candidate.notes || '',
      status: candidate.status || 'New',
      interviews: candidate.interviews || [],
      outreachLogs: candidate.outreachLogs || [],
      createdAt: candidate.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await setDoc(doc(db, 'candidates', candidate.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCandidateInFirestore(candidateId: string, updates: Partial<CandidateRecord>) {
  const path = `candidates/${candidateId}`;
  try {
    const payload = cleanUndefinedFields({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'candidates', candidateId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCandidateFromFirestore(candidateId: string, analysisId?: string) {
  const path = `candidates/${candidateId}`;
  try {
    await deleteDoc(doc(db, 'candidates', candidateId));
    if (analysisId) {
      try {
        await deleteDoc(doc(db, 'analyses', analysisId));
      } catch (err) {
        console.warn('Analysis cleanup note:', err);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserCandidates(
  userId: string,
  onData: (candidates: CandidateRecord[]) => void,
  onError?: (err: any) => void
) {
  const path = 'candidates';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const candidates: CandidateRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          candidates.push({
            id: data.id || docSnap.id,
            jobId: data.jobId || '',
            jobTitle: data.jobTitle || 'Role',
            jobDepartment: data.jobDepartment || 'General',
            userId: data.userId || userId,
            name: data.name || 'Unspecified Candidate',
            location: data.location || null,
            currentRole: data.currentRole || null,
            alignmentLevel: data.alignmentLevel || 'Good alignment',
            analysisId: data.analysisId || '',
            analyzedAt: data.analyzedAt || 'Recent',
            notes: data.notes || '',
            status: data.status || 'New',
            interviews: Array.isArray(data.interviews) ? data.interviews : [],
            outreachLogs: Array.isArray(data.outreachLogs) ? data.outreachLogs : [],
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });

        candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onData(candidates);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

/* =========================================================================
   ANALYSIS RESULTS CRUD
   ========================================================================= */

// Save analysis record to /analyses/{analysisId}
export async function saveAnalysisToFirestore(
  analysis: AnalysisResult,
  user: User,
  jobId?: string,
  candidateId?: string
) {
  const path = `analyses/${analysis.id}`;
  try {
    const payload = {
      id: analysis.id,
      jobId: jobId || analysis.jobId || null,
      candidateId: candidateId || analysis.candidateId || null,
      userId: user.uid,
      fileName: analysis.fileName,
      candidateName: analysis.candidateOverview.detectedName || '',
      candidateLocation: analysis.candidateOverview.detectedLocation || '',
      jobTitle: analysis.roleSummary.jobTitle,
      department: analysis.roleSummary.department || '',
      extractedSummary: analysis.roleSummary.extractedSummary,
      alignmentLevel: analysis.overallRoleAlignment.level,
      alignmentSummary: analysis.overallRoleAlignment.summary,
      hasLimitedInformation: analysis.hasLimitedInformation,
      candidateOverview: analysis.candidateOverview,
      roleSummary: analysis.roleSummary,
      requirementMatches: analysis.requirementMatches,
      strengths: analysis.strengths,
      potentialGaps: analysis.potentialGaps,
      interviewFocus: analysis.interviewFocus,
      overallRoleAlignment: analysis.overallRoleAlignment,
      analyzedAt: analysis.analyzedAt,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'analyses', analysis.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Delete an analysis record
export async function deleteAnalysisFromFirestore(analysisId: string) {
  const path = `analyses/${analysisId}`;
  try {
    await deleteDoc(doc(db, 'analyses', analysisId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to user's saved analyses in real-time
export function subscribeToUserAnalyses(
  userId: string,
  onData: (analyses: AnalysisResult[]) => void,
  onError?: (err: any) => void
) {
  const path = 'analyses';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', userId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const records: AnalysisResult[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          records.push({
            id: data.id || docSnap.id,
            jobId: data.jobId || undefined,
            candidateId: data.candidateId || undefined,
            analyzedAt: data.analyzedAt || 'Recent',
            fileName: data.fileName || 'Resume Document',
            candidateOverview: {
              detectedName: data.candidateOverview?.detectedName || data.candidateName || null,
              detectedLocation: data.candidateOverview?.detectedLocation || data.candidateLocation || null,
              currentOrRecentRole: data.candidateOverview?.currentOrRecentRole || null,
              experienceSummary: data.candidateOverview?.experienceSummary || null,
              keySkillsDetected: Array.isArray(data.candidateOverview?.keySkillsDetected) ? data.candidateOverview.keySkillsDetected : [],
              education: Array.isArray(data.candidateOverview?.education) ? data.candidateOverview.education : [],
              certifications: Array.isArray(data.candidateOverview?.certifications) ? data.candidateOverview.certifications : [],
            },
            roleSummary: data.roleSummary || {
              jobTitle: data.jobTitle || 'Role',
              department: data.department || '',
              extractedSummary: data.extractedSummary || '',
            },
            requirementMatches: data.requirementMatches || [],
            strengths: data.strengths || [],
            potentialGaps: data.potentialGaps || [],
            interviewFocus: data.interviewFocus || [],
            overallRoleAlignment: data.overallRoleAlignment || {
              level: data.alignmentLevel || 'Good alignment',
              summary: data.alignmentSummary || '',
            },
            hasLimitedInformation: Boolean(data.hasLimitedInformation),
          });
        });

        // Sort latest first
        records.sort((a, b) => b.id.localeCompare(a.id));
        onData(records);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}
