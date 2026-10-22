import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

dotenv.config();

// Firebase configuration cache
let firebaseConfig: { projectId: string; apiKey?: string; firestoreDatabaseId?: string } = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0699486567',
  apiKey: process.env.FIREBASE_API_KEY || '',
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '',
};

// Attempt to load firebase-applet-config.json from project root
try {
  const possiblePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
  ];
  for (const cfgPath of possiblePaths) {
    if (fs.existsSync(cfgPath)) {
      const rawConfig = fs.readFileSync(cfgPath, 'utf8');
      const parsed = JSON.parse(rawConfig);
      if (parsed.projectId) {
        firebaseConfig = {
          projectId: parsed.projectId,
          apiKey: parsed.apiKey || firebaseConfig.apiKey,
          firestoreDatabaseId: parsed.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId,
        };
        break;
      }
    }
  }
} catch (cfgErr) {
  console.warn('Note loading firebase-applet-config.json:', cfgErr);
}

// Per-User (UID) Rate Limiter: max 30 analysis requests per minute per verified UID
const userRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const USER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const USER_RATE_LIMIT_MAX_REQUESTS = 30;

export const checkUserRateLimit = (uid: string): { allowed: boolean; retryAfterSeconds?: number } => {
  const key = uid || 'anonymous';
  const now = Date.now();
  const entry = userRateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    userRateLimitMap.set(key, { count: 1, resetTime: now + USER_RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= USER_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true };
};

// Periodic cleanup of stale rate-limit records
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userRateLimitMap.entries()) {
    if (now > entry.resetTime) {
      userRateLimitMap.delete(key);
    }
  }
}, 60000);
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

// Concurrency Limiter & Queue to safely support concurrent users without quota exhaustion
const MAX_CONCURRENT_ANALYSES = 8;
const MAX_QUEUE_DEPTH = 50;
const QUEUE_TIMEOUT_MS = 30000;
let activeAnalysesCount = 0;
const analysisQueue: Array<() => void> = [];

export const acquireConcurrencySlot = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (activeAnalysesCount < MAX_CONCURRENT_ANALYSES) {
      activeAnalysesCount++;
      return resolve();
    }

    if (analysisQueue.length >= MAX_QUEUE_DEPTH) {
      return reject(new Error('QUEUE_FULL'));
    }

    const timer = setTimeout(() => {
      const idx = analysisQueue.indexOf(startSlot);
      if (idx !== -1) {
        analysisQueue.splice(idx, 1);
        reject(new Error('QUEUE_TIMEOUT'));
      }
    }, QUEUE_TIMEOUT_MS);

    const startSlot = () => {
      clearTimeout(timer);
      activeAnalysesCount++;
      resolve();
    };

    analysisQueue.push(startSlot);
  });
};

export const releaseConcurrencySlot = () => {
  activeAnalysesCount = Math.max(0, activeAnalysesCount - 1);
  const nextSlot = analysisQueue.shift();
  if (nextSlot) {
    nextSlot();
  }
};

// Google Public Certificates Cache for Firebase ID Token Verification
let cachedCertificates: Record<string, string> = {};
let certificatesExpiresAt = 0;

