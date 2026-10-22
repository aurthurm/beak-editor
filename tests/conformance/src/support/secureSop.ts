/**
 * A controlled SOP used by the security suite, with a fixed set of principals.
 *
 * Sections: `purpose` (approved, so locked on the server), `scope` (required, Ann may edit and insert
 * but not delete), `procedure` (Ben edits text only; contains a nested required `safety` section that
 * only Cy may edit), `records` (optional, no grants). Uncontrolled text sits outside the sections.
 *
 * @module
 */
import type { Block } from '@amusendame/beakblock-core';

import { docBuilder } from '../corpus/builders';
import type { PrincipalGrants } from './serverStore';

export function secureSop(): Block[] {
  const b = docBuilder('sec');
  return [
    b.h(1, 'Controlled procedure', { styleId: 'Heading1' }),
    b.p('Uncontrolled introduction that anyone with document edit rights may change.'),
    b.controlledSection('purpose', 'Purpose', [b.p('Approved purpose statement.')], { workflowState: 'approved', required: true }),
    b.controlledSection('scope', 'Scope', [b.p('Scope statement.')], { required: true, workflowState: 'draft' }),
    b.controlledSection('procedure', 'Procedure', [
      b.p('Procedure text.'),
      b.controlledSection('safety', 'Safety', [b.p('Wear gloves.')], { required: true, workflowState: 'draft' }),
    ], { required: true, workflowState: 'draft' }),
    b.controlledSection('records', 'Records', [b.p('Optional records.')], { required: false, workflowState: 'draft' }),
    b.p('Uncontrolled closing remark.'),
  ];
}

/** Principals of the secure SOP. Grants live on the server; the client never sends them. */
export const PRINCIPALS: Record<string, PrincipalGrants> = {
  ann: { roles: ['author'], sectionGrants: { scope: ['section.editText', 'section.insertBlock'] } },
  ben: { roles: ['author'], sectionGrants: { procedure: ['section.editText'] } },
  cy: { roles: ['author'], sectionGrants: { safety: ['section.editText', 'section.delete'], procedure: ['section.editText'] } },
  qm: { roles: ['qualityManager'], sectionGrants: {} },
  uncontrolledEditor: { roles: ['editor'], sectionGrants: {}, defaultGrants: ['document.editUncontrolled'] },
};
