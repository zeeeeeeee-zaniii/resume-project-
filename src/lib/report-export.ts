import { AnalysisResult } from '../types';

/**
 * Generates and downloads a self-contained, standalone printable HTML report
 * containing the real candidate screening analysis data and exact A4 styles.
 * Compatible with all browsers and bypasses sandboxed iframe print limitations.
 */
export function downloadPrintableReport(result: AnalysisResult): void {
  const candidateName = result.candidateOverview?.detectedName || 'Candidate';
  const roleTitle = result.roleSummary?.jobTitle || 'Role';
  const department = result.roleSummary?.department || 'General';
  const analyzedAt = result.analyzedAt || new Date().toLocaleDateString();
  const safeFilename = `${candidateName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Screening_Report.html`;

  const skillsHtml = (result.candidateOverview?.keySkillsDetected || [])
    .map((s) => `<span class="badge skill-badge">${escapeHtml(s)}</span>`)
    .join(' ');

  const educationHtml = (result.candidateOverview?.education || [])
    .map((e) => `<li>${escapeHtml(e)}</li>`)
    .join('');

  const certsHtml = (result.candidateOverview?.certifications || [])
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('');

  const matchesHtml = (result.requirementMatches || [])
    .map((m) => {
      let statusClass = 'status-not-detected';
      let statusLabel = 'Not detected in resume';
      if (m.status === 'Detected') {
        statusClass = 'status-detected';
        statusLabel = 'Detected';
      } else if (m.status === 'Partially detected') {
        statusClass = 'status-partial';
        statusLabel = 'Partially detected';
      }

      return `
        <tr>
          <td class="req-title">${escapeHtml(m.requirement)}</td>
          <td class="req-status"><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td class="req-evidence">${escapeHtml(m.resumeEvidence)}</td>
        </tr>
      `;
    })
    .join('');

  const strengthsHtml = (result.strengths || [])
    .map((s) => `<li><span class="bullet emerald">&bull;</span><span>${escapeHtml(s)}</span></li>`)
    .join('');

  const gapsHtml = (result.potentialGaps || [])
    .map((g) => `<li><span class="bullet slate">&bull;</span><span>${escapeHtml(g)}</span></li>`)
    .join('');

  const questionsHtml = (result.interviewFocus || [])
    .map((q, i) => `
      <div class="interview-q">
        <span class="q-num">Q${i + 1}.</span>
        <span class="q-text">${escapeHtml(q)}</span>
      </div>
    `)
    .join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mihora Screening Report — ${escapeHtml(candidateName)} (${escapeHtml(roleTitle)})</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      font-size: 10pt;
      line-height: 1.45;
    }
    .toolbar {
      max-width: 860px;
      margin: 0 auto 16px auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .toolbar-info {
      font-size: 12px;
      color: #475569;
    }
    .toolbar-btn {
      background: #1d4ed8;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .toolbar-btn:hover {
      background: #1e40af;
    }
    .report-paper {
      max-width: 840px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 24px 28px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header-rule {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #020617;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 8.5pt;
      font-family: 'JetBrains Mono', monospace;
      color: #475569;
      letter-spacing: 0.05em;
      margin-top: 1px;
    }
    .meta-box {
      text-align: right;
      font-size: 8.5pt;
      font-family: 'JetBrains Mono', monospace;
      color: #64748b;
      line-height: 1.35;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 12px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .card.avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .card.table-card {
      page-break-inside: auto;
      break-inside: auto;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .section-label {
      font-size: 8pt;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #1d4ed8;
      margin-bottom: 6px;
      font-weight: 700;
      break-after: avoid;
      page-break-after: avoid;
    }
    .candidate-name {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }
    .info-row {
      font-size: 9pt;
      margin-bottom: 3.5px;
      color: #334155;
    }
    .info-label {
      font-weight: 600;
      color: #475569;
    }
    .location-tag {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 1px 7px;
      border-radius: 4px;
      font-weight: 600;
      color: #0f172a;
      font-size: 8.5pt;
    }
    .badge {
      display: inline-block;
      padding: 2.5px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
    }
    .skill-badge {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      margin-right: 4px;
      margin-bottom: 4px;
    }
    .alignment-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .alignment-level {
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 8.5pt;
      white-space: nowrap;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 6px;
      table-layout: fixed;
      page-break-inside: auto;
      break-inside: auto;
    }
    thead {
      display: table-header-group;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    tbody {
      page-break-inside: auto;
      break-inside: auto;
    }
    th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 8.5pt;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      line-height: 1.45;
      word-break: break-word;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .req-title {
      font-weight: 600;
      color: #0f172a;
      width: 30%;
    }
    .req-status {
      width: 22%;
    }
    .req-evidence {
      color: #475569;
      width: 48%;
    }
    .status-detected {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .status-partial {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .status-not-detected {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    ul.check-list {
      list-style: none;
      padding-left: 0;
      margin: 6px 0 0 0;
      font-size: 9pt;
    }
    ul.check-list li {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      margin-bottom: 5px;
      color: #334155;
      line-height: 1.4;
    }
    .bullet.emerald { color: #059669; font-weight: bold; font-size: 11pt; line-height: 0.9; }
    .bullet.slate { color: #94a3b8; font-weight: bold; font-size: 11pt; line-height: 0.9; }
    .interview-q {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 6px;
      font-size: 9pt;
      display: flex;
      gap: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .q-num {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #1d4ed8;
    }
    .disclaimer-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 8pt;
      color: #475569;
      line-height: 1.45;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 9.5pt !important;
        line-height: 1.4 !important;
      }
      .toolbar {
        display: none !important;
      }
      .report-paper {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: none !important;
        margin: 0 !important;
      }
      .card {
        padding: 10px 14px !important;
        margin-bottom: 10px !important;
        border-color: #cbd5e1 !important;
        box-shadow: none !important;
      }
      .header-rule {
        margin-bottom: 10px !important;
        padding-bottom: 8px !important;
      }
      .grid-2 {
        gap: 12px !important;
      }
      .disclaimer-box {
        padding: 8px 12px !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-info">
      <strong>Mihora Resume Intelligence</strong> &bull; Standalone Printable Report &bull; ${escapeHtml(candidateName)}
    </div>
    <button class="toolbar-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="report-paper">
    <div class="header-rule">
      <div>
        <div class="brand-title">Mihora Resume Intelligence</div>
        <div class="brand-sub">Candidate Requisition Screening Report</div>
      </div>
      <div class="meta-box">
        <div>Date: ${escapeHtml(analyzedAt)}</div>
        <div>File: ${escapeHtml(result.fileName || 'Resume Document')}</div>
      </div>
    </div>

    <!-- 1. Candidate Overview & 2. Role Summary -->
    <div class="card grid-2">
      <div>
        <div class="section-label">1. Candidate Overview</div>
        <div class="candidate-name">${escapeHtml(candidateName)}</div>
        <div class="info-row">
          <span class="info-label">Location:</span>
          ${result.candidateOverview?.detectedLocation ? `<span class="location-tag">${escapeHtml(result.candidateOverview.detectedLocation)}</span>` : '<span style="color:#94a3b8;font-style:italic">Not detected in resume</span>'}
        </div>
        <div class="info-row">
          <span class="info-label">Recent Role:</span>
          <span>${escapeHtml(result.candidateOverview?.currentOrRecentRole || 'Not specified')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Experience:</span>
          <span>${escapeHtml(result.candidateOverview?.experienceSummary || 'Not determinable from explicit dates')}</span>
        </div>
        ${skillsHtml ? `<div style="margin-top:8px"><div class="info-label" style="margin-bottom:4px">Key Skills Detected:</div>${skillsHtml}</div>` : ''}
        ${educationHtml ? `<div style="margin-top:8px"><div class="info-label" style="margin-bottom:2px">Education:</div><ul style="margin:0;padding-left:18px;font-size:9pt">${educationHtml}</ul></div>` : ''}
        ${certsHtml ? `<div style="margin-top:6px"><div class="info-label" style="margin-bottom:2px">Certifications:</div><ul style="margin:0;padding-left:18px;font-size:9pt">${certsHtml}</ul></div>` : ''}
      </div>

      <div style="border-left: 1px solid #f1f5f9; padding-left: 18px;">
        <div class="section-label">2. Role Summary</div>
        <div style="font-size:13pt;font-weight:700;color:#0f172a;margin-bottom:4px">${escapeHtml(roleTitle)}</div>
        <div class="info-row"><span class="info-label">Department:</span> ${escapeHtml(department)}</div>
        <div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;font-size:9pt;color:#334155;line-height:1.45">
          <div style="font-weight:600;color:#1e293b;margin-bottom:4px">Role Requirements Summary:</div>
          <div>${escapeHtml(result.roleSummary?.extractedSummary || '')}</div>
        </div>
      </div>
    </div>

    <!-- 3. Overall Role Alignment -->
    <div class="card avoid-break" style="padding:14px 18px">
      <div class="section-label">3. Overall Role Alignment</div>
      <div class="alignment-box">
        <div class="alignment-level">${escapeHtml(result.overallRoleAlignment?.level || 'Moderate alignment')}</div>
        <div style="font-size:9.5pt;color:#334155;line-height:1.45">${escapeHtml(result.overallRoleAlignment?.summary || '')}</div>
      </div>
    </div>

    <!-- 4. Requirement Match Analysis -->
    <div class="card table-card">
      <div class="section-label">4. Requirement Match Analysis</div>
      <table>
        <thead>
          <tr>
            <th>Role Requirement</th>
            <th>Status</th>
            <th>Resume Evidence Citation</th>
          </tr>
        </thead>
        <tbody>
          ${matchesHtml || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">No requirements recorded</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 5. Relevant Strengths & 6. Potential Gaps -->
    <div class="card grid-2 avoid-break">
      <div>
        <div class="section-label">5. Relevant Strengths</div>
        <div style="font-size:9pt;color:#64748b;margin-bottom:6px">Supported by explicit resume evidence</div>
        <ul class="check-list">
          ${strengthsHtml || '<li style="color:#94a3b8;font-style:italic">No explicit strengths verified</li>'}
        </ul>
      </div>
      <div>
        <div class="section-label">6. Potential Gaps / Areas to Clarify</div>
        <div style="font-size:9pt;color:#64748b;margin-bottom:6px">Unverified or ambiguous criteria</div>
        <ul class="check-list">
          ${gapsHtml || '<li style="color:#94a3b8;font-style:italic">All essential requirements evidenced</li>'}
        </ul>
      </div>
    </div>

    <!-- 7. Interview Focus Areas -->
    <div class="card avoid-break">
      <div class="section-label">7. Interview Focus Areas</div>
      <div style="font-size:9pt;color:#64748b;margin-bottom:10px">Inquiries formulated to explore unverified or ambiguous requirements</div>
      ${questionsHtml || '<div style="color:#94a3b8;font-style:italic;font-size:9pt">No specific inquiries generated</div>'}
    </div>

    <!-- 8. Hiring Disclaimer & Analysis Notes -->
    <div class="disclaimer-box">
      <strong>8. Analysis Notes & Hiring Governance:</strong><br />
      This evaluation is strictly grounded in explicit textual evidence from the uploaded resume and recruiter-provided role criteria. "Not detected in resume" indicates absence of evidence in the document, not absence of capability. Final hiring evaluations remain exclusively with human recruiters and hiring teams.
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
