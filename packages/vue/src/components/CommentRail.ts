import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  type PropType,
} from 'vue';
import { type BeakBlockEditor, type CommentStore, type CommentThread } from '@aurthurm/beakblock-core';

import { formatCommentDate, QUICK_REACTIONS, threadRangeLabel } from './commentCommon';

export interface CommentRailProps {
  editor: BeakBlockEditor | null;
  store: CommentStore;
  currentUserId?: string;
  /** When true, the comments panel starts open. Default is collapsed. */
  defaultExpanded?: boolean;
}

type ChatDrafts = Record<string, string>;

function clampPos(doc: { content: { size: number } }, pos: number): number {
  return Math.max(1, Math.min(pos, doc.content.size));
}

export const CommentRail = defineComponent({
  name: 'CommentRail',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    store: { type: Object as PropType<CommentStore>, required: true },
    currentUserId: { type: String, default: 'you' },
    defaultExpanded: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const railPanelId = `beakblock-comment-rail-${useId()}`;
    const editorColRef = ref<HTMLElement | null>(null);
    const panelOpen = ref(props.defaultExpanded);
    const threads = ref<CommentThread[]>([]);
    const layoutY = ref<Record<string, number>>({});
    const selectedThreadId = ref<string | null>(null);
    const replyDrafts = ref<ChatDrafts>({});
    const editingCommentId = ref<string | null>(null);
    const editingBody = ref('');

    let unsubStore: (() => void) | null = null;
    let unsubTx: (() => void) | null = null;
    let unsubSel: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let raf = 0;

    const activeThreads = computed(() =>
      [...threads.value]
        .filter((t) => !t.deletedAt && t.from < t.to)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    );

    const selectedThread = computed(() => {
      if (!selectedThreadId.value) return null;
      return activeThreads.value.find((t) => t.id === selectedThreadId.value) ?? null;
    });

    const scheduleLayout = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        layoutMarkers();
      });
    };

    const layoutMarkers = () => {
      const ed = props.editor;
      const col = editorColRef.value;
      if (!ed || ed.isDestroyed || !col) {
        layoutY.value = {};
        return;
      }

      const view = ed.pm.view;
      const doc = ed.pm.doc;
      const colRect = col.getBoundingClientRect();
      const raw: { id: string; y: number }[] = [];

      for (const thread of activeThreads.value) {
        const pos = clampPos(doc, thread.from);
        try {
          const coords = view.coordsAtPos(pos);
          raw.push({ id: thread.id, y: coords.top - colRect.top });
        } catch {
          /* stale position */
        }
      }

      raw.sort((a, b) => a.y - b.y);
      const minGap = 30;
      let last = -Infinity;
      const next: Record<string, number> = {};
      for (const { id, y } of raw) {
        let yy = y;
        if (yy < last + minGap) yy = last + minGap;
        next[id] = yy;
        last = yy;
      }

      layoutY.value = next;
    };

    const focusThreadInEditor = (thread: CommentThread) => {
      const ed = props.editor;
      if (!ed || ed.isDestroyed) return;
      const doc = ed.pm.doc;
      const from = clampPos(doc, thread.from);
      const to = clampPos(doc, thread.to);
      const a = Math.min(from, to);
      const b = Math.max(from, to);
      try {
        const tr = ed.pm.state.tr.setSelection(ed.pm.createTextSelection(a, b)).scrollIntoView();
        ed.pm.dispatch(tr);
        ed.focus();
      } catch {
        /* invalid range */
      }
    };

    const bindEditor = () => {
      unsubTx?.();
      unsubSel?.();
      unsubTx = null;
      unsubSel = null;
      const ed = props.editor;
      if (!ed || ed.isDestroyed) return;
      unsubTx = ed.on('transaction', scheduleLayout);
      unsubSel = ed.on('selectionChange', scheduleLayout);
    };

    watch(
      () => props.editor,
      () => {
        bindEditor();
        threads.value = props.store.snapshot();
        nextTick(scheduleLayout);
      },
      { immediate: true }
    );

    watch(
      editorColRef,
      (el) => {
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (el && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(scheduleLayout);
          resizeObserver.observe(el);
        }
      },
      { flush: 'post' }
    );

    onMounted(() => {
      unsubStore = props.store.subscribe((snap) => {
        threads.value = snap;
        scheduleLayout();
      });
      window.addEventListener('scroll', scheduleLayout, true);
      window.addEventListener('resize', scheduleLayout);
      nextTick(scheduleLayout);
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      unsubStore?.();
      unsubStore = null;
      unsubTx?.();
      unsubSel?.();
      unsubTx = null;
      unsubSel = null;
      window.removeEventListener('scroll', scheduleLayout, true);
      window.removeEventListener('resize', scheduleLayout);
      if (raf) cancelAnimationFrame(raf);
    });

    watch(activeThreads, (list) => {
      if (selectedThreadId.value && !list.some((t) => t.id === selectedThreadId.value)) {
        selectedThreadId.value = null;
      }
      scheduleLayout();
    });

    watch(panelOpen, (open) => {
      if (open) nextTick(scheduleLayout);
    });

    const saveReply = (threadId: string) => {
      const body = replyDrafts.value[threadId]?.trim();
      if (!body) return;
      props.store.addComment({
        threadId,
        authorId: props.currentUserId,
        body,
      });
      replyDrafts.value = { ...replyDrafts.value, [threadId]: '' };
    };

    const startEdit = (commentId: string, body: string) => {
      editingCommentId.value = commentId;
      editingBody.value = body;
    };

    const saveEdit = (threadId: string, commentId: string) => {
      if (!editingBody.value.trim()) return;
      props.store.updateComment({
        threadId,
        commentId,
        body: editingBody.value.trim(),
      });
      editingCommentId.value = null;
      editingBody.value = '';
    };

    const cancelEdit = () => {
      editingCommentId.value = null;
      editingBody.value = '';
    };

    const renderThreadDetail = (thread: CommentThread) =>
      h('article', { class: ['beakblock-comment-thread', thread.resolved ? 'beakblock-comment-thread--resolved' : ''].filter(Boolean).join(' ') }, [
        h('header', { class: 'beakblock-comment-thread__header' }, [
          h('div', [
            h('strong', thread.resolved ? 'Resolved thread' : 'Open thread'),
            h('div', { class: 'beakblock-comment-thread__meta' }, `${threadRangeLabel(thread)} · ${formatCommentDate(thread.createdAt)}`),
          ]),
          h('div', { class: 'beakblock-comment-thread__header-actions' }, [
            h(
              'button',
              {
                type: 'button',
                class: 'beakblock-comment-thread__chip',
                onClick: () =>
                  thread.resolved
                    ? props.store.unresolveThread({ threadId: thread.id })
                    : props.store.resolveThread({ threadId: thread.id, userId: props.currentUserId }),
              },
              thread.resolved ? 'Unresolve' : 'Resolve'
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'beakblock-comment-thread__chip',
                onClick: () => props.store.deleteThread({ threadId: thread.id }),
              },
              'Delete thread'
            ),
          ]),
        ]),
        h(
          'div',
          { class: 'beakblock-comment-thread__comments' },
          thread.comments.map((comment) =>
            h('div', { key: comment.id, class: 'beakblock-comment-thread__comment' }, [
              h('div', { class: 'beakblock-comment-thread__comment-meta' }, [
                h('strong', comment.authorId),
                h('span', formatCommentDate(comment.updatedAt)),
              ]),
              editingCommentId.value === comment.id
                ? [
                    h('textarea', {
                      class: 'beakblock-comment-modal__textarea',
                      value: editingBody.value,
                      onInput: (event: Event) => {
                        editingBody.value = (event.target as HTMLTextAreaElement).value;
                      },
                    }),
                    h('div', { class: 'beakblock-comment-thread__row-actions' }, [
                      h('button', { type: 'button', class: 'beakblock-modal-secondary', onClick: cancelEdit }, 'Cancel'),
                      h('button', { type: 'button', class: 'beakblock-modal-primary', onClick: () => saveEdit(thread.id, comment.id) }, 'Save'),
                    ]),
                  ]
                : [
                    h('p', { class: 'beakblock-comment-thread__body' }, comment.body),
                    h(
                      'div',
                      { class: 'beakblock-comment-thread__reactions' },
                      QUICK_REACTIONS.map((emoji) => {
                        const count = comment.reactions.find((reaction) => reaction.emoji === emoji)?.userIds.length ?? 0;
                        return h(
                          'button',
                          {
                            key: emoji,
                            type: 'button',
                            class: 'beakblock-comment-thread__reaction',
                            onClick: () =>
                              props.store.addReaction({
                                threadId: thread.id,
                                commentId: comment.id,
                                emoji,
                                userId: props.currentUserId,
                              }),
                          },
                          `${emoji} ${count > 0 ? count : ''}`
                        );
                      })
                    ),
                    h('div', { class: 'beakblock-comment-thread__row-actions' }, [
                      h('button', { type: 'button', class: 'beakblock-comment-thread__chip', onClick: () => startEdit(comment.id, comment.body) }, 'Edit'),
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'beakblock-comment-thread__chip',
                          onClick: () => props.store.deleteComment({ threadId: thread.id, commentId: comment.id }),
                        },
                        'Delete'
                      ),
                    ]),
                  ],
            ])
          )
        ),
        h('div', { class: 'beakblock-comment-thread__reply' }, [
          h('textarea', {
            class: 'beakblock-comment-modal__textarea',
            value: replyDrafts.value[thread.id] || '',
            placeholder: 'Reply...',
            onInput: (event: Event) => {
              replyDrafts.value = { ...replyDrafts.value, [thread.id]: (event.target as HTMLTextAreaElement).value };
            },
          }),
          h('div', { class: 'beakblock-comment-thread__row-actions' }, [
            h(
              'button',
              {
                type: 'button',
                class: 'beakblock-modal-primary',
                disabled: !replyDrafts.value[thread.id]?.trim(),
                onClick: () => saveReply(thread.id),
              },
              'Reply'
            ),
          ]),
        ]),
      ]);

    return () => {
      const count = activeThreads.value.length;
      const peek =
        count > 0 && !panelOpen.value
          ? h(
              'button',
              {
                type: 'button',
                class: 'beakblock-comment-rail__peek',
                'aria-expanded': 'false',
                'aria-controls': railPanelId,
                'aria-label': `Show comments, ${count} ${count === 1 ? 'thread' : 'threads'}`,
                onClick: () => {
                  panelOpen.value = true;
                },
              },
              [
                h('span', { class: 'beakblock-comment-rail__peek-icon', 'aria-hidden': 'true' }, '💬'),
                h('span', { class: 'beakblock-comment-rail__peek-count' }, String(count)),
              ]
            )
          : null;

      const aside =
        count > 0 && panelOpen.value
          ? h('aside', {
              id: railPanelId,
              class: 'beakblock-comment-rail',
              'aria-label': 'Comment markers',
            }, [
              h('div', { class: 'beakblock-comment-rail__head' }, [
                h('div', { class: 'beakblock-comment-rail__head-main' }, [
                  h('span', { class: 'beakblock-comment-rail__title' }, 'Comments'),
                  h('span', { class: 'beakblock-comment-rail__count' }, String(count)),
                ]),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'beakblock-comment-rail__collapse',
                    'aria-expanded': 'true',
                    'aria-controls': railPanelId,
                    'aria-label': 'Hide comments panel',
                    onClick: () => {
                      panelOpen.value = false;
                    },
                  },
                  'Hide'
                ),
              ]),
              h('div', { class: 'beakblock-comment-rail__body' }, [
                h('div', { class: 'beakblock-comment-rail__track', role: 'tablist', 'aria-label': 'Threads by position' }, [
                  ...activeThreads.value.map((thread) => {
                    const y = layoutY.value[thread.id] ?? 0;
                    const n = thread.comments.length;
                    const active = selectedThreadId.value === thread.id;
                    return h(
                      'button',
                      {
                        key: thread.id,
                        type: 'button',
                        role: 'tab',
                        'aria-selected': active,
                        class: [
                          'beakblock-comment-rail__bubble',
                          thread.resolved ? 'beakblock-comment-rail__bubble--resolved' : '',
                          active ? 'beakblock-comment-rail__bubble--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' '),
                        style: { top: `${y}px` },
                        title: thread.resolved ? 'Resolved thread' : 'Open thread',
                        onClick: () => {
                          selectedThreadId.value = thread.id;
                          focusThreadInEditor(thread);
                          scheduleLayout();
                        },
                      },
                      [
                        h('span', { class: 'beakblock-comment-rail__bubble-icon', 'aria-hidden': 'true' }, '💬'),
                        h('span', { class: 'beakblock-comment-rail__bubble-n' }, String(n)),
                      ]
                    );
                  }),
                ]),
                h('div', { class: 'beakblock-comment-rail__detail' }, [
                  selectedThread.value
                    ? renderThreadDetail(selectedThread.value)
                    : h('p', { class: 'beakblock-comment-rail__hint' }, 'Select a comment marker.'),
                ]),
              ]),
            ])
          : null;

      const shellClass = [
        'beakblock-comment-shell',
        count > 0 ? 'beakblock-comment-shell--has-comments' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return h('div', { class: shellClass }, [
        h('div', { class: 'beakblock-comment-shell__editor', ref: editorColRef }, slots.default?.() ?? []),
        peek,
        aside,
      ]);
    };
  },
});
