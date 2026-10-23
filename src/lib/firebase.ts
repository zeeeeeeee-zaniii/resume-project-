import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc,
  getDoc,
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
import { AnalysisResult, Job, CandidateRecord, UserProfile, UserRole, UserApprovalStatus } from '../types';
import { PRIMARY_MASTER_ADMIN_EMAIL, ALLOWED_COMPANY_DOMAINS } from './auth-policy';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Initialize Firestore with the exact database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

// User-friendly error message translator for Firebase Authentication error codes
export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected authentication error occurred.';
  const code = error.code || (typeof error === 'string' ? error : '');
  const message = error.message || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact a Mihora administrator.';
    case 'auth/user-not-found':
      return 'No account was found with this email. Please verify your email or create a new account.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please verify your credentials or click "Forgot Password?".';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. If you registered using Google, please sign in with Google.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication is not currently enabled in Firebase Console. Please verify that Email/Password provider is enabled under Firebase Authentication > Sign-in method.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access has been temporarily restricted for security. Please try again later or reset your password.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address under a different sign-in provider (e.g. Google). Please sign in using your existing provider.';
    case 'auth/credential-already-in-use':
      return 'This credential is already linked to another user account.';
    case 'auth/requires-recent-login':
      return 'This sensitive operation requires recent authentication. Please sign out and sign in again before linking.';
    case 'auth/popup-closed-by-user':
      return 'The Google authentication window was closed before completing sign in.';
    case 'auth/popup-blocked':
      return 'The authentication popup was blocked by your browser. Please allow popups for this site.';
    default:
      if (message.includes('INVALID_LOGIN_CREDENTIALS')) {
        return 'Invalid email or password. Please verify your credentials and try again.';
      }
      return message || 'Authentication failed. Please try again.';
  }
}

// Sign in with Google Popup (accepts any valid Google account)
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    try {
      await saveUserProfile(result.user);
    } catch (profileErr) {
      console.warn('Note: Profile write deferred or restricted:', profileErr);
    }
  }
  return result.user;
}

// Sign in with Email and Password
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  if (result.user) {
    try {
      await saveUserProfile(result.user);
    } catch (profileErr) {
      console.warn('Note: Profile write deferred or restricted:', profileErr);
    }
  }
  return result.user;
}

// Sign up with Email and Password
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  const user = result.user;

  if (displayName && displayName.trim()) {
    try {
      await updateProfile(user, { displayName: displayName.trim() });
    } catch (updateErr) {
      console.warn('Note: Display name update deferred:', updateErr);
    }
  }

  // Send verification email to newly registered email accounts
  try {
    await sendEmailVerification(user);
  } catch (verifyErr) {
    console.warn('Note: Verification email send note:', verifyErr);
  }

  // Save new user profile (defaults to PENDING status and PUBLIC_USER role)
  try {
    await saveUserProfile(user);
  } catch (profileErr) {
    console.warn('Note: Profile write deferred or restricted:', profileErr);
  }

  return user;
}

// Send Password Reset Email
export async function sendPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, normalizedEmail);
}

// Resend Email Verification to user
export async function resendVerificationEmail(user?: User | null): Promise<void> {
  const targetUser = user || auth.currentUser;
  if (!targetUser) {
    throw new Error('No authenticated user session found to send verification email.');
  }
  await sendEmailVerification(targetUser);
}

// Securely link password credential to an existing authenticated account (e.g. Google user adding password)
export async function linkPasswordToCurrentUser(password: string): Promise<User> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('You must be signed in with a verified email address to link password credentials.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  const result = await linkWithCredential(user, credential);
  return result.user;
}

// Securely link Google account to an existing authenticated user
export async function linkGoogleToCurrentUser(): Promise<User> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to link a Google account.');
  }
  const result = await linkWithPopup(user, googleProvider);
  return result.user;
}

// Sign out
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
    throw error;
  }
}

