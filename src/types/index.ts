export type TabType = 'overview' | 'analytics' | 'jobs' | 'candidates' | 'settings' | 'new-analysis';

export interface ResumeFile {
  file: File | null;
  name: string;
  size: number;
  type: 'PDF' | 'DOCX' | string;
  formattedSize: string;
  uploadedAt: string;
  base64?: string;
}

export interface Job {
  id: string;
  userId: string;
  title: string;
  department: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  employmentType?: 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Other';
  location?: string;
  workplaceType?: 'Remote' | 'Hybrid' | 'On-site';
  status: 'Open' | 'Closed';
  createdAt: string;
  updatedAt: string;
}

export type CandidateStage = 'New' | 'Reviewed' | 'Shortlisted' | 'Interview' | 'Hired' | 'Rejected';
export type CandidateStatus = CandidateStage | 'Screened' | 'Reviewing' | 'Archived';

export interface CandidateRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  jobDepartment: string;
  userId: string;
  name: string;
  location: string | null;
  currentRole: string | null;
  alignmentLevel: OverallAlignmentLevel;
  analysisId: string;
  analyzedAt: string;
  notes?: string;
  status: CandidateStatus;
  createdAt: string;
  updatedAt: string;
}

export function getNormalizedStage(status?: string | null): CandidateStage {
  if (!status) return 'New';
  switch (status) {
    case 'New':
      return 'New';
    case 'Reviewed':
    case 'Reviewing':
    case 'Screened':
      return 'Reviewed';
    case 'Shortlisted':
      return 'Shortlisted';
    case 'Interview':
      return 'Interview';
    case 'Hired':
      return 'Hired';
    case 'Rejected':
    case 'Archived':
      return 'Rejected';
    default:
      return 'New';
  }
}

export interface PipelineStageConfig {
  id: CandidateStage;
  label: string;
  description: string;
  color: string;
  badgeClass: string;
  headerBg: string;
}

export const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    id: 'New',
    label: 'New',
    description: 'Awaiting recruiter review',
    color: 'bg-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headerBg: 'bg-blue-50/80 text-blue-900 border-blue-200',
  },
  {
    id: 'Reviewed',
    label: 'Reviewed',
    description: 'Resume evidence vetted',
    color: 'bg-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    headerBg: 'bg-indigo-50/80 text-indigo-900 border-indigo-200',
  },
  {
    id: 'Shortlisted',
    label: 'Shortlisted',
    description: 'Selected for hiring team review',
    color: 'bg-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    headerBg: 'bg-amber-50/80 text-amber-900 border-amber-200',
  },
  {
    id: 'Interview',
    label: 'Interview',
    description: 'Active interview process',
    color: 'bg-purple-600',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    headerBg: 'bg-purple-50/80 text-purple-900 border-purple-200',
  },
  {
    id: 'Hired',
    label: 'Hired',
    description: 'Offer accepted',
    color: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-emerald-50/80 text-emerald-900 border-emerald-200',
  },
  {
    id: 'Rejected',
    label: 'Rejected',
    description: 'Archived / declined',
    color: 'bg-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    headerBg: 'bg-rose-50/80 text-rose-900 border-rose-200',
  },
];

export type MatchStatus = 'Detected' | 'Partially detected' | 'Not detected in resume';

export interface RequirementMatch {
  requirement: string;
  status: MatchStatus;
  resumeEvidence: string;
}

export interface CandidateOverview {
  detectedName: string | null;
  detectedLocation: string | null;
  currentOrRecentRole: string | null;
  experienceSummary: string | null;
  keySkillsDetected: string[];
  education: string[];
  certifications: string[];
}

export interface RoleSummary {
  jobTitle: string;
  department: string;
  extractedSummary: string;
}

export type OverallAlignmentLevel = 
  | 'Strong alignment' 
  | 'Good alignment' 
  | 'Moderate alignment' 
  | 'Limited evidence' 
  | 'Insufficient evidence';

export interface OverallRoleAlignment {
  level: OverallAlignmentLevel;
  summary: string;
}

export interface AnalysisResult {
  id: string;
  jobId?: string;
  candidateId?: string;
  userId?: string;
  analyzedAt: string;
  fileName: string;
  candidateOverview: CandidateOverview;
  roleSummary: RoleSummary;
  requirementMatches: RequirementMatch[];
  strengths: string[];
  potentialGaps: string[];
  interviewFocus: string[];
  overallRoleAlignment: OverallRoleAlignment;
  hasLimitedInformation: boolean;
  resumeBase64?: string;
}
