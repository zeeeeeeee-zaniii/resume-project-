import { User } from 'firebase/auth';
import { UserRole, UserApprovalStatus, UserProfile } from '../types';

/**
 * Mihora Tech Access & Identity Policy
 * Primary Master Admin: placework908@gmail.com
 * Classifies users based on verified identity and Firestore profile status:
 * - MASTER_ADMIN: Primary administrator with full oversight
 * - RECRUITER: Approved talent acquisition and screening personnel
 * - PUBLIC_USER: Personal resume analysis (or pending approval)
 */

export const PRIMARY_MASTER_ADMIN_EMAIL = 'placework908@gmail.com';

// Authorized corporate domains for Mihora Tech (requires Master Admin approval)
export const ALLOWED_COMPANY_DOMAINS = ['mihora.tech', 'mihora.com'];

// Configurable allowlist retained for reference
export const EXPLICIT_ALLOWED_EMAILS = [
  'admin@mihora.tech',
  'talent@mihora.tech',
  'recruiting@mihora.tech',
  'hiring@mihora.tech',
  'placework908@gmail.com',
];

export type { UserRole, UserApprovalStatus };

export interface AuthorizationResult {
  role: UserRole;
  status: UserApprovalStatus;
  isMasterAdmin: boolean;
  isRecruiter: boolean;
  isAuthorized: boolean;
  reason?: string;
  userEmail: string;
  domain?: string;
  isCompanyMember: boolean;
}

/**
 * Checks and classifies the authenticated user.
 * - Identifies primary Master Admin (placework908@gmail.com) with guaranteed MASTER_ADMIN role and APPROVED status.
 * - Uses the verified Firestore UserProfile to evaluate approval status (PENDING, APPROVED, SUSPENDED, REJECTED).
 * - New users default to PENDING and are not automatically granted recruiter access.
 */
export function checkUserAuthorization(
  user: User | null,
  profileOrStrict?: UserProfile | null | boolean,
  enforceStrictDomain = true
): AuthorizationResult {
  const profile: UserProfile | null = typeof profileOrStrict === 'object' ? profileOrStrict : null;
  if (!user || !user.email) {
    return {
      role: 'PUBLIC_USER',
      status: 'PENDING',
      isMasterAdmin: false,
      isRecruiter: false,
      isAuthorized: false,
      reason: 'No authenticated user or email detected.',
      userEmail: '',
      isCompanyMember: false,
    };
  }

  const email = user.email.toLowerCase().trim();
  const domain = email.split('@')[1] || '';

  // 1. Primary Master Admin check (anchored directly to verified email)
  if (email === PRIMARY_MASTER_ADMIN_EMAIL) {
    if (!user.emailVerified) {
      return {
        role: 'PUBLIC_USER',
        status: 'PENDING',
        isMasterAdmin: false,
        isRecruiter: false,
        isAuthorized: false,
        reason: 'Master Admin email must be verified before administrative access is granted.',
        userEmail: email,
        domain,
        isCompanyMember: false,
      };
    }
    return {
      role: 'MASTER_ADMIN',
      status: 'APPROVED',
      isMasterAdmin: true,
      isRecruiter: true,
      isAuthorized: true,
      userEmail: email,
      domain,
      isCompanyMember: true,
    };
  }

  // 2. Profile-driven evaluation if user profile document exists
  if (profile) {
    if (profile.status === 'SUSPENDED') {
      return {
        role: profile.role || 'PUBLIC_USER',
        status: 'SUSPENDED',
        isMasterAdmin: false,
        isRecruiter: false,
        isAuthorized: false,
        reason: profile.suspensionReason || 'Your account access has been suspended by the Master Admin.',
        userEmail: email,
        domain,
        isCompanyMember: false,
      };
    }

    if (profile.status === 'REJECTED') {
      return {
        role: profile.role || 'PUBLIC_USER',
        status: 'REJECTED',
        isMasterAdmin: false,
        isRecruiter: false,
        isAuthorized: false,
        reason: 'Your access request has been reviewed and declined.',
        userEmail: email,
        domain,
        isCompanyMember: false,
      };
    }

    if (profile.status === 'APPROVED') {
      const isApprovedRecruiter = profile.role === 'RECRUITER' || profile.role === 'MASTER_ADMIN';
      return {
        role: profile.role || 'PUBLIC_USER',
        status: 'APPROVED',
        isMasterAdmin: profile.role === 'MASTER_ADMIN',
        isRecruiter: isApprovedRecruiter,
        isAuthorized: true,
        userEmail: email,
        domain,
        isCompanyMember: isApprovedRecruiter,
      };
    }

    // Default for PENDING profile
    return {
      role: profile.role || 'PUBLIC_USER',
      status: 'PENDING',
      isMasterAdmin: false,
      isRecruiter: false,
      isAuthorized: true,
      reason: 'Your account is pending review by the Master Admin.',
      userEmail: email,
      domain,
      isCompanyMember: false,
    };
  }

  // 3. Fallback when profile is loading or not yet established:
  // New Google accounts default to PENDING and do not automatically receive recruiter access
  return {
    role: 'PUBLIC_USER',
    status: 'PENDING',
    isMasterAdmin: false,
    isRecruiter: false,
    isAuthorized: true,
    reason: 'Account pending review by the Master Admin.',
    userEmail: email,
    domain,
    isCompanyMember: false,
  };
}
