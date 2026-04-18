import type { Block } from '@aurthurm/beakblock-core';
import { blocksToHtml, blocksToMarkdown } from '@aurthurm/beakblock-core';
import type { CommentThread } from '@aurthurm/beakblock-core';
import type { ComplianceMergeManifest } from './complianceMerge';
import type { SectionApprovalRecord } from './complianceApproval';
import type { DocumentReleaseRecord } from './complianceDocumentRelease';
import { sha256HexUtf8 } from './documentHash';

export type ComplianceExportBundle = {
  exportedAt: string;
  documentTitle: string;
  blocks: Block[];
  mergeManifest: ComplianceMergeManifest | null;
  commentsBySection: Record<string, CommentThread[]>;
  /** Section sign-off snapshot at export (if provided). */
  sectionApprovals?: Record<string, SectionApprovalRecord>;
  /** Document-level attestation settings and sign-offs. */
  documentRelease?: DocumentReleaseRecord;
};

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function commentIso(d: Date | string | undefined): string {
  if (d == null) return '';
  return d instanceof Date ? d.toISOString() : String(d);
}

/**
 * Appendix listing threads with resolution state and checkpoint metadata (for audit HTML).
 */
export function buildCommentsAppendixHtml(
  commentsBySection: Record<string, CommentThread[]>,
  sectionTitles: Record<string, string>
): string {
  const sectionIds = Object.keys(commentsBySection).filter((id) => (commentsBySection[id]?.length ?? 0) > 0);
  if (!sectionIds.length) return '';

  let html =
    '<section class="compliance-export-comments"><h2 id="comment-audit">Comment audit trail</h2><p class="compliance-export-comments__lede">Threads captured at export. Checkpoint ids reflect the section version saved when the thread was started.</p>';

  for (const sid of sectionIds) {
    const title = sectionTitles[sid] ?? sid;
    html += `<h3>${escapeHtml(title)}</h3><ul class="compliance-export-thread-list">`;
    for (const thread of commentsBySection[sid] ?? []) {
      if (thread.deletedAt) continue;
      const ck = thread.metadata?.raisedAgainstCheckpointId;
      const ckStr = ck != null && String(ck).length > 0 ? String(ck) : '—';
      const status = thread.resolved ? 'Resolved' : 'Open';
      html += `<li class="compliance-export-thread"><p class="compliance-export-thread__status"><strong>${escapeHtml(status)}</strong> · <span class="compliance-export-thread__id">Thread ${escapeHtml(thread.id)}</span></p>`;
      html += `<p class="compliance-export-thread__meta">Created ${escapeHtml(commentIso(thread.createdAt))} · Checkpoint <code>${escapeHtml(ckStr)}</code></p>`;
      html += '<ol class="compliance-export-thread__comments">';
      for (const c of thread.comments) {
        if (c.deletedAt) continue;
        html += `<li><span class="compliance-export-comment__author">${escapeHtml(c.authorId)}</span> <time datetime="${escapeHtml(commentIso(c.createdAt))}">${escapeHtml(commentIso(c.createdAt))}</time><div class="compliance-export-comment__body">${escapeHtml(c.body)}</div></li>`;
      }
      html += '</ol></li>';
    }
    html += '</ul>';
  }

  html += '</section>';
  return html;
}

export function buildApprovalsAppendixHtml(
  approvals: Record<string, SectionApprovalRecord>,
  sectionTitles: Record<string, string>
): string {
  const ids = Object.keys(approvals);
  if (!ids.length) return '';

  let html =
    '<section class="compliance-export-approvals"><h2 id="approval-audit">Section approvals</h2><table class="compliance-export-approvals__table"><thead><tr><th>Section</th><th>State</th><th>Submitted</th><th>Approved</th><th>Signed by</th><th>Note</th></tr></thead><tbody>';

  for (const id of ids) {
    const a = approvals[id]!;
    const title = sectionTitles[id] ?? id;
    const who =
      a.approvedByDisplayName || a.approvedByUserId ?
        `${a.approvedByDisplayName ?? ''}${a.approvedByDisplayName && a.approvedByUserId ? ' · ' : ''}${a.approvedByUserId ?? ''}`
      : '—';
    html += `<tr><td>${escapeHtml(title)}</td><td>${escapeHtml(a.state)}</td><td>${escapeHtml(a.submittedForReviewAt ?? '—')}</td><td>${escapeHtml(a.approvedAt ?? '—')}</td><td>${escapeHtml(who)}</td><td>${escapeHtml(a.approvalNote ?? '—')}</td></tr>`;
  }

  html += '</tbody></table></section>';
  return html;
}

