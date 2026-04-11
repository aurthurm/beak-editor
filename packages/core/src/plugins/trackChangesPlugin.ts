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

import { BEAKBLOCK_META_SKIP_TRACK_CHANGES } from './trackChangesMeta';

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
        let decorations = pluginState.decorations.map(tr.mapping, newState.doc);

        if (!tr.docChanged) {
          return { decorations, log: pluginState.log };
        }

        if (tr.getMeta(BEAKBLOCK_META_SKIP_TRACK_CHANGES)) {
          return { decorations, log: pluginState.log };
        }

        const newDecorations: Decoration[] = [];
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

            if ((kind === 'delete' || kind === 'replace') && delText.length > 0 && typeof document !== 'undefined') {
              const widgetPos = tailMap.map(newStart, 1);
              const preview =
                delText.length > MAX_DELETE_PREVIEW ? `${delText.slice(0, MAX_DELETE_PREVIEW)}…` : delText;
              const span = document.createElement('span');
              span.className = 'beakblock-track-delete';
              span.textContent = preview;
              span.setAttribute('title', delText);
              newDecorations.push(
                Decoration.widget(widgetPos, span, { side: -1, key: `beak-del-${uuid()}` })
              );
            }

            if ((kind === 'insert' || kind === 'replace') && insertedLen > 0) {
              const from = tailMap.map(newStart, 1);
              const to = tailMap.map(newEnd, -1);
              if (from < to) {
                newDecorations.push(
                  Decoration.inline(from, to, {
                    class: 'beakblock-track-insert',
                  })
                );
              }
            }

            if (kind === 'insert' && insertedLen === 0) {
              return;
            }

            newLog.push({
              id: uuid(),
              kind,
              at: new Date().toISOString(),
              authorId,
              deletedText: delText.length > 0 ? delText : undefined,
              insertedLength: insertedLen > 0 ? insertedLen : undefined,
            });
          });

          const applied = step.apply(docBefore);
          if (applied.failed || !applied.doc) break;
          docBefore = applied.doc;
        }

        const mergedLog = [...pluginState.log, ...newLog].slice(-MAX_LOG);
        decorations = decorations.add(newState.doc, newDecorations);
        return { decorations, log: mergedLog };
      },
    },
    props: {
      decorations(state) {
        return TRACK_CHANGES_PLUGIN_KEY.getState(state)?.decorations ?? null;
      },
    },
  });
}
