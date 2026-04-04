import { Decoration, DecorationSet } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';

import type { CommentStore } from './types';

export interface CommentPluginState {
  decorations: DecorationSet;
}

export const COMMENT_PLUGIN_KEY = new PluginKey<CommentPluginState>('beakblockComments');

function buildDecorations(doc: import('prosemirror-model').Node, store: CommentStore): DecorationSet {
  const decorations: Decoration[] = [];

  for (const thread of store.getThreads()) {
    if (thread.deletedAt) continue;
    if (thread.from >= thread.to) continue;

    decorations.push(
      Decoration.inline(thread.from, thread.to, {
        class: [
          'beakblock-comment-annotation',
          thread.resolved ? 'beakblock-comment-annotation--resolved' : '',
        ]
          .filter(Boolean)
          .join(' '),
        'data-thread-id': thread.id,
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

export function createCommentPlugin(store: CommentStore): Plugin<CommentPluginState> {
  return new Plugin<CommentPluginState>({
    key: COMMENT_PLUGIN_KEY,
    state: {
      init(_config, state) {
        return { decorations: buildDecorations(state.doc, store) };
      },
      apply(tr, prev) {
        if (!tr.docChanged && !tr.getMeta(COMMENT_PLUGIN_KEY)?.refresh) {
          return prev;
        }

        return {
          decorations: buildDecorations(tr.doc, store),
        };
      },
    },
    props: {
      decorations(state) {
        return COMMENT_PLUGIN_KEY.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
    view(editorView) {
      const unsubscribe = store.subscribe(() => {
        if (editorView.isDestroyed) return;
        editorView.dispatch(editorView.state.tr.setMeta(COMMENT_PLUGIN_KEY, { refresh: true }));
      });

      return {
        destroy() {
          unsubscribe();
        },
      };
    },
  });
}

