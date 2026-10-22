/**
 * Keeps `formCalculated` values in step with the fields they reference.
 *
 * The plugin writes each calculated result into the node's `value` attr, so the
 * displayed value and the serialised document agree.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { FORM_FIELD_TYPES } from './nodes';
import { safeEvaluate } from './validation';

/** Plugin key for the calculation plugin. */
export const FORM_CALCULATION_PLUGIN_KEY = new PluginKey('beakblockFormCalculation');

/**
 * Builds a transaction that updates calculated `value` attrs, or returns `null`
 * when nothing changes.
 *
 * @param state - Editor state
 * @param defaultDecimals - Decimal places used when a field does not set `decimals`
 */
export function calculationTransaction(state: EditorState, defaultDecimals = 2): Transaction | null {
  const calcType = state.schema.nodes.formCalculated;
  if (!calcType) return null;

  const values: Record<string, unknown> = {};
  const calcs: Array<{ pos: number; node: PMNode }> = [];
  state.doc.descendants((node, pos) => {
    if (node.type === calcType) {
      calcs.push({ pos, node });
    } else if (FORM_FIELD_TYPES.has(node.type.name) && typeof node.attrs.name === 'string' && node.attrs.name !== '') {
      values[node.attrs.name] = node.attrs.value ?? null;
    }
    return true;
  });
  if (calcs.length === 0) return null;

  const results: Array<number | null> = calcs.map(() => null);
  for (let pass = 0; pass <= calcs.length; pass++) {
    let changed = false;
    calcs.forEach(({ node }, index) => {
      const name = node.attrs.name;
      const result = safeEvaluate(node.attrs.expression, values, node.attrs.decimals ?? defaultDecimals);
      if (results[index] !== result) {
        results[index] = result;
        changed = true;
      }
      if (typeof name === 'string' && name !== '') values[name] = result;
    });
    if (!changed) break;
  }

  const tr = state.tr;
  let dirty = false;
  calcs.forEach(({ pos, node }, index) => {
    const next = results[index] ?? null;
    if (node.attrs.value !== next) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, value: next });
      dirty = true;
    }
  });
  if (!dirty) return null;
  tr.setMeta('addToHistory', false);
  return tr;
}

/**
 * ProseMirror plugin that recomputes `formCalculated` values after each document change.
 *
 * @param defaultDecimals - Decimal places when a field does not set `decimals`
 */
export function createFormCalculationPlugin(defaultDecimals = 2): Plugin {
  // A failed recalculation must not break editing or view creation, so it is logged once.
  let reported = false;
  const safely = (fn: () => Transaction | null): Transaction | null => {
    try {
      return fn();
    } catch (error) {
      if (!reported) {
        reported = true;
        console.warn('BeakBlock forms: calculated fields were not updated.', error);
      }
      return null;
    }
  };

  return new Plugin({
    key: FORM_CALCULATION_PLUGIN_KEY,
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      return safely(() => calculationTransaction(newState, defaultDecimals));
    },
    view(view) {
      // Initial values are computed after the view exists; see stepNumbering.ts.
      queueMicrotask(() => {
        if (view.isDestroyed) return;
        const tr = safely(() => calculationTransaction(view.state, defaultDecimals));
        if (tr) view.dispatch(tr);
      });
      return {};
    },
  });
}
