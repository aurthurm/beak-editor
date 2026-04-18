/**
 * Track changes: decoration-based highlights and a change log (no schema marks).
 *
 * @module
 */

import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Mapping } from 'prosemirror-transform';
import type { Step } from 'prosemirror-transform';
import { v4 as uuid } from 'uuid';

import { BEAKBLOCK_META_SKIP_TRACK_CHANGES, BEAKBLOCK_META_TRACK_CLEAR_LOG } from './trackChangesMeta';
import { BEAKBLOCK_META_TRACK_REMOVE } from './trackChangesResolveMeta';

const MAX_DELETE_PREVIEW = 200;
const MAX_LOG = 500;

export type TrackChangeKind = 'insert' | 'delete' | 'replace';

/**
 * One recorded edit while track changes is enabled.
 */
export interface TrackedChangeRecord {
  id: string;
  kind: TrackChangeKind;
  at: string;
  authorId?: string;
  deletedText?: string;
  insertedLength?: number;
  /** Current insert/replace highlight range in the document (mapped each transaction). */
  insertRange?: { from: number; to: number };
  /** Position of the delete preview widget (mapped each transaction). */
  deleteWidgetPos?: number;
}

export interface TrackChangesState {
  decorations: DecorationSet;
  log: TrackedChangeRecord[];
}

export const TRACK_CHANGES_PLUGIN_KEY = new PluginKey<TrackChangesState>('beakblockTrackChanges');

export interface CreateTrackChangesPluginOptions {
  authorId?: string;
}

function stepMapsThroughRest(trSteps: readonly Step[], fromIndex: number): Mapping {
  const m = new Mapping();
  for (let i = fromIndex + 1; i < trSteps.length; i++) {
    const s = trSteps[i];
    if (s) m.appendMap(s.getMap());
  }
  return m;
}

function mapLog(log: TrackedChangeRecord[], mapping: Mapping): TrackedChangeRecord[] {
  return log
    .map((e) => {
      const insertRange =
        e.insertRange && e.insertRange.from < e.insertRange.to
          ? {
              from: mapping.map(e.insertRange.from, 1),
              to: mapping.map(e.insertRange.to, -1),
            }
          : undefined;
      const deleteWidgetPos =
        e.deleteWidgetPos !== undefined ? mapping.map(e.deleteWidgetPos, -1) : undefined;
      return {
        ...e,
        insertRange: insertRange && insertRange.from < insertRange.to ? insertRange : undefined,
        deleteWidgetPos,
      };
    })
    .filter((e) => {
      if (e.kind === 'insert' && e.insertRange && e.insertRange.from >= e.insertRange.to) return false;
      return true;
    });
}

function rebuildDecorations(doc: Parameters<typeof DecorationSet.create>[0], log: TrackedChangeRecord[]): DecorationSet {
  const deco: Decoration[] = [];
  for (const e of log) {
    if (e.insertRange && e.insertRange.from < e.insertRange.to) {
      deco.push(
        Decoration.inline(e.insertRange.from, e.insertRange.to, {
          class: 'beakblock-track-insert',
        })
      );
    }
    if (e.deleteWidgetPos !== undefined && e.deletedText && typeof document !== 'undefined') {
      const delText = e.deletedText;
      const preview =
        delText.length > MAX_DELETE_PREVIEW ? `${delText.slice(0, MAX_DELETE_PREVIEW)}…` : delText;
      const span = document.createElement('span');
      span.className = 'beakblock-track-delete';
      span.textContent = preview;
      span.setAttribute('title', delText);
      span.setAttribute('data-track-change-id', e.id);
      deco.push(Decoration.widget(e.deleteWidgetPos, span, { side: -1, key: `beak-del-${e.id}` }));
    }
  }
  return DecorationSet.create(doc, deco);
}

export function getTrackChangesState(state: EditorState): TrackChangesState | null {
  return TRACK_CHANGES_PLUGIN_KEY.getState(state) ?? null;
}

export function createTrackChangesPlugin(options: CreateTrackChangesPluginOptions = {}): Plugin {
  const authorId = options.authorId;

  return new Plugin<TrackChangesState>({
    key: TRACK_CHANGES_PLUGIN_KEY,
    state: {
      init(): TrackChangesState {
        return { decorations: DecorationSet.empty, log: [] };
      },
      apply(tr, pluginState, oldState, newState): TrackChangesState {
        const removeId = tr.getMeta(BEAKBLOCK_META_TRACK_REMOVE) as string | undefined;

        if (!tr.docChanged) {
          if (removeId) {
            const log = pluginState.log.filter((e) => e.id !== removeId);
            return {
              decorations: rebuildDecorations(newState.doc, log),
              log,
            };
          }
          return { decorations: pluginState.decorations, log: pluginState.log };
        }

        if (tr.getMeta(BEAKBLOCK_META_SKIP_TRACK_CHANGES)) {
          if (tr.getMeta(BEAKBLOCK_META_TRACK_CLEAR_LOG)) {
            return { decorations: DecorationSet.empty, log: [] };
          }
          let log = pluginState.log;
          if (removeId) {
            log = log.filter((e) => e.id !== removeId);
          }
          log = mapLog(log, tr.mapping);
          return {
            decorations: rebuildDecorations(newState.doc, log),
            log,
          };
        }

        let log = mapLog(pluginState.log, tr.mapping);

        const newLog: TrackedChangeRecord[] = [];
        let docBefore = oldState.doc;

        for (let si = 0; si < tr.steps.length; si++) {
          const step = tr.steps[si];
          if (!step) continue;
          const tailMap = stepMapsThroughRest(tr.steps, si);
          step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
            const deletedLen = oldEnd - oldStart;
            const insertedLen = newEnd - newStart;

            let delText = '';
            if (deletedLen > 0) {
              try {
                delText = docBefore.textBetween(oldStart, oldEnd, '\n', '\0');
              } catch {
                delText = '';
              }
            }

            const kind: TrackChangeKind =
              deletedLen > 0 && insertedLen > 0
                ? 'replace'
                : deletedLen > 0
                  ? 'delete'
                  : 'insert';

            if (kind === 'insert' && insertedLen === 0) {
              return;
            }

            const recordId = uuid();
            let insertRange: { from: number; to: number } | undefined;
            let deleteWidgetPos: number | undefined;

            if ((kind === 'insert' || kind === 'replace') && insertedLen > 0) {
              const from = tailMap.map(newStart, 1);
              const to = tailMap.map(newEnd, -1);
              if (from < to) {
                insertRange = { from, to };
              }
            }

            if ((kind === 'delete' || kind === 'replace') && delText.length > 0) {
              deleteWidgetPos = tailMap.map(newStart, 1);
            }

            newLog.push({
              id: recordId,
              kind,
              at: new Date().toISOString(),
              authorId,
              deletedText: delText.length > 0 ? delText : undefined,
              insertedLength: insertedLen > 0 ? insertedLen : undefined,
              insertRange,
              deleteWidgetPos,
            });
          });

          const applied = step.apply(docBefore);
          if (applied.failed || !applied.doc) break;
          docBefore = applied.doc;
        }

        log = [...log, ...newLog].slice(-MAX_LOG);
        if (removeId) {
          log = log.filter((e) => e.id !== removeId);
        }

        return {
          decorations: rebuildDecorations(newState.doc, log),
          log,
        };
      },
    },
    props: {
      decorations(state) {
        return TRACK_CHANGES_PLUGIN_KEY.getState(state)?.decorations ?? null;
      },
    },
  });
}
