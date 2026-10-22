import { describe, expect, it } from 'vitest';
import { BlockRegistry } from '@amusendame/beakblock-core';
import type { Block } from '@amusendame/beakblock-core';

import { escapeHtml, qmsBlockDefinitions, renderQmsPrint } from './blockDefinitions';

function registry(): BlockRegistry {
  const r = new BlockRegistry();
  for (const def of qmsBlockDefinitions) r.register(def);
  return r;
}

const paragraph = (id: string): Block => ({ id, type: 'paragraph', props: {}, content: [{ type: 'text', text: 'x', styles: {} }] });

describe('QMS block definitions', () => {
  it('registers every QMS block in the qms family', () => {
    const r = registry();
    const types = r.list('qms').map((d) => d.type).sort();
    expect(types).toEqual(
      ['acknowledgement', 'approvalBlock', 'controlledNotice', 'controlledSection', 'documentIdentifier', 'revisionHistory', 'signatureBlock'].sort()
    );
  });

  it('flags a controlled section with no sectionId and a disallowed child', () => {
    const block: Block = {
      id: 's1',
      type: 'controlledSection',
      props: { sectionId: '', title: 'Scope', workflowState: 'draft', allowedBlocks: ['paragraph'] },
      children: [{ id: 'h', type: 'heading', props: { level: 1 }, content: [] }],
    };
    const codes = registry().validate([block]).map((i) => i.code);
    expect(codes).toContain('section-id-missing');
    expect(codes).toContain('disallowed-block');
  });

  it('accepts a valid section with allowed children', () => {
    const block: Block = {
      id: 's2',
      type: 'controlledSection',
      props: { sectionId: 'S1', title: 'Scope', workflowState: 'approved', allowedBlocks: null },
      children: [paragraph('p')],
    };
    expect(registry().validate([block]).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('requires signer, hash and id on a signed signature block', () => {
    const block: Block = {
      id: 'sig',
      type: 'signatureBlock',
      props: { role: 'Approver', meaning: 'approved', signedAt: '2026-01-01', signerName: null, contentHash: null, signatureId: 'x' },
    };
    const issues = registry().validate([block]);
    expect(issues.filter((i) => i.code === 'signature-incomplete').length).toBeGreaterThanOrEqual(2);
  });

  it('accepts an unsigned placeholder', () => {
    const block: Block = { id: 'sig', type: 'signatureBlock', props: { role: 'Author', meaning: 'authored', signatureId: null } };
    expect(registry().validate([block]).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('requires a copy number on controlled copies', () => {
    const block: Block = { id: 'n', type: 'controlledNotice', props: { kind: 'controlledCopy', copyNumber: null } };
    expect(registry().validate([block]).map((i) => i.code)).toContain('notice-copy-number-missing');
  });

  it('requires an acknowledgement statement', () => {
    const block: Block = { id: 'a', type: 'acknowledgement', props: { statement: '  ', required: true } };
    expect(registry().validate([block]).map((i) => i.code)).toContain('acknowledgement-statement-missing');
  });

  it('renders escaped print HTML and never passes data through as markup', () => {
    const html = renderQmsPrint({
      id: 'sig',
      type: 'signatureBlock',
      props: { role: '<img src=x>', meaning: 'approved', signerName: 'A & B', signedAt: '2026', signatureId: 's', contentHash: 'h' },
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('A &amp; B');
  });

  it('renders controlled notices and revision history for print', () => {
    expect(renderQmsPrint({ id: 'n', type: 'controlledNotice', props: { kind: 'controlledCopy', copyNumber: 4 } })).toContain('CONTROLLED COPY No. 4');
    const rh = renderQmsPrint({ id: 'r', type: 'revisionHistory', props: { entries: [{ revision: '2', date: 'd', author: 'a', description: 'Changed' }] } });
    expect(rh).toContain('<td>Changed</td>');
  });

  it('provides lossy IR hints with the original block as source', () => {
    const def = qmsBlockDefinitions.find((d) => d.type === 'signatureBlock')!;
    const ir = def.toIR!({ id: 's', type: 'signatureBlock', props: { role: 'Reviewer', signerName: 'Ann' } }, {}) as {
      source: { blockType: string; blockId: string };
      runs: Array<{ text: string }>;
    };
    expect(ir.source.blockType).toBe('signatureBlock');
    expect(ir.source.blockId).toBe('s');
    expect(ir.runs[0]!.text).toContain('Ann');
  });

  it('escapeHtml escapes quotes and ampersands', () => {
    expect(escapeHtml(`"a" & 'b'`)).toBe('&quot;a&quot; &amp; &#39;b&#39;');
  });
});