export async function getGooglePublicCertificates(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(cachedCertificates).length > 0 && now < certificatesExpiresAt) {
    return cachedCertificates;
  }

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Google public certificates: HTTP ${response.status}`);
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedCertificates = (await response.json()) as Record<string, string>;
  certificatesExpiresAt = now + maxAgeSeconds * 1000;
  return cachedCertificates;
}

export interface DecodedTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  auth_time: number;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  [key: string]: any;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Cryptographically verifies a Firebase ID token.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  apiKey?: string
): Promise<{ valid: boolean; user?: VerifiedFirebaseUser; error?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or not a string' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT structure' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string; typ?: string };
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Malformed token header' };
  }

  if (header.alg !== 'RS256') {
    return { valid: false, error: `Invalid algorithm: ${header.alg}. Expected RS256.` };
  }

  if (!header.kid || typeof header.kid !== 'string') {
    return { valid: false, error: 'Token header missing key ID (kid)' };
  }

  let payload: DecodedTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Malformed token payload' };
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const skewTolerance = 300; // 5 minute clock skew allowance

  if (!payload.exp || payload.exp <= nowInSeconds - skewTolerance) {
    return { valid: false, error: 'Token has expired' };
  }

  if (!payload.iat || payload.iat > nowInSeconds + skewTolerance) {
    return { valid: false, error: 'Token issue timestamp (iat) is in the future' };
  }

  if (payload.aud !== projectId) {
    return {
      valid: false,
      error: `Audience mismatch: expected Firebase project '${projectId}', got '${payload.aud}'`,
    };
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    return {
      valid: false,
      error: `Issuer mismatch: expected '${expectedIssuer}', got '${payload.iss}'`,
    };
  }

  if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    return { valid: false, error: 'Invalid user identifier (sub)' };
  }

  let certificates: Record<string, string>;
  try {
    certificates = await getGooglePublicCertificates();
  } catch (certErr: any) {
    return { valid: false, error: `Unable to fetch Google signing keys: ${certErr?.message}` };
  }

  let cert = certificates[header.kid];
  if (!cert) {
    try {
      certificatesExpiresAt = 0;
      certificates = await getGooglePublicCertificates();
      cert = certificates[header.kid];
    } catch {
      // ignore
    }
  }

  if (!cert) {
    return { valid: false, error: `No public key found for kid '${header.kid}'` };
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const isSignatureValid = verifier.verify(cert, Buffer.from(signatureB64, 'base64url'));
    if (!isSignatureValid) {
      return { valid: false, error: 'Cryptographic signature verification failed' };
    }
  } catch (verifyErr: any) {
    return { valid: false, error: `Signature verification exception: ${verifyErr?.message}` };
  }

  if (apiKey) {
    try {
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const lookupRes = await fetch(lookupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });

      if (!lookupRes.ok) {
        const lookupErr = await lookupRes.json().catch(() => ({}));
        const msg = lookupErr?.error?.message || `HTTP ${lookupRes.status}`;
        return { valid: false, error: `Identity verification failed: ${msg}` };
      }

      const lookupData = (await lookupRes.json()) as any;
      const userRecord = lookupData?.users?.[0];
      if (!userRecord || userRecord.localId !== payload.sub) {
        return { valid: false, error: 'User record mismatch from identity provider' };
      }
    } catch (lookupEx: any) {
      console.warn('Identity Toolkit lookup exception (continuing with verified signature):', lookupEx?.message);
    }
  }

  return {
    valid: true,
    user: {
      uid: payload.sub,
      email: payload.email || '',
      emailVerified: Boolean(payload.email_verified),
      name: payload.name,
    },
  };
}

export const PRIMARY_MASTER_ADMIN_EMAIL = 'placework908@gmail.com';

export interface ServerUserProfile {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  role: 'MASTER_ADMIN' | 'RECRUITER' | 'PUBLIC_USER';
  suspensionReason?: string;
  exists: boolean;
}

/**
 * Authoritatively retrieves the caller's Firestore user profile using the caller's verified Firebase ID token.
 * Uses the official Google Cloud Firestore REST API (v1).
 * Security rules in Firestore are evaluated natively against the caller's authenticated UID.
 */
export async function fetchServerUserProfile(
  uid: string,
  idToken: string,
  projectId: string,
  firestoreDatabaseId?: string
): Promise<{ success: boolean; profile?: ServerUserProfile; error?: string }> {
  try {
    const dbId =
      firestoreDatabaseId && firestoreDatabaseId.trim() ? firestoreDatabaseId.trim() : '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/users/${encodeURIComponent(uid)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 404) {
      // User profile has not yet been initialized in Firestore -> defaults to PENDING PUBLIC_USER
      return {
        success: true,
        profile: {
          status: 'PENDING',
          role: 'PUBLIC_USER',
          exists: false,
        },
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        success: false,
        error: `Firestore profile lookup failed with HTTP ${response.status}: ${errText.slice(0, 180)}`,
      };
    }

    const docData = (await response.json()) as any;
    const fields = docData?.fields || {};

    const rawStatus = fields.status?.stringValue;
    const rawRole = fields.role?.stringValue;
    const rawSuspensionReason = fields.suspensionReason?.stringValue;

    let status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' = 'PENDING';
    if (
      rawStatus === 'APPROVED' ||
      rawStatus === 'SUSPENDED' ||
      rawStatus === 'REJECTED' ||
      rawStatus === 'PENDING'
    ) {
      status = rawStatus;
    } else if (rawRole === 'RECRUITER' || rawRole === 'MASTER_ADMIN') {
      // Backward compatibility for existing pre-migration recruiter records
      status = 'APPROVED';
    }

    let role: 'MASTER_ADMIN' | 'RECRUITER' | 'PUBLIC_USER' = 'PUBLIC_USER';
    if (rawRole === 'MASTER_ADMIN' || rawRole === 'RECRUITER' || rawRole === 'PUBLIC_USER') {
      role = rawRole;
    }

    return {
      success: true,
      profile: {
        status,
        role,
        suspensionReason: rawSuspensionReason,
        exists: true,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network exception during Firestore profile lookup: ${err?.message || err}`,
    };
  }
}

