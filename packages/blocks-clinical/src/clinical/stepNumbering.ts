/**
 * Automatic numbering of `sopStep` blocks.
 *
 * Steps are numbered 1, 2, 3, ... within their parent container. Other blocks
 * between steps (for example a safety warning) do not break the sequence.
 * Numbering is written into the `stepNumber` attr and is not recorded in history.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';

/** Plugin key for the step numbering plugin. */
export const STEP_NUMBERING_PLUGIN_KEY = new PluginKey('beakblockClinicalStepNumbering');

/**
 * Builds a transaction that sets `stepNumber` on every `sopStep` whose number is
 * out of date, or returns `null` when nothing changes.
 *
 * @param state - Editor state to number
 */
export function computeStepNumberTransaction(state: EditorState): Transaction | null {
  const stepType = state.schema.nodes.sopStep;
  if (!stepType) return null;

  const changes: Array<{ pos: number; stepNumber: number }> = [];
  const visit = (parent: PMNode, contentStart: number): void => {
    let count = 0;
    parent.forEach((child, offset) => {
      const pos = contentStart + offset;
      if (child.type === stepType) {
        count += 1;
        if (child.attrs.stepNumber !== count) {
          changes.push({ pos, stepNumber: count });
        }
      }
      if (child.childCount > 0 && !child.isTextblock) {
        visit(child, pos + 1);
      }
    });
  };
  visit(state.doc, 0);

  if (changes.length === 0) return null;
  // Replaces each out-of-date step with a copy that has the new number and the same content.
  // setNodeMarkup and setNodeAttribute re-check the step's content, which throws for a step
  // with no children, so the node is replaced directly.
  const tr = state.tr;
  for (const change of changes) {
    const node = tr.doc.nodeAt(change.pos);
    if (!node) continue;
    const next = stepType.create({ ...node.attrs, stepNumber: change.stepNumber }, node.content, node.marks);
    tr.replaceWith(change.pos, change.pos + node.nodeSize, next);
  }
  tr.setMeta('addToHistory', false);
  return tr;
}

/**
 * ProseMirror plugin that keeps `sopStep.stepNumber` consecutive.
 *
 * The initial document is numbered on the microtask after the view is created,
 * because dispatching from inside a plugin view constructor is not safe.
 */
export function createStepNumberingPlugin(): Plugin {
  // Numbering is cosmetic. A failure must not break editing or view creation, so it is logged once.
  let reported = false;
  const safely = (fn: () => Transaction | null): Transaction | null => {
    try {
      return fn();
    } catch (error) {
      if (!reported) {
        reported = true;
        console.warn('BeakBlock clinical: step numbering was skipped for this document.', error);
      }
      return null;
    }
  };

  return new Plugin({
    key: STEP_NUMBERING_PLUGIN_KEY,
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      return safely(() => computeStepNumberTransaction(newState));
    },
    view(view) {
      queueMicrotask(() => {
        if (view.isDestroyed) return;
        const tr = safely(() => computeStepNumberTransaction(view.state));
        if (tr) view.dispatch(tr);
      });
      return {};
    },
  });
}
