export type ComplianceAiLogEntry = {
  at: string;
  sectionId: string;
  sectionTitle: string;
  userId: string;
  displayName: string;
  presetId?: string;
  instruction: string;
  /** First ~400 chars of model output */
  outputPreview: string;
};

const STORAGE_KEY = 'beakblock-compliance-ai-log';

export function appendComplianceAiLog(entry: ComplianceAiLogEntry): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const prev = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as ComplianceAiLogEntry[];
    prev.push(entry);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(-100)));
  } catch {
    /* ignore quota */
  }
}

export function readComplianceAiLog(): ComplianceAiLogEntry[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as ComplianceAiLogEntry[];
  } catch {
    return [];
  }
}
