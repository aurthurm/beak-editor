/**
 * Resolves where an AI command reads from and writes to: the controlled section (if any), the
 * block blocks passed as context, and the exact document range of a proposal.
 *
 * @module
 */

import type { Node as PMNode, ResolvedPos } from 'prosemirror-model';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import { nodeToBlock } from '@amusendame/beakblock-core';
import { CONTROLLED_SECTION_NODE, sectionIdOfNode } from '@amusendame/beakblock-permissions';
import type { TypedOperation } from '@amusendame/beakblock-permissions';

import { AICommandError } from './types';

/** A controlled section found in the document. */
export interface SectionRef {
  pos: number;
  node: PMNode;
  sectionId: string;
}

/** Where a command's proposal would land, and what it operates on. */
export interface AITarget {
  sectionId: string | null;
  /** Document operation the proposal performs, or null for read-only commands. */
  operation: 'replaceText' | 'insertBlock' | null;
  from: number;
  to: number;
  /** Text expected at [from, to) when the target is a text replacement. */
  expectedText?: string;
}

/** The nearest controlled section around a resolved position. */
export function findSectionAt($pos: ResolvedPos): SectionRef | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === CONTROLLED_SECTION_NODE) {
      return { pos: $pos.before(depth), node, sectionId: sectionIdOfNode(node) };
    }
  }
  return null;
}

/** A controlled section by its `sectionId` attribute. */
export function findSectionById(doc: PMNode, sectionId: string): SectionRef | null {
  let found: SectionRef | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === CONTROLLED_SECTION_NODE && sectionIdOfNode(node) === sectionId) {
      found = { pos, node, sectionId };
      return false;
    }
    return true;
  });
  return found;
}

/** The blocks directly inside a section. */
export function sectionBlocks(section: SectionRef): Block[] {
  const out: Block[] = [];
  section.node.forEach((child) => out.push(nodeToBlock(child)));
  return out;
}

/** Resolves the section a command is scoped to: the explicit id, else the section at the cursor. */
export function resolveSection(editor: BeakBlockEditor, sectionId: string | undefined): SectionRef | null {
  if (sectionId) {
    const section = findSectionById(editor.pm.state.doc, sectionId);
    if (!section) throw new AICommandError('invalid-target', `Section "${sectionId}" was not found`);
    return section;
  }
  return findSectionAt(editor.pm.state.selection.$from);
}

/**
 * Resolves an insertion point for block output.
 *
 * - Inside the scoped section: after the cursor block when the cursor is in that section, otherwise
 *   at the end of the section.
 * - Uncontrolled content: after the cursor's top-level block, or at the end of the document.
 */
export function resolveInsertion(
  editor: BeakBlockEditor,
  sectionId: string | undefined,
  placement: 'cursor' | 'end'
): { pos: number; section: SectionRef | null } {
  const { doc, selection } = editor.pm.state;
  const section = resolveSection(editor, sectionId);
  const cursorSection = findSectionAt(selection.$from);
  const cursorInSection = section !== null && cursorSection?.sectionId === section.sectionId;

  if (section) {
    const sectionEnd = section.pos + section.node.nodeSize - 1;
    if (placement === 'cursor' && cursorInSection) {
      return { pos: afterCursorBlock(selection.$from, section.node, section.pos, sectionEnd), section };
    }
    return { pos: sectionEnd, section };
  }

  if (placement === 'cursor') {
    const $from = selection.$from;
    return { pos: $from.depth >= 1 ? $from.after(1) : doc.content.size, section: null };
  }
  return { pos: doc.content.size, section: null };
}

/** Position after the block that contains the cursor, within the given section. */
function afterCursorBlock($from: ResolvedPos, node: PMNode, sectionPos: number, sectionEnd: number): number {
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth) === node || $from.before(depth) === sectionPos) {
      const childDepth = depth + 1;
      return $from.depth >= childDepth ? $from.after(childDepth) : sectionEnd;
    }
  }
  return sectionEnd;
}

/** Whether two resolved targets describe the same operation on the same range. */
export function sameTarget(a: AITarget, b: AITarget): boolean {
  return (
    a.sectionId === b.sectionId &&
    a.operation === b.operation &&
    a.from === b.from &&
    a.to === b.to &&
    a.expectedText === b.expectedText
  );
}

/** The typed operation the policy engine should decide for a target. */
export function targetOperation(target: AITarget): TypedOperation | null {
  if (!target.operation) return null;
  return {
    kind: target.operation,
    sectionId: target.sectionId,
    from: target.from,
    to: target.to,
    details: {},
  };
}