// Corporate domain & access policy configuration
const ALLOWED_CORPORATE_DOMAINS = ['mihora.tech', 'mihora.com'];
const EXPLICIT_ALLOWED_EMAILS = [
  'admin@mihora.tech',
  'talent@mihora.tech',
  'recruiting@mihora.tech',
  'hiring@mihora.tech',
  'placework908@gmail.com', // Active authorized project developer / evaluator
];

export function checkCorporateAuthorization(user: VerifiedFirebaseUser): {
  authorized: boolean;
  reason?: string;
} {
  const email = (user.email || '').toLowerCase().trim();
  if (!email) {
    return {
      authorized: false,
      reason: 'Authenticated user does not have an email address.',
    };
  }

  const envAllowed = (process.env.AUTHORIZED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const domain = email.split('@')[1] || '';
  const isCorporateDomain = ALLOWED_CORPORATE_DOMAINS.includes(domain);
  const isExplicitlyAllowed =
    EXPLICIT_ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email) ||
    envAllowed.includes(email);

  if (isCorporateDomain) {
    if (!user.emailVerified) {
      return {
        authorized: false,
        reason: 'Corporate account email must be verified before performing resume screening.',
      };
    }
    return { authorized: true };
  }

  if (isExplicitlyAllowed) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: `Account '${email}' is not authorized. Access to Mihora Resume Intelligence is restricted to verified Mihora personnel (@mihora.tech / @mihora.com) and approved recruiters.`,
  };
}

// Helper to safely parse request body from Express, Vercel, or raw Node.js streams
export async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('MALFORMED_JSON');
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      throw new Error('MALFORMED_JSON');
    }
  }

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('MALFORMED_JSON'));
      }
    });
    req.on('error', (err: any) => reject(err));
  });
}

/**
 * Safely extracts raw text from a PDF Buffer using pure Node-compatible pdf2json.
 * Does not depend on canvas, @napi-rs/canvas, DOMMatrix, or browser graphics APIs.
 */
export function extractPdfText(
  fileBuffer: Buffer
): Promise<{ text: string; isPasswordProtected?: boolean }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ text: '' });
    }, 10000);

    try {
      const pdfParser = new (PDFParser as any)(null, true);

      pdfParser.on('pdfParser_dataReady', () => {
        clearTimeout(timeout);
        try {
          const rawText = pdfParser.getRawTextContent() || '';
          resolve({ text: rawText.trim() });
        } catch {
          resolve({ text: '' });
        }
      });

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        clearTimeout(timeout);
        const errString = String(errData?.parserError || errData || '');
        const isPassword =
          errString.toLowerCase().includes('password') ||
          errString.toLowerCase().includes('encrypt');
        console.warn('PDF parsing event note:', errString);
        resolve({ text: '', isPasswordProtected: isPassword });
      });

      pdfParser.parseBuffer(fileBuffer);
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn('PDF parser exception note:', err?.message || err);
      resolve({ text: '' });
    }
  });
}

/**
 * Core resume analysis handler compatible with both Express and Vercel Serverless Functions
 */