export function buildApprovalHistoryAppendixHtml(
  sectionApprovals: Record<string, SectionApprovalRecord>,
  sectionTitles: Record<string, string>
): string {
  const ids = Object.keys(sectionApprovals).filter((id) => (sectionApprovals[id]?.history?.length ?? 0) > 0);
  if (!ids.length) return '';

  let html =
    '<section class="compliance-export-approval-history"><h2 id="approval-history">Section approval history (append-only)</h2>';

  for (const id of ids) {
    const a = sectionApprovals[id]!;
    const title = sectionTitles[id] ?? id;
    html += `<h3>${escapeHtml(title)}</h3><ol class="compliance-export-approval-history__list">`;
    for (const h of a.history ?? []) {
      const note = h.note ? ` — ${escapeHtml(h.note)}` : '';
      html += `<li><strong>${escapeHtml(h.kind)}</strong> · ${escapeHtml(h.at)} · ${escapeHtml(h.displayName)} → <em>${escapeHtml(h.state)}</em>${note}</li>`;
    }
    html += '</ol>';
  }

  html += '</section>';
  return html;
}

export function buildDocumentReleaseAppendixHtml(dr: DocumentReleaseRecord): string {
  if (!dr.signOffs.length && !dr.requireTwoApprovers) return '';

  let html = '<section class="compliance-export-doc-release"><h2 id="doc-release">Document release attestation</h2>';
  html += `<p class="compliance-export-doc-release__meta">Two distinct approvers required: <strong>${dr.requireTwoApprovers ? 'yes' : 'no'}</strong></p>`;
  if (dr.signOffs.length) {
    html += '<ol class="compliance-export-doc-release__list">';
    for (const s of dr.signOffs) {
      const note = s.note ? ` — ${escapeHtml(s.note)}` : '';
      html += `<li><strong>Round ${s.round}</strong> · ${escapeHtml(s.displayName)} (<code>${escapeHtml(s.userId)}</code>) · ${escapeHtml(s.at)}${note}</li>`;
    }
    html += '</ol>';
  } else {
    html += '<p><em>No sign-offs recorded at export.</em></p>';
  }
  html += '</section>';
  return html;
}

const COMPLIANCE_EXPORT_INLINE_CSS = `
:root { font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.55; color: #1a1a1a; }
body { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
.compliance-export-banner { margin-bottom: 1.5rem; padding: 1rem 1.1rem; border-radius: 12px; background: #f4f6fb; border: 1px solid #c9d4e8; font-size: 0.9rem; }
.compliance-export-banner code { font-size: 0.85em; word-break: break-all; }
.compliance-export-body :first-child { margin-top: 0; }
.compliance-export-comments { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; }
.compliance-export-comments__lede { font-size: 0.88rem; color: #475569; }
.compliance-export-thread-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.25rem; }
.compliance-export-thread { border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.9rem 1rem; background: #fafafa; }
.compliance-export-thread__meta { font-size: 0.82rem; color: #64748b; margin: 0.35rem 0 0.5rem; }
.compliance-export-thread__comments { margin: 0.5rem 0 0; padding-left: 1.1rem; font-size: 0.9rem; }
.compliance-export-comment__author { font-weight: 600; margin-right: 0.35rem; }
.compliance-export-comment__body { margin: 0.25rem 0 0; white-space: pre-wrap; }
.compliance-export-approvals { margin-top: 2rem; padding-top: 1.25rem; border-top: 2px solid #e2e8f0; }
.compliance-export-approvals__table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.compliance-export-approvals__table th, .compliance-export-approvals__table td { border: 1px solid #e2e8f0; padding: 0.45rem 0.55rem; text-align: left; vertical-align: top; }
.compliance-export-approvals__table th { background: #f1f5f9; }
.compliance-export-approval-history { margin-top: 2rem; padding-top: 1.25rem; border-top: 2px solid #e2e8f0; font-size: 0.88rem; }
.compliance-export-approval-history__list { margin: 0.5rem 0 0; padding-left: 1.2rem; }
.compliance-export-doc-release { margin-top: 2rem; padding-top: 1.25rem; border-top: 2px solid #e2e8f0; font-size: 0.9rem; }
.compliance-export-doc-release__meta { color: #475569; }
.compliance-export-doc-release__list { margin: 0.5rem 0 0; padding-left: 1.2rem; }
@media print {
  body { max-width: none; }
  .compliance-export-banner { break-inside: avoid; }
}
`.trim();

export function buildComplianceHtmlDocument(options: {
  documentTitle: string;
  bodyHtml: string;
  exportedAt: string;
  checksum: string;
  documentReleaseAppendixHtml?: string;
  approvalsAppendixHtml?: string;
  approvalHistoryAppendixHtml?: string;
  commentsAppendixHtml?: string;
}): string {
  const appendix = [
    options.documentReleaseAppendixHtml,
    options.approvalsAppendixHtml,
    options.approvalHistoryAppendixHtml,
    options.commentsAppendixHtml,
  ]
    .filter(Boolean)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.documentTitle)}</title>