// Save/update user profile in /users/{userId} with non-destructive status retention
export async function saveUserProfile(user: User): Promise<UserProfile | null> {
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userDocRef);

    const email = (user.email || '').toLowerCase().trim();
    const isPrimaryAdmin = email === PRIMARY_MASTER_ADMIN_EMAIL;
    const now = new Date().toISOString();

    if (existingSnap.exists()) {
      // Existing profile: RETAIN existing role, status, companyId, and approvedAt!
      const existingData = existingSnap.data();

      // Primary admin is guaranteed MASTER_ADMIN role and APPROVED status
      const role: UserRole = isPrimaryAdmin ? 'MASTER_ADMIN' : (existingData.role || 'PUBLIC_USER');
      const status: UserApprovalStatus = isPrimaryAdmin ? 'APPROVED' : (existingData.status || 'PENDING');

      const updates: Record<string, any> = cleanUndefinedFields({
        displayName: user.displayName || existingData.displayName || email.split('@')[0] || 'User',
        photoURL: user.photoURL || existingData.photoURL || undefined,
        lastActiveAt: now,
        ...(isPrimaryAdmin ? { role: 'MASTER_ADMIN', status: 'APPROVED' } : {}),
      });

      await updateDoc(userDocRef, updates);

      return {
        userId: user.uid,
        email: existingData.email || email,
        displayName: updates.displayName || existingData.displayName || 'User',
        photoURL: updates.photoURL || existingData.photoURL,
        role: isPrimaryAdmin ? 'MASTER_ADMIN' : (existingData.role || role),
        status: isPrimaryAdmin ? 'APPROVED' : (existingData.status || status),
        companyId: existingData.companyId || (isPrimaryAdmin ? 'mihora-tech' : undefined),
        companyName: existingData.companyName || (isPrimaryAdmin ? 'Mihora Tech' : undefined),
        requestedRole: existingData.requestedRole,
        requestedAt: existingData.requestedAt,
        approvedAt: existingData.approvedAt,
        approvedBy: existingData.approvedBy,
        suspensionReason: existingData.suspensionReason,
        createdAt: existingData.createdAt || now,
        lastActiveAt: now,
      };
    } else {
      // Brand new user profile: defaults to PENDING
      const isCompanyDomain = ALLOWED_COMPANY_DOMAINS.includes(email.split('@')[1] || '');
      const initialRole: UserRole = isPrimaryAdmin ? 'MASTER_ADMIN' : 'PUBLIC_USER';
      const initialStatus: UserApprovalStatus = isPrimaryAdmin ? 'APPROVED' : 'PENDING';
      const requestedRole: UserRole = isCompanyDomain ? 'RECRUITER' : 'PUBLIC_USER';

      const newProfile: UserProfile = cleanUndefinedFields({
        userId: user.uid,
        email,
        displayName: user.displayName || email.split('@')[0] || 'User',
        photoURL: user.photoURL || undefined,
        role: initialRole,
        status: initialStatus,
        companyId: isPrimaryAdmin ? 'mihora-tech' : undefined,
        companyName: isPrimaryAdmin ? 'Mihora Tech' : undefined,
        requestedRole: isPrimaryAdmin ? 'MASTER_ADMIN' : requestedRole,
        requestedAt: now,
        ...(isPrimaryAdmin ? { approvedAt: now, approvedBy: 'SYSTEM_BOOTSTRAP' } : {}),
        createdAt: now,
        lastActiveAt: now,
      });

      await setDoc(userDocRef, newProfile);
      return newProfile;
    }
  } catch (error) {
    console.warn('Note: Profile write deferred or restricted:', error);
    return null;
  }
}

// Fetch single user profile from /users/{userId}
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      userId: data.userId || userId,
      email: data.email || '',
      displayName: data.displayName || 'User',
      photoURL: data.photoURL,
      role: data.role || 'PUBLIC_USER',
      status: data.status || 'PENDING',
      companyId: data.companyId,
      companyName: data.companyName,
      requestedRole: data.requestedRole,
      requestedAt: data.requestedAt,
      approvedAt: data.approvedAt,
      approvedBy: data.approvedBy,
      suspensionReason: data.suspensionReason,
      createdAt: data.createdAt || new Date().toISOString(),
      lastActiveAt: data.lastActiveAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// Realtime subscription for user profile