export async function handleAnalyzeResumeRequest(req: any, res: any) {
  // Set security and CORS headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Verify Bearer authorization header
  const authHeader = req.headers?.authorization || req.headers?.['authorization'];
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Missing or malformed Authorization header. Please sign in.',
    });
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return res.status(401).json({
      error: 'Authentication required. Bearer token is empty.',
    });
  }

  // Cryptographic token verification
  const verification = await verifyFirebaseIdToken(
    idToken,
    firebaseConfig.projectId,
    firebaseConfig.apiKey
  );

  if (!verification.valid || !verification.user) {
    return res.status(401).json({
      error: `Authentication failed: ${verification.error || 'Invalid or expired Firebase ID token.'}`,
    });
  }

  // Check primary Master Admin identity directly from cryptographically verified Firebase ID token
  const callerEmail = (verification.user.email || '').toLowerCase().trim();
  const isPrimaryAdmin =
    callerEmail === PRIMARY_MASTER_ADMIN_EMAIL && Boolean(verification.user.emailVerified);

  let userStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' = 'PENDING';
  let userRole: 'MASTER_ADMIN' | 'RECRUITER' | 'PUBLIC_USER' = 'PUBLIC_USER';
  let suspensionReason: string | undefined;
  let profileLookupSucceeded = false;

  if (isPrimaryAdmin) {
    // Primary Master Admin is unconditionally APPROVED with MASTER_ADMIN privileges
    userStatus = 'APPROVED';
    userRole = 'MASTER_ADMIN';
    profileLookupSucceeded = true;
  } else {
    // Authoritatively check the caller's current Firestore user profile status
    const profileResult = await fetchServerUserProfile(
      verification.user.uid,
      idToken,
      firebaseConfig.projectId,
      firebaseConfig.firestoreDatabaseId
    );

    if (profileResult.success && profileResult.profile) {
      profileLookupSucceeded = true;
      userStatus = profileResult.profile.status;
      userRole = profileResult.profile.role;
      suspensionReason = profileResult.profile.suspensionReason;
    } else {
      console.warn(
        `Server-side Firestore profile lookup note for user ${verification.user.uid}:`,
        profileResult.error
      );
    }
  }

  // 1. Block SUSPENDED users before pipeline starts
  if (userStatus === 'SUSPENDED') {
    return res.status(403).json({
      error:
        suspensionReason ||
        'Account suspended. Your access to Mihora Resume Intelligence has been suspended by a workspace administrator.',
    });
  }

  // 2. Block REJECTED users before pipeline starts
  if (userStatus === 'REJECTED') {
    return res.status(403).json({
      error:
        'Access request declined. Your access request was reviewed and declined by a workspace administrator.',
    });
  }

  // Approved recruiter eligibility: verified primary Master Admin or approved recruiter/admin in Firestore
  const isApprovedRecruiter =
    isPrimaryAdmin ||
    (userStatus === 'APPROVED' && (userRole === 'RECRUITER' || userRole === 'MASTER_ADMIN'));

  // User-ID-based rate limiter
  const rateCheck = checkUserRateLimit(verification.user.uid);
  if (!rateCheck.allowed) {
    const retryAfter = rateCheck.retryAfterSeconds || 60;
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: `Rate limit reached. Please wait ${retryAfter} seconds before submitting another analysis.`,
    });
  }

  // Parse request body safely
  let body: any;
  try {
    body = await parseRequestBody(req);
  } catch (bodyErr: any) {
    if (bodyErr?.message === 'PAYLOAD_TOO_LARGE') {
      return res.status(413).json({
        error: 'The uploaded file exceeds the payload limit. Please upload a smaller resume document.',
      });
    }
    return res.status(400).json({
      error: 'Malformed request payload. Please ensure valid JSON formatting.',
    });
  }

  // Concurrency slot acquisition
  let slotAcquired = false;
  try {
    await acquireConcurrencySlot();
    slotAcquired = true;
  } catch (queueErr: any) {
    if (queueErr?.message === 'QUEUE_FULL') {
      res.setHeader('Retry-After', '30');
      return res.status(429).json({
        error: 'The screening service is currently processing high traffic. Please retry in 30 seconds.',
      });
    }
    if (queueErr?.message === 'QUEUE_TIMEOUT') {
      res.setHeader('Retry-After', '15');
      return res.status(429).json({
        error: 'The screening request timed out while waiting in the processing queue. Please retry.',
      });
    }
    return res.status(500).json({
      error: 'Unable to initialize analysis queue. Please try again.',
    });
  }

  try {
    const {
      fileBase64,
      fileName = '',
      fileType = '',
      jobId = '',
      jobTitle = '',
      department = '',
      jobDescription = '',
      responsibilities = '',
      requirements = '',
    } = body || {};

    // 1. Validation: Job description or target title required
    const effectiveJobTitle = typeof jobTitle === 'string' ? jobTitle.trim() : '';
    let effectiveJobDescription = typeof jobDescription === 'string' ? jobDescription.trim() : '';

    if (!effectiveJobDescription && !effectiveJobTitle) {
      return res.status(400).json({
        error: 'Please provide a target job title or pasted job description before starting the analysis.',
      });
    }

    if (!effectiveJobDescription && effectiveJobTitle) {
      effectiveJobDescription = `Target Role: ${effectiveJobTitle}. Analyze candidate qualifications, core competencies, relevant work history, and alignment with industry standards for this position.`;
    }

    // Validate internal job requisition access:
    // Only approved recruiters or Master Admin can link an analysis to an internal company job requisition
    const hasJobId = typeof jobId === 'string' && jobId.trim().length > 0;
    if (hasJobId) {
      if (!profileLookupSucceeded) {
        return res.status(403).json({
          error:
            'Unable to verify recruiter authorization status. Please try again or analyze without linking to an internal job requisition.',
        });
      }
      if (!isApprovedRecruiter) {
        return res.status(403).json({
          error:
            'Access forbidden: Linking analysis to internal company job requisitions requires an approved recruiter account.',
        });
      }
    }

    const effectiveJobId = isApprovedRecruiter && hasJobId ? jobId.trim() : undefined;

    // 2. Validation: Resume base64 payload required
    if (!fileBase64 || typeof fileBase64 !== 'string' || fileBase64.trim().length === 0) {
      return res.status(400).json({
        error: 'Please upload a PDF or DOCX resume document.',
      });
    }

    const fileNameLower = (fileName || '').toLowerCase();
    const fileTypeLower = (fileType || '').toLowerCase();

    const isDocx =
      fileNameLower.endsWith('.docx') ||
      fileTypeLower.includes('wordprocessingml') ||
      fileTypeLower === 'docx';

    const isPdf =
      fileNameLower.endsWith('.pdf') ||
      fileTypeLower.includes('pdf') ||
      fileTypeLower === 'pdf';

    if (!isDocx && !isPdf) {
      return res.status(400).json({
        error: 'Please upload a PDF or DOCX resume.',
      });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(fileBase64, 'base64');
    } catch {
      return res.status(400).json({
        error: 'Unable to read the uploaded document. Please check the file and try again.',
      });
    }

    if (fileBuffer.length === 0) {
      return res.status(400).json({
        error: 'The uploaded file is empty. Please upload a valid resume document.',
      });
    }

    let docxExtractedText = '';
    let pdfExtractedText = '';
    let isValidPdfHeader = false;

    // 3. Document Extraction & Format Integrity Verification
    if (isPdf) {
      // PDF Magic bytes: %PDF
      if (
        fileBuffer.length >= 4 &&
        fileBuffer[0] === 0x25 &&
        fileBuffer[1] === 0x50 &&
        fileBuffer[2] === 0x44 &&
        fileBuffer[3] === 0x46
      ) {
        isValidPdfHeader = true;
      }

      try {
        const parseResult = await extractPdfText(fileBuffer);
        if (parseResult.isPasswordProtected) {
          return res.status(400).json({
            error: 'This PDF document is password-protected. Please upload an unprotected copy of the resume.',
          });
        }
        pdfExtractedText = parseResult.text || '';
      } catch (pdfErr: any) {
        console.warn('PDF text pre-extraction note:', pdfErr?.message || pdfErr);
      }

      if (!isValidPdfHeader && !pdfExtractedText) {
        return res.status(400).json({
          error: 'Unable to read this PDF document. The file does not appear to be a valid PDF format.',
        });
      }
    } else if (isDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        docxExtractedText = result.value ? result.value.trim() : '';

        if (!docxExtractedText || docxExtractedText.length < 25) {
          return res.status(400).json({
            error: 'Unable to extract readable text from this DOCX document. Please ensure the file contains readable text or upload a PDF version.',
          });
        }
      } catch {
        return res.status(400).json({
          error: 'Unable to read this DOCX document. The file may be damaged or password-protected. Please upload a valid PDF or DOCX file.',
        });
      }
    }

    // Check if resume appears completely empty or sparse
    const extractedTextLength = isDocx ? docxExtractedText.length : pdfExtractedText.length;
    const isVerySparseText = extractedTextLength > 0 && extractedTextLength < 180;

    // 4. Assemble contents for Gemini
    const promptParts: any[] = [];

    if (isPdf) {
      if (isValidPdfHeader) {
        promptParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBase64,
          },
        });
      }

      if (pdfExtractedText && pdfExtractedText.length > 20) {
        promptParts.push({
          text: `[DOCUMENT EXTRACTED TEXT CONTENT]\n${pdfExtractedText}`,
        });
      }
    } else if (isDocx && docxExtractedText) {
      promptParts.push({
        text: `[CANDIDATE RESUME DOCUMENT - TEXT CONTENT]\n${docxExtractedText}`,
      });
    }

    let roleSpecText = `Target Job Title: ${effectiveJobTitle || 'Target Position'}\nTarget Department / Team: ${department.trim() || 'Not specified'}\n\n[JOB SPECIFICATION & ROLE REQUIREMENTS]\n${effectiveJobDescription}`;
    if (responsibilities && responsibilities.trim()) {
      roleSpecText += `\n\n[SPECIFIC RESPONSIBILITIES]\n${responsibilities.trim()}`;
    }
    if (requirements && requirements.trim()) {
      roleSpecText += `\n\n[SPECIFIC QUALIFICATIONS & REQUIREMENTS]\n${requirements.trim()}`;
    }

    promptParts.push({
      text: roleSpecText,
    });

    const systemInstruction = `You are a rigorous, evidence-based recruitment analysis assistant for Mihora Tech.
Your task is to analyze an uploaded candidate resume strictly against the recruiter-provided job description.

CORE ETHICAL & FACTUAL MANDATES:
1. NEVER invent candidate experience, qualifications, employers, skills, certifications, achievements, dates, or scores.
2. NEVER use outside assumptions to fill missing candidate information. If information is absent from the resume, it is absent.
3. For every important requirement in the job description (technical skills, experience years, responsibilities, tools, education/certifications, collaboration), classify the evidence as strictly one of:
   - "Detected": The resume explicitly contains relevant evidence.
   - "Partially detected": The resume contains related evidence, but does not fully establish the requirement.
   - "Not detected in resume": The resume does not provide explicit evidence for that requirement.
4. CRITICAL PRINCIPLE: "Not detected in resume" must NEVER be treated or described as proof that the candidate does not have the skill or experience. It strictly means the resume text does not explicitly evidence it.
5. DO NOT infer skills merely because another related skill appears:
   - React does not prove Next.js.
   - JavaScript does not prove TypeScript.
   - Frontend development does not prove React.
   - Working at a company does not prove leadership.
   - Using an API does not prove expertise in a specific API technology.
   - A job title alone does not prove every skill in the job description.
6. Resume evidence citations MUST be concise, factual references strictly grounded in the resume. If not detected, state: "Not detected in the provided resume".
7. Candidate Overview:
   - Candidate Name: Extract only if clearly and explicitly stated in the resume. Otherwise null/empty.
   - Candidate Location Intelligence: Extract candidate location (city, state/province, country, or explicit remote preference) ONLY if clearly and explicitly stated in contact details, header, or resume text. If not explicitly found, return empty string. Never guess candidate location.
   - Current or most recent role: Extract only if clearly stated. Otherwise null/empty.
   - Experience summary: Formulate a concise summary of experience timeframe only when reasonably supported by explicit employment dates. Otherwise null/empty.
   - Key skills: Extract only skills explicitly mentioned in the resume.
   - Education: Extract degrees and educational institutions explicitly detected in the resume. Return empty array if not detected.
   - Certifications: Extract professional certifications explicitly stated in the resume. Return empty array if not detected.
8. Strengths: List only strengths that are explicitly supported by the resume and relevant to the job description.
9. Potential Gaps / Areas to Clarify: List requirements that are not detected, partially supported, or ambiguous. Use strictly neutral, respectful phrasing such as "Not detected in the provided resume", "Experience is not clearly specified", or "Consider clarifying during interview". NEVER say "Candidate cannot do this", "Candidate is unqualified", or "Reject candidate".
10. Interview Focus: Formulate specific, role-relevant questions to clarify areas not clearly detected or ambiguous in the resume.
11. Overall Role Alignment: Must be strictly one of:
   - "Strong alignment"
   - "Good alignment"
   - "Moderate alignment"
   - "Limited evidence"
   - "Insufficient evidence"
   NEVER provide numerical scores, grades, or percentages.
12. Hiring Decision Policy:
   The system is an analysis assistant, NOT an autonomous hiring decision maker.
   NEVER say:
   - "Hire this candidate"
   - "Reject this candidate"
   - "Candidate is unsuitable"
   - "Candidate is definitely qualified"
   Instead provide evidence and areas for the hiring team to evaluate.
13. Flag 'hasLimitedInformation' as true if the resume has very sparse text (under ~150 words of actual work history).
14. NEVER evaluate or mention protected characteristics (age, gender, ethnicity, religion, nationality, disability, marital status).`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let response;
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-2.5-pro',
    ];

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: promptParts,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                candidateOverview: {
                  type: Type.OBJECT,
                  properties: {
                    detectedName: {
                      type: Type.STRING,
                      description: 'Candidate full name if explicitly stated in resume, else empty string',
                    },
                    detectedLocation: {
                      type: Type.STRING,
                      description: 'Candidate location (city, state/province, country, or explicit remote preference) if explicitly stated in resume, else empty string',
                    },
                    currentOrRecentRole: {
                      type: Type.STRING,
                      description: 'Most recent job title if explicitly stated, else empty string',
                    },
                    experienceSummary: {
                      type: Type.STRING,
                      description: 'Experience summary timeframe based strictly on explicit dates, else empty string',
                    },
                    keySkillsDetected: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Explicitly stated skills found in the resume',
                    },
                    education: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Degrees, diplomas, and institutions explicitly mentioned in resume',
                    },
                    certifications: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Professional certifications explicitly detected in resume',
                    },
                  },
                  required: [
                    'detectedName',
                    'detectedLocation',
                    'currentOrRecentRole',
                    'experienceSummary',
                    'keySkillsDetected',
                    'education',
                    'certifications',
                  ],
                },
                roleSummary: {
                  type: Type.OBJECT,
                  properties: {
                    jobTitle: { type: Type.STRING },
                    department: { type: Type.STRING },
                    extractedSummary: {
                      type: Type.STRING,
                      description: 'Short summary of the core role requirements extracted from the job description',
                    },
                  },
                  required: ['jobTitle', 'department', 'extractedSummary'],
                },
                requirementMatches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      requirement: { type: Type.STRING, description: 'Core requirement from job description' },
                      status: {
                        type: Type.STRING,
                        description: 'Must be "Detected", "Partially detected", or "Not detected in resume"',
                      },
                      resumeEvidence: {
                        type: Type.STRING,
                        description: 'Concise evidence from resume, or "Not detected in the provided resume"',
                      },
                    },
                    required: ['requirement', 'status', 'resumeEvidence'],
                  },
                },
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Strengths explicitly evidenced in resume and relevant to role',
                },
                potentialGaps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Neutral descriptions of requirements that were not detected, partially supported, or ambiguous',
                },
                interviewFocus: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Role-specific interview inquiry areas based on gaps/ambiguities',
                },
                overallRoleAlignment: {
                  type: Type.OBJECT,
                  properties: {
                    level: {
                      type: Type.STRING,
                      description: 'Must be "Strong alignment", "Good alignment", "Moderate alignment", "Limited evidence", or "Insufficient evidence"',
                    },
                    summary: {
                      type: Type.STRING,
                      description: 'Concise qualitative rationale based only on evidence',
                    },
                  },
                  required: ['level', 'summary'],
                },
                hasLimitedInformation: {
                  type: Type.BOOLEAN,
                  description: 'True if resume contains limited readable information',
                },
              },
              required: [
                'candidateOverview',
                'roleSummary',
                'requirementMatches',
                'strengths',
                'potentialGaps',
                'interviewFocus',
                'overallRoleAlignment',
                'hasLimitedInformation',
              ],
            },
          },
        });

        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} transient note (status/code):`, err?.status || err?.name || 'GENAI_ERROR');
        const jitter = 300 + Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }
    }

    if (!response || !response.text) {
      console.error('All model attempts failed for current request');
      return res.status(500).json({
        error: 'The analysis service is currently experiencing high demand. Please try again in a few moments.',
      });
    }

    const responseText = response.text;
    const parsedData = JSON.parse(responseText);

    if (!parsedData.candidateOverview.detectedName) {
      parsedData.candidateOverview.detectedName = null;
    }
    if (!parsedData.candidateOverview.detectedLocation) {
      parsedData.candidateOverview.detectedLocation = null;
    }
    if (!parsedData.candidateOverview.currentOrRecentRole) {
      parsedData.candidateOverview.currentOrRecentRole = null;
    }
    if (!parsedData.candidateOverview.experienceSummary) {
      parsedData.candidateOverview.experienceSummary = null;
    }

    if (!parsedData.roleSummary.jobTitle) {
      parsedData.roleSummary.jobTitle = jobTitle.trim() || 'Role Requirements';
    }
    if (!parsedData.roleSummary.department) {
      parsedData.roleSummary.department = department.trim() || 'General';
    }

    const validLevels = [
      'Strong alignment',
      'Good alignment',
      'Moderate alignment',
      'Limited evidence',
      'Insufficient evidence',
    ];
    if (!validLevels.includes(parsedData.overallRoleAlignment?.level)) {
      if (parsedData.overallRoleAlignment?.level?.includes('Insufficient')) {
        parsedData.overallRoleAlignment.level = 'Insufficient evidence';
      } else {
        parsedData.overallRoleAlignment.level = 'Moderate alignment';
      }
    }

    const normalizedMatches = (parsedData.requirementMatches || []).map((match: any) => {
      let status = match.status || 'Not detected in resume';
      if (status === 'Not detected' || status.toLowerCase().includes('not detected')) {
        status = 'Not detected in resume';
      } else if (status.toLowerCase().includes('partial')) {
        status = 'Partially detected';
      } else if (status.toLowerCase().includes('detected')) {
        status = 'Detected';
      } else {
        status = 'Not detected in resume';
      }
      return {
        requirement: match.requirement,
        status,
        resumeEvidence: match.resumeEvidence || 'Not detected in the provided resume',
      };
    });

    const analysisResult = {
      id: `analysis-${Date.now()}`,
      jobId: effectiveJobId,
      analyzedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      fileName,
      candidateOverview: {
        detectedName: parsedData.candidateOverview.detectedName,
        detectedLocation: parsedData.candidateOverview.detectedLocation,
        currentOrRecentRole: parsedData.candidateOverview.currentOrRecentRole,
        experienceSummary: parsedData.candidateOverview.experienceSummary,
        keySkillsDetected: Array.isArray(parsedData.candidateOverview.keySkillsDetected)
          ? parsedData.candidateOverview.keySkillsDetected
          : [],
        education: Array.isArray(parsedData.candidateOverview.education)
          ? parsedData.candidateOverview.education
          : [],
        certifications: Array.isArray(parsedData.candidateOverview.certifications)
          ? parsedData.candidateOverview.certifications
          : [],
      },
      roleSummary: parsedData.roleSummary,
      requirementMatches: normalizedMatches,
      strengths: Array.isArray(parsedData.strengths) ? parsedData.strengths : [],
      potentialGaps: Array.isArray(parsedData.potentialGaps) ? parsedData.potentialGaps : [],
      interviewFocus: Array.isArray(parsedData.interviewFocus) ? parsedData.interviewFocus : [],
      overallRoleAlignment: parsedData.overallRoleAlignment,
      hasLimitedInformation: Boolean(parsedData.hasLimitedInformation) || isVerySparseText,
    };

    return res.status(200).json(analysisResult);
  } catch (err: any) {
    console.error('Resume analysis processing failure (code/message):', err?.status || err?.name || 'ANALYSIS_ERROR');
    return res.status(500).json({
      error: 'Unable to complete resume analysis. Please try again.',
    });
  } finally {
    if (slotAcquired) {
      releaseConcurrencySlot();
    }
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight if requested
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  return handleAnalyzeResumeRequest(req, res);
}
