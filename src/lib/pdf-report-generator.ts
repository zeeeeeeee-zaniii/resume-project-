import { jsPDF } from 'jspdf';
import { AnalysisResult } from '../types';

/**
 * Generates and downloads a structured, executive-ready PDF report
 * of a candidate's resume analysis against a job requisition.
 * Works completely client-side with full offline and A4 pagination support.
 */
export function generateCandidatePdfReport(result: AnalysisResult): void {
  if (!result) {
    throw new Error('Analysis result data is missing.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight; // 180mm
  const bottomMargin = 20;

  let currentY = 18;
  let inCriteriaTable = false;

  // Helper to draw running page header (on page 2+)
  const drawPageHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Mihora Resume Intelligence — Candidate Screening Evaluation', marginLeft, 10);
    doc.text(
      `Role: ${result.roleSummary?.jobTitle || 'Requisition'}`,
      pageWidth - marginRight,
      10,
      { align: 'right' }
    );
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(marginLeft, 12, pageWidth - marginRight, 12);
  };

  const drawCriteriaTableHeader = (yPos: number) => {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(marginLeft, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('JOB REQUIREMENT', marginLeft + 3, yPos + 4.8);
    doc.text('STATUS', marginLeft + 85, yPos + 4.8);
    doc.text('EVIDENCE IN RESUME', marginLeft + 120, yPos + 4.8);
  };

  // Helper to check for page break
  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 18;
      drawPageHeader();

      // If page break occurs while rendering the criteria table, redraw the table header
      if (inCriteriaTable) {
        drawCriteriaTableHeader(currentY);
        currentY += 8;
      }
    }
  };

  const candidateName = result.candidateOverview?.detectedName || result.fileName || 'Candidate';
  const jobTitle = result.roleSummary?.jobTitle || 'Job Requisition';
  const department = result.roleSummary?.department || 'General';
  const analyzedAt = result.analyzedAt || new Date().toLocaleDateString();
  const alignmentLevel = result.overallRoleAlignment?.level || 'Moderate alignment';
  const alignmentSummary = result.overallRoleAlignment?.summary || '';

  // Requirement match metrics
  const totalReqs = result.requirementMatches?.length || 0;
  const detectedCount = (result.requirementMatches || []).filter((r) => r.status === 'Detected').length;
  const partialCount = (result.requirementMatches || []).filter((r) => r.status === 'Partially detected').length;
  const notDetectedCount = (result.requirementMatches || []).filter((r) => r.status === 'Not detected in resume').length;

  // ==========================================
  // PAGE 1: HEADER & CANDIDATE DOSSIER
  // ==========================================

  // Brand Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(marginLeft, currentY, contentWidth, 1.5, 'F');
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('MIHORA RESUME INTELLIGENCE', marginLeft, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Generated: ${analyzedAt}`, pageWidth - marginRight, currentY, { align: 'right' });

  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text('CANDIDATE REQUISITION SCREENING REPORT', marginLeft, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const safeFilename = result.fileName || 'Uploaded_Resume.pdf';
  doc.text(`Source Document: ${safeFilename}`, pageWidth - marginRight, currentY, { align: 'right' });

  currentY += 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
  currentY += 7;

  // Candidate & Role Profile Box (handles long titles safely)
  const leftColW = (contentWidth / 2) - 4;
  const rightColX = marginLeft + (contentWidth / 2) + 4;
  const rightColW = leftColW;

  const candidateNameLines = doc.splitTextToSize(candidateName, leftColW);
  const jobTitleLines = doc.splitTextToSize(jobTitle, rightColW);

  const profileBoxHeight = Math.max(36, 20 + Math.max(candidateNameLines.length, jobTitleLines.length) * 5);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(marginLeft, currentY, contentWidth, profileBoxHeight, 2, 2, 'FD');

  const boxY = currentY + 6;
  // Left side: Candidate Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(candidateNameLines, marginLeft + 6, boxY);

  const leftSubY = boxY + (candidateNameLines.length * 5) + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const currentRole = result.candidateOverview?.currentOrRecentRole || 'Role not specified in resume';
  const currentRoleLines = doc.splitTextToSize(`Recent: ${currentRole}`, leftColW);
  doc.text(currentRoleLines.slice(0, 2), marginLeft + 6, leftSubY);

  const loc = result.candidateOverview?.detectedLocation ? `Location: ${result.candidateOverview.detectedLocation}` : 'Location: Not detected in resume';
  doc.text(loc, marginLeft + 6, leftSubY + 6);

  // Right side: Target Job & Department
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Target Requisition:', rightColX, boxY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 64, 175);
  doc.text(jobTitleLines, rightColX, boxY + 5);

  const rightSubY = boxY + 5 + (jobTitleLines.length * 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Department: ${department}`, rightColX, rightSubY);

  currentY += profileBoxHeight + 7;

  // Overall Alignment Card (dynamically sized to fit summary)
  let alignFillR = 241, alignFillG = 245, alignFillB = 249; // default slate
  let alignStrokeR = 203, alignStrokeG = 213, alignStrokeB = 225;
  let alignTextR = 30, alignTextG = 41, alignTextB = 59;

  if (alignmentLevel === 'Strong alignment') {
    alignFillR = 236; alignFillG = 253; alignFillB = 245; // emerald-50
    alignStrokeR = 167; alignStrokeG = 243; alignStrokeB = 208;
    alignTextR = 6; alignTextG = 95; alignTextB = 70;
  } else if (alignmentLevel === 'Good alignment') {
    alignFillR = 239; alignFillG = 246; alignFillB = 255; // blue-50
    alignStrokeR = 191; alignStrokeG = 219; alignStrokeB = 254;
    alignTextR = 30; alignTextG = 64; alignTextB = 175;
  } else if (alignmentLevel === 'Moderate alignment') {
    alignFillR = 255; alignFillG = 251; alignFillB = 235; // amber-50
    alignStrokeR = 253; alignStrokeG = 230; alignStrokeB = 138;
    alignTextR = 146; alignTextG = 64; alignTextB = 14;
  }

  const splitSummary = alignmentSummary ? doc.splitTextToSize(alignmentSummary, contentWidth - 12) : [];
  const summaryBoxHeight = Math.max(22, 11 + splitSummary.length * 3.8);

  ensureSpace(summaryBoxHeight + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. OVERALL REQUISITION ALIGNMENT', marginLeft, currentY);
  currentY += 4;

  doc.setFillColor(alignFillR, alignFillG, alignFillB);
  doc.setDrawColor(alignStrokeR, alignStrokeG, alignStrokeB);
  doc.roundedRect(marginLeft, currentY, contentWidth, summaryBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(alignTextR, alignTextG, alignTextB);
  doc.text(`Alignment Rating: ${alignmentLevel}`, marginLeft + 6, currentY + 6);

  if (splitSummary.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(splitSummary, marginLeft + 6, currentY + 11);
  }

  currentY += summaryBoxHeight + 7;

  // Screening Metrics Statistics Pill Row
  ensureSpace(20);
  const colW = contentWidth / 4;
  const statBoxH = 14;

  const stats = [
    { label: 'Total Criteria', val: `${totalReqs}`, colorR: 15, colorG: 23, colorB: 42, bgR: 248, bgG: 250, bgB: 252 },
    { label: 'Detected', val: `${detectedCount}`, colorR: 5, colorG: 150, colorB: 105, bgR: 236, bgG: 253, bgB: 245 },
    { label: 'Partially Detected', val: `${partialCount}`, colorR: 217, colorG: 119, colorB: 6, bgR: 255, bgG: 251, bgB: 235 },
    { label: 'Not Evidenced', val: `${notDetectedCount}`, colorR: 100, colorG: 116, colorB: 139, bgR: 241, bgG: 245, bgB: 249 },
  ];

  stats.forEach((st, idx) => {
    const x = marginLeft + (idx * colW);
    doc.setFillColor(st.bgR, st.bgG, st.bgB);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x + 1, currentY, colW - 2, statBoxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(st.colorR, st.colorG, st.colorB);
    doc.text(st.val, x + (colW / 2), currentY + 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(st.label, x + (colW / 2), currentY + 11, { align: 'center' });
  });

  currentY += statBoxH + 8;

  // ==========================================
  // SECTION 2: DETAILED CRITERIA EVALUATION
  // ==========================================
  ensureSpace(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DETAILED JOB CRITERIA & EVIDENCE EVALUATION', marginLeft, currentY);
  currentY += 5;

  inCriteriaTable = true;
  drawCriteriaTableHeader(currentY);
  currentY += 8;

  // Criteria Rows
  (result.requirementMatches || []).forEach((match, idx) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const reqLines = doc.splitTextToSize(match.requirement || 'Requirement', 78);
    const evidenceText = match.resumeEvidence || 'No direct evidence identified in submitted resume text.';
    const evidenceLines = doc.splitTextToSize(evidenceText, 57);

    const rowLines = Math.max(reqLines.length, evidenceLines.length, 1);
    const rowHeight = Math.max(rowLines * 3.8 + 4, 10);

    ensureSpace(rowHeight + 2);

    // Alternate row background
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(marginLeft, currentY, contentWidth, rowHeight, 'F');
    }

    // Row bottom border
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, currentY + rowHeight, pageWidth - marginRight, currentY + rowHeight);

    // Requirement text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(reqLines, marginLeft + 3, currentY + 4);

    // Status badge text
    const statusText = match.status || 'Not detected in resume';
    let sColorR = 100, sColorG = 116, sColorB = 139;
    if (match.status === 'Detected') {
      sColorR = 5; sColorG = 150; sColorB = 105;
    } else if (match.status === 'Partially detected') {
      sColorR = 217; sColorG = 119; sColorB = 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(sColorR, sColorG, sColorB);
    doc.text(statusText, marginLeft + 85, currentY + 4);

    // Resume Evidence text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(evidenceLines, marginLeft + 120, currentY + 4);

    currentY += rowHeight;
  });

  inCriteriaTable = false;
  currentY += 6;

  // ==========================================
  // SECTION 3: KEY STRENGTHS & POTENTIAL GAPS
  // ==========================================
  const twoColW = (contentWidth / 2) - 3;
  const strengthsList = (result.strengths && result.strengths.length > 0)
    ? result.strengths
    : ['Evidence aligns directly with core role specifications.'];
  const gapsList = (result.potentialGaps && result.potentialGaps.length > 0)
    ? result.potentialGaps
    : ['No critical qualification discrepancies identified in screening.'];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const strengthsLines = strengthsList.map((str) => doc.splitTextToSize(`• ${str}`, twoColW - 8));
  const gapsLines = gapsList.map((gap) => doc.splitTextToSize(`• ${gap}`, twoColW - 8));

  const strTotalLines = strengthsLines.reduce((acc, l) => acc + l.length, 0);
  const gapTotalLines = gapsLines.reduce((acc, l) => acc + l.length, 0);
  const maxLines = Math.max(strTotalLines, gapTotalLines, 2);
  const boxHeight = Math.max(38, 12 + maxLines * 4.2);

  ensureSpace(boxHeight + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. CANDIDATE STRENGTHS & POTENTIAL GAPS', marginLeft, currentY);
  currentY += 5;

  const colYStart = currentY;

  // Strengths column
  doc.setFillColor(240, 253, 244); // green-50
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(marginLeft, colYStart, twoColW, boxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(21, 128, 61); // green-700
  doc.text('Verified Candidate Strengths', marginLeft + 4, colYStart + 6);

  let strY = colYStart + 11;
  strengthsLines.forEach((split) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text(split, marginLeft + 4, strY);
    strY += (split.length * 3.6) + 1;
  });

  // Potential Gaps column
  const rightBoxX = marginLeft + twoColW + 6;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(rightBoxX, colYStart, twoColW, boxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28); // rose-700
  doc.text('Potential Gaps & Unstated Criteria', rightBoxX + 4, colYStart + 6);

  let gapY = colYStart + 11;
  gapsLines.forEach((split) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(153, 27, 27);
    doc.text(split, rightBoxX + 4, gapY);
    gapY += (split.length * 3.6) + 1;
  });

  currentY = colYStart + boxHeight + 7;

  // ==========================================
  // SECTION 4: RECOMMENDED INTERVIEW QUESTIONS
  // ==========================================
  const interviewQuestions = result.interviewFocus || [];
  if (interviewQuestions.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('4. SUGGESTED INTERVIEW PROBING QUESTIONS', marginLeft, currentY);
    currentY += 5;

    interviewQuestions.forEach((q, idx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const qLines = doc.splitTextToSize(`Q${idx + 1}. ${q}`, contentWidth - 10);
      const qBoxH = Math.max(qLines.length * 3.8 + 4, 10);

      ensureSpace(qBoxH + 3);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginLeft, currentY, contentWidth, qBoxH, 1, 1, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(qLines, marginLeft + 5, currentY + 5);

      currentY += qBoxH + 2.5;
    });

    currentY += 4;
  }

  // ==========================================
  // SECTION 5: DETECTED SKILLS & CREDENTIALS
  // ==========================================
  const skills = result.candidateOverview?.keySkillsDetected || [];
  const education = result.candidateOverview?.education || [];
  const certifications = result.candidateOverview?.certifications || [];

  if (skills.length > 0 || education.length > 0 || certifications.length > 0) {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('5. EXTRACTED CANDIDATE SKILLS & CREDENTIALS', marginLeft, currentY);
    currentY += 4.5;

    if (skills.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const skillsText = `Key Skills: ${skills.join(', ')}`;
      const splitSkills = doc.splitTextToSize(skillsText, contentWidth);
      doc.text(splitSkills, marginLeft, currentY);
      currentY += (splitSkills.length * 3.8) + 2;
    }

    if (education.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const eduText = `Education: ${education.join(' | ')}`;
      const splitEdu = doc.splitTextToSize(eduText, contentWidth);
      doc.text(splitEdu, marginLeft, currentY);
      currentY += (splitEdu.length * 3.8) + 2;
    }

    if (certifications.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const certText = `Certifications: ${certifications.join(' | ')}`;
      const splitCert = doc.splitTextToSize(certText, contentWidth);
      doc.text(splitCert, marginLeft, currentY);
      currentY += (splitCert.length * 3.8) + 2;
    }

    currentY += 3;
  }

  // ==========================================
  // SECTION 6: HIRING GOVERNANCE DISCLAIMER
  // ==========================================
  ensureSpace(24);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginLeft, currentY, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('GOVERNANCE & FAIR HIRING STATEMENT', marginLeft + 5, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const disclaimer =
    'This evaluation is strictly grounded in textual criteria from the candidate resume and job criteria. "Not detected in resume" indicates absence of evidence in the submitted document, not lack of ability. This report serves as objective recruiter decision support; final hiring determinations remain the responsibility of hiring managers.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth - 10);
  doc.text(splitDisclaimer, marginLeft + 5, currentY + 9);

  // ==========================================
  // PAGE NUMBERS & CONFIDENTIALITY FOOTERS
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Mihora Resume Intelligence — Confidential Recruiter Debrief', marginLeft, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
  }

  // Trigger download
  const safeCandidateName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeJobTitle = jobTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeCandidateName}_${safeJobTitle}_Screening_Report.pdf`;

  doc.save(filename);
}