<meta name="compliance-export-checksum" content="${escapeHtml(options.checksum)}">
<meta name="compliance-exported-at" content="${escapeHtml(options.exportedAt)}">
<style>${COMPLIANCE_EXPORT_INLINE_CSS}</style>
</head>
<body>
<header class="compliance-export-banner">
  <p><strong>Controlled export</strong> — SHA-256 of JSON bundle: <code>${escapeHtml(options.checksum)}</code></p>
  <p>Exported <time datetime="${escapeHtml(options.exportedAt)}">${escapeHtml(options.exportedAt)}</time></p>
</header>
<main class="compliance-export-body">
${options.bodyHtml}
</main>
${appendix || ''}
</body>
</html>`;
}

/**
 * Computes `checksum` over `JSON.stringify(bundle, null, 2)` (UTF-8), **before** adding `exportChecksum` to the downloaded JSON.
 * Re-verify with `POST /api/compliance-checksum` and body `{ bundle }` (Nuxt demo) or `{ raw }` for a byte-identical file string.
 */
export async function buildComplianceExportPayload(options: {
  documentTitle: string;
  blocks: Block[];
  mergeManifest: ComplianceMergeManifest | null;
  commentsBySection: Record<string, CommentThread[]>;
  sectionApprovals?: Record<string, SectionApprovalRecord>;
  documentRelease?: DocumentReleaseRecord;
}): Promise<{ bundle: ComplianceExportBundle; checksum: string }> {
  const bundle: ComplianceExportBundle = {
    exportedAt: new Date().toISOString(),
    documentTitle: options.documentTitle,
    blocks: options.blocks,
    mergeManifest: options.mergeManifest,
    commentsBySection: options.commentsBySection,
    ...(options.sectionApprovals && Object.keys(options.sectionApprovals).length > 0 ?
      { sectionApprovals: options.sectionApprovals }
    : {}),
    ...(options.documentRelease ? { documentRelease: options.documentRelease } : {}),
  };
  const json = JSON.stringify(bundle, null, 2);
  const checksum = await sha256HexUtf8(json);
  return { bundle, checksum };
}

export type DownloadComplianceExportsOptions = {
  documentTitle: string;
  blocks: Block[];
  mergeManifest: ComplianceMergeManifest | null;
  commentsBySection: Record<string, CommentThread[]>;
  /** Human-readable section titles for the HTML comment appendix. */
  sectionTitles?: Record<string, string>;
  sectionApprovals?: Record<string, SectionApprovalRecord>;
  documentRelease?: DocumentReleaseRecord;
};

/** Download JSON bundle + Markdown + standalone HTML (browser only). */
export async function downloadComplianceExports(options: DownloadComplianceExportsOptions): Promise<{ checksum: string }> {
  const { bundle, checksum } = await buildComplianceExportPayload({
    documentTitle: options.documentTitle,
    blocks: options.blocks,
    mergeManifest: options.mergeManifest,
    commentsBySection: options.commentsBySection,
    sectionApprovals: options.sectionApprovals,
    documentRelease: options.documentRelease,
  });
  const json = JSON.stringify({ ...bundle, exportChecksum: checksum }, null, 2);
  const safeName = options.documentTitle.replace(/[^\w.-]+/g, '_').slice(0, 48);

  downloadBlob(`compliance-export-${safeName}.json`, new Blob([json], { type: 'application/json' }));

  const md = blocksToMarkdown(options.blocks);
  const mdBody = `---\ntitle: ${options.documentTitle}\nexportedAt: ${bundle.exportedAt}\ncontentChecksum: ${checksum}\n---\n\n${md}`;
  downloadBlob(`compliance-export-${safeName}.md`, new Blob([mdBody], { type: 'text/markdown' }));

  const bodyHtml = blocksToHtml(options.blocks);
  const titles = options.sectionTitles ?? {};
  const appendix = buildCommentsAppendixHtml(options.commentsBySection, titles);
  const approvals = options.sectionApprovals ?? {};
  const approvalsAppendix =
    Object.keys(approvals).length > 0 ? buildApprovalsAppendixHtml(approvals, titles) : '';
  const approvalHistoryAppendix =
    Object.keys(approvals).some((id) => (approvals[id]?.history?.length ?? 0) > 0) ?
      buildApprovalHistoryAppendixHtml(approvals, titles)
    : '';
  const documentReleaseAppendix =
    options.documentRelease &&
    (options.documentRelease.signOffs.length > 0 || options.documentRelease.requireTwoApprovers) ?
      buildDocumentReleaseAppendixHtml(options.documentRelease)
    : '';
  const htmlDoc = buildComplianceHtmlDocument({
    documentTitle: options.documentTitle,
    bodyHtml,
    exportedAt: bundle.exportedAt,
    checksum,
    documentReleaseAppendixHtml: documentReleaseAppendix || undefined,
    approvalsAppendixHtml: approvalsAppendix || undefined,
    approvalHistoryAppendixHtml: approvalHistoryAppendix || undefined,
    commentsAppendixHtml: appendix || undefined,
  });
  downloadBlob(`compliance-export-${safeName}.html`, new Blob([htmlDoc], { type: 'text/html;charset=utf-8' }));

  return { checksum };
}
