/**
 * Test helpers: a schema with core nodes plus the revision marks and `controlledSection`, and
 * utilities for locating text in documents and creating editor views.
 *
 * @module
 */

import { Schema, type Node as PMNode, type NodeSpec } from 'prosemirror-model';
import { EditorState, type Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { DEFAULT_MARKS, DEFAULT_NODES, blocksToDoc, type Block } from '@amusendame/beakblock-core';

import { deletionMarkSpec, insertionMarkSpec } from '../marks';

const controlledSectionSpec: NodeSpec = {
  content: 'block+',
  group: 'block',
  attrs: { id: { default: null }, sectionId: { default: null } },
  toDOM: () => ['section', 0],
};

/** Test schema: core nodes, `controlledSection`, and the `insertion`/`deletion` marks. */
export const testSchema = new Schema({
  nodes: { ...DEFAULT_NODES, controlledSection: controlledSectionSpec },
  marks: { ...DEFAULT_MARKS, insertion: insertionMarkSpec, deletion: deletionMarkSpec },
});

/** Builds a document from block JSON. */
export function docFrom(blocks: Block[]): PMNode {
  return blocksToDoc(testSchema, blocks);
}

/** A paragraph block with plain text. */
export function para(id: string, text: string): Block {
  return { id, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }] };
}

/** Text positions of every character in the document, in order. */
function charMap(doc: PMNode): { chars: string; positions: number[] } {
  const chars: string[] = [];
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        chars.push(node.text[i]!);
        positions.push(pos + i);
      }
    }
  });
  return { chars: chars.join(''), positions };
}

/**
 * Finds the document range of the nth occurrence of `needle` in the document's text.
 * Throws when not found.
 */
export function rangeOf(doc: PMNode, needle: string, occurrence = 0): { from: number; to: number } {
  const { chars, positions } = charMap(doc);
  let idx = -1;
  for (let k = 0; k <= occurrence; k++) {
    idx = chars.indexOf(needle, idx + 1);
    if (idx === -1) throw new Error(`text not found: ${needle}`);
  }
  return { from: positions[idx]!, to: positions[idx + needle.length - 1]! + 1 };
}

/** Position just after the nth occurrence of `needle`. */
export function endOf(doc: PMNode, needle: string, occurrence = 0): number {
  return rangeOf(doc, needle, occurrence).to;
}

/** Mark names on the first character of `needle`. */
export function marksOn(doc: PMNode, needle: string): string[] {
  const { from } = rangeOf(doc, needle);
  return doc.nodeAt(from)?.marks.map((m) => m.type.name) ?? [];
}

/** Creates an editor view over a document with the given plugins. */
export function createView(doc: PMNode, plugins: Plugin[] = []): EditorView {
  const state = EditorState.create({ doc, schema: testSchema, plugins });
  return new EditorView(document.createElement('div'), { state });
}
