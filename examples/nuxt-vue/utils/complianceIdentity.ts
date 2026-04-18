/** Demo identity for versioning meta, track changes, and comments in the compliance sample. */
export const COMPLIANCE_DEMO_USER = {
  userId: 'demo-author-001',
  displayName: 'Jordan Demo (QC Author)',
} as const;

/** Second signer for dual document-release attestation (demo only). */
export const COMPLIANCE_SECOND_APPROVER = {
  userId: 'demo-qa-lead-002',
  displayName: 'Riley Demo (QA Lead)',
} as const;
