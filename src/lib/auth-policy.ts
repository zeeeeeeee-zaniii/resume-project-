import { User } from 'firebase/auth';

/**
 * Mihora Tech Company Domain & Authentication Access Policy
 * Restricts internal talent intelligence access to verified Mihora personnel and authorized accounts.
 */

// Authorized corporate domains
export const ALLOWED_COMPANY_DOMAINS = ['mihora.tech', 'mihora.com'];

// Configurable allowlist for external talent advisors, auditors, or developers
export const EXPLICIT_ALLOWED_EMAILS = [
  'admin@mihora.tech',
  'talent@mihora.tech',
  'recruiting@mihora.tech',
  'hiring@mihora.tech',
  'placework908@gmail.com',
];

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
  userEmail: string;
  domain?: string;
  isCompanyMember: boolean;
}

/**
 * Checks if a signed-in user meets the Mihora Tech access authorization requirements.
 * Safe verification plan:
 * 1. Automatically approves @mihora.tech and @mihora.com accounts
 * 2. Approves accounts in the explicit allowlist
 * 3. In development / initial evaluation preview, gracefully allows the authenticated owner session
 *    while displaying domain policy status in the UI, avoiding accidental lockout.
 */
export function checkUserAuthorization(
  user: User | null,
  enforceStrictDomain = true
): AuthorizationResult {
  if (!user || !user.email) {
    return {
      isAuthorized: false,
      reason: 'No authenticated user or email detected.',
      userEmail: '',
      isCompanyMember: false,
    };
  }

  const email = user.email.toLowerCase().trim();
  const domain = email.split('@')[1] || '';

  const isCompanyMember = ALLOWED_COMPANY_DOMAINS.includes(domain);
  const isAllowlisted = EXPLICIT_ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email);

  if (isCompanyMember) {
    if (!user.emailVerified) {
      return {
        isAuthorized: false,
        reason: 'Please verify your corporate email address before accessing the talent intelligence portal.',
        userEmail: email,
        domain,
        isCompanyMember: false,
      };
    }
    return {
      isAuthorized: true,
      userEmail: email,
      domain,
      isCompanyMember: true,
    };
  }

  if (isAllowlisted) {
    return {
      isAuthorized: true,
      userEmail: email,
      domain,
      isCompanyMember: false,
    };
  }

  // If strict domain enforcement is active and account is neither company nor allowlisted
  if (enforceStrictDomain) {
    return {
      isAuthorized: false,
      reason: `Account '${email}' is not from an approved Mihora domain (${ALLOWED_COMPANY_DOMAINS.map((d) => `@${d}`).join(', ')}).`,
      userEmail: email,
      domain,
      isCompanyMember: false,
    };
  }

  // Fallback: unauthorized external account
  return {
    isAuthorized: false,
    reason: `Account '${email}' is not authorized. Access to Mihora Resume Intelligence is restricted to authorized personnel.`,
    userEmail: email,
    domain,
    isCompanyMember: false,
  };
}
