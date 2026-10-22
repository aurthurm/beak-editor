/**
 * @module
 */

import { describe, expect, it } from 'vitest';

import { createPolicyEngine, allDecisionsAllowed } from './engine';
import type { PolicyContext, TypedOperation } from './types';

const ctx = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  userId: 'u1',
  roles: ['author'],
  sectionGrants: {},
  ...overrides,
});

const op = (overrides: Partial<TypedOperation>): TypedOperation => ({
  kind: 'replaceText',
  sectionId: 'S1',
  ...overrides,
});

describe('createPolicyEngine', () => {
  const engine = createPolicyEngine();

  it('allows an operation when the required capability is granted to the section', () => {
    const [d] = engine.decide([op({ kind: 'replaceText' })], ctx({ sectionGrants: { S1: ['section.editText'] } }));
    expect(d?.allowed).toBe(true);
  });

  it('denies with the missing capability when the grant is absent', () => {
    const [d] = engine.decide([op({ kind: 'renameSection' })], ctx({ sectionGrants: { S1: ['section.editText'] } }));
    expect(d?.allowed).toBe(false);
    expect(d?.requiredCapability).toBe('section.rename');
    expect(d?.reason).toContain('section.rename');
  });

  it('denies every operation in a locked section, even with grants and defaultGrants', () => {
    const c = ctx({
      sectionGrants: { S1: ['section.editText'] },
      defaultGrants: ['section.editText', 'document.editUncontrolled'],
      lockedSections: ['S1'],
    });
    const decisions = engine.decide([op({ kind: 'replaceText' }), op({ kind: 'formatText' })], c);
    expect(decisions.every((d) => !d.allowed)).toBe(true);
    expect(decisions[0]?.reason).toContain('locked');
  });

  it('honours defaultGrants for controlled sections', () => {
    const [d] = engine.decide([op({ kind: 'insertBlock' })], ctx({ defaultGrants: ['section.insertBlock'] }));
    expect(d?.allowed).toBe(true);
  });

  it('requires document.editUncontrolled for uncontrolled content', () => {
    const denied = engine.decide([op({ sectionId: null, kind: 'replaceText' })], ctx());
    expect(denied[0]?.allowed).toBe(false);
    expect(denied[0]?.requiredCapability).toBe('document.editUncontrolled');

    const allowed = engine.decide(
      [op({ sectionId: null, kind: 'replaceText' })],
      ctx({ defaultGrants: ['document.editUncontrolled'] })
    );
    expect(allowed[0]?.allowed).toBe(true);
  });

  it('requires both the operation capability and an out-of-section move capability for moves out', () => {
    const out = op({ kind: 'moveBlock', details: { direction: 'out' } });
    const onlyMove = engine.decide([out], ctx({ sectionGrants: { S1: ['section.move'] } }));
    expect(onlyMove[0]?.allowed).toBe(false);
    expect(onlyMove[0]?.requiredCapability).toBe('section.moveContentOut');

    const both = engine.decide([out], ctx({ sectionGrants: { S1: ['section.move', 'section.moveContentOut'] } }));
    expect(both[0]?.allowed).toBe(true);
  });

  it('always denies deleting a required section, unless the principal is system', () => {
    const del = op({ kind: 'deleteSection', details: { required: true } });
    const grants = { S1: ['section.delete' as const] };
    expect(engine.decide([del], ctx({ sectionGrants: grants }))[0]?.allowed).toBe(false);
    expect(engine.decide([del], ctx({ sectionGrants: grants, roles: ['system'] }))[0]?.allowed).toBe(true);
  });

  it('denies protected attributes unless the principal is system', () => {
    const attr = op({ kind: 'editAttrs', details: { attr: 'workflowState', protected: true } });
    const c = ctx({ sectionGrants: { S1: ['section.editText'] } });
    expect(engine.decide([attr], c)[0]?.allowed).toBe(false);
    expect(engine.decide([attr], { ...c, roles: ['system'] })[0]?.allowed).toBe(true);
  });

  it('denies invalid structures and unknown operation kinds', () => {
    const c = ctx({ defaultGrants: ['document.editUncontrolled', 'section.editText'] });
    expect(engine.decide([op({ kind: 'editAttrs', details: { invalid: true } })], c)[0]?.allowed).toBe(false);
    expect(engine.decide([{ kind: 'nope' as never, sectionId: 'S1' }], c)[0]?.allowed).toBe(false);
  });

  it('runs custom rules after the built-in checks and before grants', () => {
    const custom = createPolicyEngine({
      rules: [
        (o) => (o.kind === 'deleteBlock' ? { allowed: false, reason: 'deletes are frozen' } : undefined),
        (o) => (o.kind === 'formatText' ? { allowed: true } : undefined),
      ],
    });
    const c = ctx();
    const [del, fmt, text] = custom.decide(
      [op({ kind: 'deleteBlock' }), op({ kind: 'formatText' }), op({ kind: 'replaceText' })],
      c
    );
    expect(del?.reason).toBe('deletes are frozen');
    expect(fmt?.allowed).toBe(true);
    expect(text?.allowed).toBe(false);

    const lockRule = createPolicyEngine({ rules: [() => ({ allowed: true })] });
    const locked = lockRule.decide([op({})], ctx({ lockedSections: ['S1'] }));
    expect(locked[0]?.allowed).toBe(false);
  });

  it('allDecisionsAllowed is true for an empty list', () => {
    expect(allDecisionsAllowed([])).toBe(true);
  });
});
