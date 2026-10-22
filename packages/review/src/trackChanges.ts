/**
 * Durable track changes plugin.
 *
 * While enabled, user edits are rewritten into tracked edits: inserted text gets an `insertion`
 * mark, deleted text stays in the document with a `deletion` mark, and formatting changes are
 * recorded (applied directly). Every revision is written to the revision store.
 *
 * The plugin works by comparing the document before and after a user transaction. The changed
 * range is rebuilt as a tracked edit on the old document and then swapped in.
 *
 * @module
 */

import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

import { applyTrackedChange, syncRevisionRecords, type TrackedChangeResult } from './tracked';
import type { ReviewAuthor, RevisionStore } from './types';
import {
  INSERTION_MARK,
  DELETION_MARK,
  newId,
  resolveLocation,
  revisionIdsIn,
  textSegments,
  type SectionResolver,
} from './util';

/** Transaction meta: `true` to skip tracking for this transaction (for example loading content). */
export const REVIEW_META_SKIP = 'beakblock:review:skip';
/** Transaction meta set by review operations. Such transactions are never re-tracked. */
export const REVIEW_META_INTERNAL = 'beakblock:review:internal';
/** Transaction meta: `boolean` to turn tracking on or off. */
export const REVIEW_META_SET_ENABLED = 'beakblock:review:setEnabled';

/** Options for {@link createRevisionTrackingPlugin}. */
export interface RevisionTrackingOptions {
  /** Initial tracking state. Defaults to `false` (opt-in, like Word). */
  enabled?: boolean;
  author: ReviewAuthor;
  store?: RevisionStore;
  /** Overrides the `controlledSection` lookup for the section of a revision. */
  getSectionId?: SectionResolver;
}

/** Plugin state. */
export interface RevisionTrackingState {
  enabled: boolean;
  author: ReviewAuthor;
  store?: RevisionStore;
  getSectionId?: SectionResolver;
}

/** Plugin key. Use `REVIEW_PLUGIN_KEY.getState(state)` to read the tracking state. */
export const REVIEW_PLUGIN_KEY = new PluginKey<RevisionTrackingState>('beakblockReviewTracking');

/** Reads the tracking state, or `undefined` when the plugin is not installed. */
export function getReviewState(state: EditorState): RevisionTrackingState | undefined {
  return REVIEW_PLUGIN_KEY.getState(state);
}

/** Whether track changes is on for this editor state. */
export function isTrackChangesEnabled(state: EditorState): boolean {
  return getReviewState(state)?.enabled ?? false;
}

/** Transaction that turns track changes on or off. Dispatch it through the view. */
export function setTrackChangesEnabledTransaction(tr: Transaction, enabled: boolean): Transaction {
  return tr.setMeta(REVIEW_META_SET_ENABLED, enabled);
}

/** Creates the track changes plugin. */
export function createRevisionTrackingPlugin(options: RevisionTrackingOptions): Plugin<RevisionTrackingState> {
  return new Plugin<RevisionTrackingState>({
    key: REVIEW_PLUGIN_KEY,
    state: {
      init(): RevisionTrackingState {
        return {
          enabled: options.enabled ?? false,
          author: options.author,
          store: options.store,
          getSectionId: options.getSectionId,
        };
      },
      apply(tr, value): RevisionTrackingState {
        const set = tr.getMeta(REVIEW_META_SET_ENABLED) as boolean | undefined;
        if (typeof set === 'boolean' && set !== value.enabled) {
          return { ...value, enabled: set };
        }
        return value;
      },
    },
    appendTransaction(trs, oldState, newState) {
      const st = REVIEW_PLUGIN_KEY.getState(newState);
      if (!st || !st.enabled) return null;
      if (!trs.some((tr) => tr.docChanged)) return null;
      if (trs.some((tr) => tr.getMeta(REVIEW_META_SKIP) || tr.getMeta(REVIEW_META_INTERNAL))) return null;
      return trackDocumentChange(oldState, newState, st);
    },
  });
}