export function subscribeToUserProfile(
  userId: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}`;
  try {
    return onSnapshot(
      doc(db, 'users', userId),
      (docSnap) => {
        if (!docSnap.exists()) {
          onData(null);
          return;
        }
        const data = docSnap.data();
        onData({
          userId: data.userId || userId,
          email: data.email || '',
          displayName: data.displayName || 'User',
          photoURL: data.photoURL,
          role: data.role || 'PUBLIC_USER',
          status: data.status || 'PENDING',
          companyId: data.companyId,
          companyName: data.companyName,
          requestedRole: data.requestedRole,
          requestedAt: data.requestedAt,
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
          suspensionReason: data.suspensionReason,
          createdAt: data.createdAt || new Date().toISOString(),
          lastActiveAt: data.lastActiveAt,
        });
      },
      (error) => {
        console.warn('UserProfile subscription note:', error);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    console.warn('UserProfile subscription setup note:', error);
    return () => {};
  }
}

// Realtime subscription to all user profiles for Master Admin
export function subscribeToUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: any) => void
) {
  const path = 'users';
  try {
    const q = query(collection(db, path));
    return onSnapshot(
      q,
      (snapshot) => {
        const users: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          users.push({
            userId: data.userId || docSnap.id,
            email: data.email || '',
            displayName: data.displayName || 'User',
            photoURL: data.photoURL,
            role: data.role || 'PUBLIC_USER',
            status: data.status || 'PENDING',
            companyId: data.companyId,
            companyName: data.companyName,
            requestedRole: data.requestedRole,
            requestedAt: data.requestedAt,
            approvedAt: data.approvedAt,
            approvedBy: data.approvedBy,
            suspensionReason: data.suspensionReason,
            createdAt: data.createdAt || new Date().toISOString(),
            lastActiveAt: data.lastActiveAt,
          });
        });
        // Sort: PENDING first, then newest first
        users.sort((a, b) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        onData(users);
      },
      (error) => {
        console.warn('Users collection query note:', error);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    console.warn('Users subscription setup error:', error);
    if (onError) onError(error);
    return () => {};
  }
}

// Update user approval status and role (Master Admin action)
export async function updateUserStatusAndRole(
  targetUserId: string,
  updates: {
    status: UserApprovalStatus;
    role?: UserRole;
    suspensionReason?: string;
    adminEmail: string;
  }
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const userDocRef = doc(db, 'users', targetUserId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      throw new Error('User profile does not exist.');
    }
    const existing = snap.data();
    // Protect primary Master Admin from being modified, suspended, or demoted
    if (existing.email?.toLowerCase().trim() === PRIMARY_MASTER_ADMIN_EMAIL) {
      throw new Error('The primary Master Admin account is permanently protected and cannot be modified.');
    }

    const now = new Date().toISOString();
    const payload: Record<string, any> = cleanUndefinedFields({
      status: updates.status,
      ...(updates.role ? { role: updates.role } : {}),
      ...(updates.status === 'APPROVED' ? { approvedAt: now, approvedBy: updates.adminEmail, suspensionReason: null } : {}),
      ...(updates.status === 'SUSPENDED' ? { suspensionReason: updates.suspensionReason || 'Account suspended by Master Admin' } : {}),
      ...(updates.status === 'REJECTED' ? { rejectionReason: updates.suspensionReason || 'Access request rejected' } : {}),
      reviewedAt: now,
      reviewedBy: updates.adminEmail,
    });

    await updateDoc(userDocRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
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
    const validStatuses: ('Draft' | 'Open' | 'On Hold' | 'Closed')[] = ['Draft', 'Open', 'On Hold', 'Closed'];
    const status = validStatuses.includes(job.status) ? job.status : 'Open';

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
      status,
      hiringManager: job.hiringManager?.trim() || '',
      recruiter: job.recruiter?.trim() || '',
      openingsCount: typeof job.openingsCount === 'number' && job.openingsCount > 0 ? Math.floor(job.openingsCount) : 1,
      openingDate: job.openingDate || new Date().toISOString().split('T')[0],
      targetCloseDate: job.targetCloseDate || '',
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
          const rawStatus = data.status;
          const validStatuses: ('Draft' | 'Open' | 'On Hold' | 'Closed')[] = ['Draft', 'Open', 'On Hold', 'Closed'];
          const status = validStatuses.includes(rawStatus)
            ? rawStatus
            : (rawStatus === 'Closed' ? 'Closed' : 'Open');

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
            status,
            hiringManager: data.hiringManager || '',
            recruiter: data.recruiter || '',
            openingsCount: typeof data.openingsCount === 'number' && data.openingsCount > 0 ? Math.floor(data.openingsCount) : 1,
            openingDate: data.openingDate || (data.createdAt ? data.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
            targetCloseDate: data.targetCloseDate || '',
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
      activityTimeline: candidate.activityTimeline || [],
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
            activityTimeline: Array.isArray(data.activityTimeline) ? data.activityTimeline : [],
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
    const payload = cleanUndefinedFields({
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
    });

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

/* =========================================================================
   PERSONAL ANALYSES (PUBLIC USER ISOLATED SUBCOLLECTION)
   Saved at: /users/{userId}/analyses/{analysisId}
   Strictly isolated to the owner; inaccessible to recruiters or other users.
   ========================================================================= */

export async function savePersonalAnalysisToFirestore(
  analysis: AnalysisResult,
  user: User
) {
  const path = `users/${user.uid}/analyses/${analysis.id}`;
  try {
    const payload = cleanUndefinedFields({
      id: analysis.id,
      userId: user.uid,
      fileName: analysis.fileName,
      candidateName: analysis.candidateOverview.detectedName || '',
      candidateLocation: analysis.candidateOverview.detectedLocation || '',
      jobTitle: analysis.roleSummary.jobTitle,
      department: analysis.roleSummary.department || '',
      extractedSummary: analysis.roleSummary.extractedSummary,
      alignmentLevel: analysis.overallRoleAlignment.level,
      alignmentSummary: analysis.overallRoleAlignment.summary,
      hasLimitedInformation: Boolean(analysis.hasLimitedInformation),
      candidateOverview: analysis.candidateOverview,
      roleSummary: analysis.roleSummary,
      requirementMatches: analysis.requirementMatches,
      strengths: analysis.strengths,
      potentialGaps: analysis.potentialGaps,
      interviewFocus: analysis.interviewFocus,
      overallRoleAlignment: analysis.overallRoleAlignment,
      analyzedAt: analysis.analyzedAt,
      createdAt: new Date().toISOString(),
    });

    await setDoc(doc(db, 'users', user.uid, 'analyses', analysis.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePersonalAnalysisFromFirestore(
  userId: string,
  analysisId: string
) {
  const path = `users/${userId}/analyses/${analysisId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'analyses', analysisId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserPersonalAnalyses(
  userId: string,
  onData: (analyses: AnalysisResult[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/analyses`;
  try {
    const collRef = collection(db, 'users', userId, 'analyses');

    return onSnapshot(
      collRef,
      (snapshot) => {
        const records: AnalysisResult[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          records.push({
            id: data.id || docSnap.id,
            analyzedAt: data.analyzedAt || 'Recent',
            fileName: data.fileName || 'Resume Document',
            candidateOverview: {
              detectedName: data.candidateOverview?.detectedName || data.candidateName || null,
              detectedLocation: data.candidateOverview?.detectedLocation || data.candidateLocation || null,
              currentOrRecentRole: data.candidateOverview?.currentOrRecentRole || null,
              experienceSummary: data.candidateOverview?.experienceSummary || null,
              keySkillsDetected: Array.isArray(data.candidateOverview?.keySkillsDetected)
                ? data.candidateOverview.keySkillsDetected
                : [],
              education: Array.isArray(data.candidateOverview?.education)
                ? data.candidateOverview.education
                : [],
              certifications: Array.isArray(data.candidateOverview?.certifications)
                ? data.candidateOverview.certifications
                : [],
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
