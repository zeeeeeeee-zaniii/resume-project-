import { User } from 'firebase/auth';

/**
 * Mihora Tech Access & Identity Policy
 * Classifies users into:
 * - RECRUITER: Verified Mihora company personnel (@mihora.tech, @mihora.com) and explicitly approved accounts.
 * - PUBLIC_USER: Any other authenticated Google account.
 */

// Authorized corporate domains for Mihora Tech
export const ALLOWED_COMPANY_DOMAINS = ['mihora.tech', 'mihora.com'];

// Configurable allowlist for external talent advisors, project evaluators, or developers
export const EXPLICIT_ALLOWED_EMAILS = [
  'admin@mihora.tech',
  'talent@mihora.tech',
  'recruiting@mihora.tech',
  'hiring@mihora.tech',
  'placework908@gmail.com',
];

export type UserRole = 'RECRUITER' | 'PUBLIC_USER';

export interface AuthorizationResult {
  role: UserRole;
  isRecruiter: boolean;
  isAuthorized: boolean;
  reason?: string;
  userEmail: string;
  domain?: string;
  isCompanyMember: boolean;
}

/**
 * Checks and classifies the authenticated user.
 * - Approves corporate accounts and explicit allowlist as RECRUITER.
 * - Approves all other authenticated Google accounts as PUBLIC_USER.
 */
export function checkUserAuthorization(
  user: User | null,
  _enforceStrictDomain = true
): AuthorizationResult {
  if (!user || !user.email) {
    return {
      role: 'PUBLIC_USER',
      isRecruiter: false,
      isAuthorized: false,
      reason: 'No authenticated user or email detected.',
      userEmail: '',
      isCompanyMember: false,
    };
  }

  const email = user.email.toLowerCase().trim();
  const domain = email.split('@')[1] || '';

  const isCompanyDomain = ALLOWED_COMPANY_DOMAINS.includes(domain);
  const isAllowlisted = EXPLICIT_ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email);

  if (isCompanyDomain) {
    if (!user.emailVerified) {
      // Unverified corporate domain emails must verify before recruiter access
      return {
        role: 'PUBLIC_USER',
        isRecruiter: false,
        isAuthorized: true,
        reason: 'Please verify your corporate email address to unlock recruiter tools. Currently operating in public analysis mode.',
        userEmail: email,
        domain,
        isCompanyMember: false,
      };
    }
    return {
      role: 'RECRUITER',
      isRecruiter: true,
      isAuthorized: true,
      userEmail: email,
      domain,
      isCompanyMember: true,
    };
  }

  if (isAllowlisted) {
    return {
      role: 'RECRUITER',
      isRecruiter: true,
      isAuthorized: true,
      userEmail: email,
      domain,
      isCompanyMember: false,
    };
  }

  // All other authenticated Google accounts are valid PUBLIC_USERs
  return {
    role: 'PUBLIC_USER',
    isRecruiter: false,
    isAuthorized: true,
    userEmail: email,
    domain,
    isCompanyMember: false,
  };
}