/**
 * Tracking could not record an edit, so the edit is applied as an untracked change. Say so, rather
 * than letting it pass without a trace.
 */
function warnUntracked(reason: unknown): void {
  console.warn('BeakBlock review: an edit could not be tracked and was applied as an untracked change.', reason);
}

function segmentSignature(doc: PMNode, from: number, to: number): string {
  return textSegments(doc, from, to)
    .map((s) => `${s.marks.map((m) => `${m.type.name}${JSON.stringify(m.attrs)}`).join(',')}|${doc.textBetween(s.from, s.to, '', '')}`)
    .join('\u0000');
}

/**
 * Builds the tracked version of a user change. Returns `null` when the change should stay as is
 * (no text change, unsupported schema, or a placement failure).
 */
function trackDocumentChange(
  oldState: EditorState,
  newState: EditorState,
  st: RevisionTrackingState
): Transaction | null {
  const oldDoc = oldState.doc;
  const newDoc = newState.doc;
  if (!newState.schema.marks[INSERTION_MARK] || !newState.schema.marks[DELETION_MARK]) return null;

  const start = oldDoc.content.findDiffStart(newDoc.content);
  if (start === null || start === undefined) return null;
  const ends = oldDoc.content.findDiffEnd(newDoc.content);
  if (!ends) return null;
  let endA = ends.a;
  let endB = ends.b;
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }

  const oldText = oldDoc.textBetween(start, endA, '', '');
  const newText = newDoc.textBetween(start, endB, '', '');

  if (oldText === newText) {
    // Formatting or structure only. Formatting is applied directly and recorded.
    if (st.store && newText.length > 0 && segmentSignature(oldDoc, start, endA) !== segmentSignature(newDoc, start, endB)) {
      const loc = resolveLocation(newDoc, start, st.getSectionId);
      syncRevisionRecords(newDoc, {
        store: st.store,
        touched: [],
        actor: st.author,
        getSectionId: st.getSectionId,
        formatRecord: {
          id: newId('fmt'),
          sectionId: loc.sectionId,
          blockId: loc.blockId,
          text: newText,
          note: 'Formatting changed',
        },
        previousIds: [],
      });
    }
    return null;
  }

  const insertion = endB > start ? newDoc.slice(start, endB) : null;
  let result: TrackedChangeResult;
  try {
    result = applyTrackedChange(oldState.tr, {
      from: start,
      to: endA,
      insertion,
      author: st.author,
      groupReplacements: true,
    });
  } catch (error) {
    warnUntracked(error);
    return null;
  }
  if (result.failed) {
    warnUntracked('the change does not fit at this position');
    return null;
  }

  const out = newState.tr;
  try {
    out.replace(start, endB, result.tr.doc.slice(start, result.insertEnd));
  } catch (error) {
    warnUntracked(error);
    return null;
  }

  // A pure deletion of already-deleted text would otherwise leave the cursor stuck in front of it.
  // Move the cursor past the struck text in the direction of the key press.
  let selectionOverride: number | null = null;
  if (endB === start && endA > start) {
    const sel = oldState.selection;
    const cursorAtStart = sel.empty && sel.from === start;
    selectionOverride = cursorAtStart ? result.insertEnd : start;
  }

  if (out.doc.eq(newDoc) && selectionOverride === null) return null;

  if (selectionOverride !== null) {
    try {
      out.setSelection(TextSelection.create(out.doc, selectionOverride));
    } catch {
      // Keep the mapped selection.
    }
  }

  out.setMeta(REVIEW_META_INTERNAL, true);

  syncRevisionRecords(out.doc, {
    store: st.store,
    touched: [
      ...result.deletionIds.map((id) => ({ id, kind: 'delete' as const })),
      ...result.insertionIds.map((id) => ({ id, kind: 'insert' as const })),
    ],
    previousIds: revisionIdsIn(oldDoc, start, endA),
    actor: st.author,
    getSectionId: st.getSectionId,
  });

  return out;
}
