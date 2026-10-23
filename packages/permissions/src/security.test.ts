/**
 * Security scenarios from the roadmap (sections 5K and 8): forged operations, atomic
 * cross-section changes, and nested sections. These run against the server-side verifier,
 * which never trusts client-declared operations.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';

import { verifyDocumentChange } from './verify';
import type { Block, InlineContent } from '@amusendame/beakblock-core';
import type { PolicyContext } from './types';

const text = (id: string, value: string): Block => ({
  id,
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text: value, styles: {} }],
});

const section = (
  id: string,
  sectionId: string,
  children: Block[],
  props: Record<string, unknown> = {}
): Block => ({
  id,
  type: 'controlledSection',
  props: { sectionId, title: `Title ${sectionId}`, required: false, ...props },
  children,
});

const editor: PolicyContext = {
  userId: 'author',
  roles: ['author'],
  sectionGrants: {
    S1: ['section.editText', 'section.insertBlock', 'section.deleteBlock', 'section.delete', 'section.move', 'section.moveContentOut'],
    S2: ['section.editText', 'section.insertBlock', 'section.deleteBlock'],
  },
};

const baseDoc = (): Block[] => [
  section('s1', 'S1', [text('p1', 'alpha'), text('p0', 'keep')]),
  section('s2', 'S2', [text('p2', 'beta')]),
];

describe('server-side verification: forged operations', () => {
  it('rejects an edit to a locked section even when the client bypassed the guard', () => {
    const before = baseDoc();
    const after = baseDoc();
    (after[1] as Block).children![0] = text('p2', 'forged');
    const result = verifyDocumentChange(before, after, { ...editor, lockedSections: ['S2'] });
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.sectionId === 'S2' && /locked/.test(v.reason ?? ''))).toBe(true);
  });

  it('allows an edit inside a section the author is granted', () => {
    const before = baseDoc();
    const after = baseDoc();
    (after[0] as Block).children![0] = text('p1', 'alpha edited');
    const result = verifyDocumentChange(before, after, editor);
    expect(result.allowed).toBe(true);
    expect(result.operations).toEqual([expect.objectContaining({ kind: 'replaceText', sectionId: 'S1', blockId: 'p1' })]);
  });

  it('denies renaming a section without section.rename', () => {
    const before = baseDoc();
    const after = baseDoc();
    (after[0] as Block).props.title = 'Hacked title';
    const result = verifyDocumentChange(before, after, editor);
    expect(result.allowed).toBe(false);
    expect(result.violations[0]).toMatchObject({ operation: expect.objectContaining({ kind: 'renameSection' }), requiredCapability: 'section.rename' });

    const renamer = { ...editor, sectionGrants: { ...editor.sectionGrants, S1: [...editor.sectionGrants.S1!, 'section.rename' as const] } };
    expect(verifyDocumentChange(before, after, renamer).allowed).toBe(true);
  });

  it('denies deleting a required section even with section.delete', () => {
    const before = [section('s1', 'S1', [text('p1', 'a')], { required: true })];
    const result = verifyDocumentChange(before, [], editor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.kind === 'deleteSection' && /required/.test(v.reason ?? ''))).toBe(true);
    expect(verifyDocumentChange(before, [], { ...editor, roles: ['system'] }).allowed).toBe(true);
  });

  it('denies a cross-section drag atomically when the target section denies insertion', () => {
    const before = baseDoc();
    const after: Block[] = [
      section('s1', 'S1', [text('p0', 'keep')]),
      section('s2', 'S2', [text('p1', 'alpha'), text('p2', 'beta')]),
    ];
    const restricted: PolicyContext = {
      ...editor,
      sectionGrants: { ...editor.sectionGrants, S2: ['section.editText'] },
    };
    const result = verifyDocumentChange(before, after, restricted);
    expect(result.allowed).toBe(false);
    expect(result.violations.every((v) => v.operation.sectionId === 'S2')).toBe(true);

    const movable: PolicyContext = {
      ...editor,
      sectionGrants: { ...editor.sectionGrants, S2: [...editor.sectionGrants.S2!, 'section.move' as const] },
    };
    const allowed = verifyDocumentChange(before, after, movable);
    expect(allowed.allowed).toBe(true);
    expect(allowed.operations.filter((o) => o.kind === 'moveBlock').map((o) => o.details?.direction).sort()).toEqual(['in', 'out']);
  });
});

describe('server-side verification: nested sections', () => {
  const nestedBefore = (): Block[] => [
    section('s1', 'S1', [text('p1', 'alpha'), section('s2', 'S2', [text('p2', 'beta')], { required: true })]),
  ];

  it('denies deleting a parent whose nested child is locked', () => {
    const result = verifyDocumentChange(nestedBefore(), [], { ...editor, lockedSections: ['S2'] });
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.sectionId === 'S2')).toBe(true);
  });

  it('denies deleting a parent whose nested child is required', () => {
    const result = verifyDocumentChange(nestedBefore(), [], editor);
    expect(result.allowed).toBe(false);
    const nested = result.violations.find((v) => v.operation.sectionId === 'S2' && v.operation.kind === 'deleteSection');
    expect(nested?.reason).toMatch(/required/);
  });

  it('denies moving a locked nested section out of its parent', () => {
    const before = nestedBefore();
    const after: Block[] = [
      section('s1', 'S1', [text('p1', 'alpha')]),
      section('s2', 'S2', [text('p2', 'beta')], { required: false }),
    ];
    const result = verifyDocumentChange(before, after, { ...editor, lockedSections: ['S2'] });
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.kind === 'moveSection' && v.operation.sectionId === 'S2')).toBe(true);
  });

  it('denies moving a nested section that the actor has no move rights on', () => {
    const before = nestedBefore();
    const after: Block[] = [
      section('s1', 'S1', [text('p1', 'alpha')]),
      section('s2', 'S2', [text('p2', 'beta')]),
    ];
    const grants: PolicyContext = {
      ...editor,
      sectionGrants: { S1: editor.sectionGrants.S1!, S2: ['section.editText'] },
    };
    const result = verifyDocumentChange(before, after, { ...grants, roles: ['author'] });
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.kind === 'moveSection' && v.operation.sectionId === 'S2')).toBe(true);
  });
});

describe('server-side verification: service-owned nodes', () => {
  const signed = (id: string): Block => ({
    id,
    type: 'signatureBlock',
    props: {
      role: 'Approver',
      signerName: 'K. Phiri',
      signedAt: '2026-05-06T14:12:00.000Z',
      meaning: 'approved',
      contentHash: 'sha256:abc',
      signatureId: 'sig-9',
    },
  });

  const revisionEntry = (id: string, value: string): Block => ({
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: value, styles: {} }],
  });

  /** Two sections: S1 holds a signed block, S2 is the author's section. */
  const signedDoc = (): Block[] => [
    section('s1', 'S1', [text('p1', 'alpha'), signed('sig1')]),
    section('s2', 'S2', [text('p2', 'beta')]),
  ];

  const uncontrolledEditor: PolicyContext = { ...editor, defaultGrants: ['document.editUncontrolled'] };
  const systemCtx: PolicyContext = { userId: 'signature-service', roles: ['system'], sectionGrants: {} };

  it('allows an unchanged signed block', () => {
    const result = verifyDocumentChange(signedDoc(), signedDoc(), editor);
    expect(result.allowed).toBe(true);
    expect(result.operations).toEqual([]);
  });

  it('denies forging signedAt, signerName and contentHash on an existing signature block', () => {
    const before = signedDoc();
    const after = signedDoc();
    Object.assign((after[0] as Block).children![1]!.props, {
      signerName: 'Forger',
      signedAt: '2026-01-01T00:00:00.000Z',
      contentHash: 'sha256:forged',
    });
    const result = verifyDocumentChange(before, after, editor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'sig1' && /system/.test(v.reason ?? ''))).toBe(true);
  });

  it('denies inserting a pre-signed signature block', () => {
    const before = signedDoc();
    const after = signedDoc();
    (after[1] as Block).children!.push(signed('sig-new'));
    const result = verifyDocumentChange(before, after, editor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'sig-new' && v.operation.kind === 'insertBlock')).toBe(true);
  });

  it('denies deleting a signature block', () => {
    const before = signedDoc();
    const after = signedDoc();
    (after[0] as Block).children = [text('p1', 'alpha')];
    const result = verifyDocumentChange(before, after, editor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'sig1' && v.operation.kind === 'deleteBlock')).toBe(true);
  });

  it('denies a forged signature block in uncontrolled content, even with editUncontrolled', () => {
    const before: Block[] = [text('p0', 'intro'), signed('sig-top')];
    const after: Block[] = [text('p0', 'intro'), { ...signed('sig-top'), props: { ...signed('sig-top').props, signerName: 'Forger' } }];
    const result = verifyDocumentChange(before, after, uncontrolledEditor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'sig-top')).toBe(true);
  });

  it('denies a pre-signed signature block inside a newly inserted nested section', () => {
    const before = signedDoc();
    const after = signedDoc();
    (after[1] as Block).children!.push(section('s3', 'S3', [signed('sig-nested')]));
    const result = verifyDocumentChange(before, after, { ...editor, sectionGrants: { ...editor.sectionGrants, S3: ['section.insertBlock'] } });
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'sig-nested')).toBe(true);
  });

  it('denies forged entries in a revision history', () => {
    const history = (entryText: string): Block => ({
      id: 'rev-hist',
      type: 'revisionHistory',
      props: {},
      children: [revisionEntry('rev-1', entryText)],
    });
    const before: Block[] = [history('Initial issue'), text('p0', 'body')];
    const after: Block[] = [history('Rewritten history'), text('p0', 'body')];
    const result = verifyDocumentChange(before, after, uncontrolledEditor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'rev-1' || v.operation.blockId === 'rev-hist')).toBe(true);
  });

  it('denies a forged document identifier inside a paragraph', () => {
    const withId = (value: string): Block[] => [
      {
        id: 'p-id',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'SOP ', styles: {} },
          // Extension inline node, not registered in core's CustomInlineContentRegistry.
          { type: 'documentIdentifier', props: { id: 'docid-1', fallback: value } } as unknown as InlineContent,
        ],
      },
    ];
    const result = verifyDocumentChange(withId('SOP-1 r1'), withId('SOP-1 r9'), uncontrolledEditor);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.operation.blockId === 'p-id')).toBe(true);
  });

  it('still allows ordinary text edits next to a signature block', () => {
    const before = signedDoc();
    const after = signedDoc();
    (after[0] as Block).children![0] = text('p1', 'alpha, revised');
    expect(verifyDocumentChange(before, after, editor).allowed).toBe(true);
  });

  it('allows the system role to create, change and delete service-owned nodes', () => {
    const before = signedDoc();
    const after = signedDoc();
    Object.assign((after[0] as Block).children![1]!.props, { signerName: 'Signature service' });
    (after[1] as Block).children!.push(signed('sig-new'));
    expect(verifyDocumentChange(before, after, systemCtx).allowed).toBe(true);

    const removed = signedDoc();
    (removed[0] as Block).children = [text('p1', 'alpha')];
    expect(verifyDocumentChange(signedDoc(), removed, systemCtx).allowed).toBe(true);
  });

  it('honours a custom list of service-owned types', () => {
    const before = signedDoc();
    const after = signedDoc();
    Object.assign((after[0] as Block).children![1]!.props, { signerName: 'Forger' });
    const lenient = verifyDocumentChange(before, after, editor, undefined, { serviceOwnedTypes: ['approvalBlock'] });
    expect(lenient.allowed).toBe(true);
    const strict = verifyDocumentChange(before, after, editor, undefined, { serviceOwnedTypes: ['signatureBlock'] });
    expect(strict.allowed).toBe(false);
  });
});
