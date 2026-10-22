/**
 * @module
 */

import { describe, expect, it } from 'vitest';
import { validateAgainstLists } from './validation';

describe('validateAgainstLists', () => {
  it('returns nothing when no lists are configured', () => {
    expect(validateAgainstLists([{ text: 'Anything SOP-1 goes' }], {})).toEqual([]);
  });

  it('flags near-miss terminology with the approved term as suggestion', () => {
    const findings = validateAgainstLists(
      [{ blockId: 'b1', text: 'Run the Calibratoin step.' }],
      { terminology: ['Calibration'] }
    );
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'warning', origin: 'terminology', suggestion: 'Calibration', blockId: 'b1' }),
    ]);
  });

  it('does not flag approved terms or unrelated words', () => {
    const findings = validateAgainstLists(
      [{ text: 'The calibration table lists each pipette.' }],
      { terminology: ['Calibration'] }
    );
    expect(findings).toEqual([]);
  });

  it('flags references that are not approved and accepts approved ones', () => {
    const findings = validateAgainstLists(
      [{ text: 'See SOP-004 and SOP-009 for details.' }],
      { approvedReferences: ['SOP-004'] }
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ origin: 'reference', severity: 'warning' });
    expect(findings[0]!.message).toContain('SOP-009');
  });
});
