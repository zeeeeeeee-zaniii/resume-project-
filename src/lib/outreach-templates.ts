import { AnalysisResult, CandidateRecord, Job, OutreachTemplateType, CandidateInterview } from '../types';

export interface OutreachEmailDraft {
  templateType: OutreachTemplateType;
  subject: string;
  body: string;
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  companyName: string;
  groundedSkills: string[];
  groundedGaps: string[];
}

export interface OutreachDraftOptions {
  recipientEmail?: string;
  senderName?: string;
  senderEmail?: string;
  companyName?: string;
  customNotes?: string;
  proposedDateTimes?: string;
  meetingLink?: string;
  selectedInterview?: CandidateInterview | null;
}

export function extractCandidateFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'Candidate';
  const clean = fullName.trim();
  const first = clean.split(' ')[0];
  return first || 'Candidate';
}

export function generateOutreachDraft(
  templateType: OutreachTemplateType,
  candidateAnalysis: AnalysisResult,
  candidateRecord?: CandidateRecord | null,
  job?: Job | null,
  options: OutreachDraftOptions = {}
): OutreachEmailDraft {
  const candidateName =
    candidateRecord?.name ||
    candidateAnalysis.candidateOverview.detectedName ||
    candidateAnalysis.fileName.replace(/\.(pdf|docx)$/i, '');

  const firstName = extractCandidateFirstName(candidateName);
  const jobTitle = job?.title || candidateAnalysis.roleSummary.jobTitle || 'Role';
  const department = job?.department || candidateAnalysis.roleSummary.department || 'Technology';
  const companyName = options.companyName || 'Mihora Tech';
  const senderName = options.senderName || 'Talent Acquisition Team';
  const senderEmail = options.senderEmail || 'recruiting@mihora.tech';
  const recipientEmail = options.recipientEmail || '';

  // Grounded detected skills
  const keySkills = candidateAnalysis.candidateOverview.keySkillsDetected || [];
  const detectedReqs = candidateAnalysis.requirementMatches
    .filter((r) => r.status === 'Detected')
    .map((r) => r.requirement);
  const groundedSkills = Array.from(new Set([...keySkills, ...detectedReqs])).slice(0, 4);

  // Grounded gaps or unevidenced requirements
  const unevidencedReqs = candidateAnalysis.requirementMatches
    .filter((r) => r.status === 'Not detected in resume' || r.status === 'Partially detected')
    .map((r) => r.requirement);
  const potentialGaps = candidateAnalysis.potentialGaps || [];
  const groundedGaps = Array.from(new Set([...unevidencedReqs, ...potentialGaps])).slice(0, 3);

  // Interview round info if available
  const scheduledInterview =
    options.selectedInterview ||
    candidateRecord?.interviews?.find((i) => i.status === 'Scheduled') ||
    null;

  let subject = '';
  let body = '';

  switch (templateType) {
    case 'interview_invitation': {
      subject = `Interview Invitation: ${jobTitle} at ${companyName} - ${candidateName}`;

      const skillsMention =
        groundedSkills.length > 0
          ? `especially your experience in ${groundedSkills.slice(0, 3).join(', ')}`
          : 'your background';

      let interviewDetailsSection = '';
      if (scheduledInterview) {
        const dateStr = scheduledInterview.scheduledAt
          ? new Date(scheduledInterview.scheduledAt).toLocaleString(undefined, {
              dateStyle: 'full',
              timeStyle: 'short',
            })
          : 'To be confirmed';

        interviewDetailsSection = `Round Details:
• Interview Type: ${scheduledInterview.interviewType}
• Scheduled Date & Time: ${dateStr}
• Duration: ${scheduledInterview.durationMinutes} minutes
${scheduledInterview.interviewers?.length ? `• Interviewer(s): ${scheduledInterview.interviewers.join(', ')}\n` : ''}${
          scheduledInterview.meetingLinkOrLocation
            ? `• Meeting Location / Video Link: ${scheduledInterview.meetingLinkOrLocation}\n`
            : ''
        }`;
      } else {
        const proposedTime = options.proposedDateTimes || 'over the next few business days';
        interviewDetailsSection = `Proposed Interview Details:
• Format: Video Conference (Google Meet / Zoom)
• Duration: 45 minutes
• Proposed Availability: ${proposedTime}

Please let us know your preferred time slots from the options above, or suggest 2–3 alternate windows that suit your calendar.`;
      }

      body = `Hi ${firstName},

Thank you for your application for the ${jobTitle} position with the ${department} team at ${companyName}.

Our recruitment and hiring team reviewed your qualifications, and we were very impressed by your background, ${skillsMention}. We would like to invite you to meet with our team for the next round of our hiring process.

${interviewDetailsSection}

${
  candidateAnalysis.interviewFocus?.length
    ? `During this discussion, our team will explore your practical experience and discuss how your skills align with our upcoming initiatives.`
    : ''
}

If you have any accessibility requirements or questions in advance, please let us know. We look forward to speaking with you!

Warm regards,

${senderName}
Talent Acquisition | ${companyName}
${senderEmail}`;
      break;
    }

    case 'clarification_request': {
      subject = `Follow-up regarding your ${jobTitle} application - ${companyName}`;

      const skillsSummary =
        groundedSkills.length > 0
          ? `We noted strong evidence in your profile for ${groundedSkills.slice(0, 3).join(', ')}.`
          : '';

      const gapsList =
        groundedGaps.length > 0
          ? groundedGaps.map((g) => `• ${g}`).join('\n')
          : `• Relevant hands-on project examples and technical leadership depth\n• Specific experience aligning with the core requirements of this role`;

      body = `Hi ${firstName},

Thank you for applying for the ${jobTitle} role at ${companyName}.

Our recruiting team has completed an initial review of your resume and credentials. ${skillsSummary}

To ensure we evaluate your candidacy with full context before our hiring committee review, could you please provide a bit more detail regarding the following areas:

${gapsList}

A brief summary, code repository link, portfolio sample, or updated project overview addressing these points will help us accurately complete our assessment.

Please reply directly to this email at your earliest convenience. Thank you for your time and continued interest in ${companyName}.

Best regards,

${senderName}
Talent Acquisition | ${companyName}
${senderEmail}`;
      break;
    }

    case 'rejection': {
      subject = `Update regarding your application for ${jobTitle} at ${companyName}`;

      const recentRoleNotice = candidateAnalysis.candidateOverview.currentOrRecentRole
        ? ` as ${candidateAnalysis.candidateOverview.currentOrRecentRole}`
        : '';

      body = `Dear ${firstName},

Thank you for taking the time to apply for the ${jobTitle} position at ${companyName} and for your interest in joining our team.

We received a high volume of qualified applications for this opening. While our team was impressed with your professional background${recentRoleNotice}, we have decided to proceed with candidates whose specific experience and technical skill profiles more closely match our immediate requirements for this role.

We want to emphasize that this decision reflects our current team priorities and not your potential. We will retain your profile in our talent pool for future openings that may be a strong fit for your skillset.

Thank you again for the time and energy you invested in connecting with ${companyName}. We wish you the very best in your job search and future career endeavors.

Sincerely,

${senderName}
Talent Acquisition | ${companyName}
${senderEmail}`;
      break;
    }

    case 'screening_followup': {
      subject = `Application Update: ${jobTitle} at ${companyName}`;

      body = `Hi ${firstName},

We wanted to provide a quick update on your application for the ${jobTitle} role at ${companyName}.

Our talent intelligence team has completed initial screening of your resume against our role specifications. Your profile has advanced to our hiring manager review queue for the ${department} team.

Our hiring team is currently finalizing interview schedules. We expect to reach out with concrete next steps within the next 2–3 business days.

In the meantime, feel free to reply if you have any questions. Thank you for your patience and enthusiasm!

Warm regards,

${senderName}
Talent Acquisition | ${companyName}
${senderEmail}`;
      break;
    }
  }

  return {
    templateType,
    subject,
    body,
    recipientName: candidateName,
    recipientEmail,
    senderName,
    senderEmail,
    companyName,
    groundedSkills,
    groundedGaps,
  };
}

export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (body) params.append('body', body);
  const queryString = params.toString().replace(/\+/g, '%20');
  return `mailto:${encodeURIComponent(to)}?${queryString}`;
}
