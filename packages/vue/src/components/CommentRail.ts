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

import { formatCommentDate, QUICK_REACTIONS, threadAuditMetaLine, threadRangeLabel } from './commentCommon';

export interface CommentRailProps {
  editor: BeakBlockEditor | null;
  store: CommentStore;
  currentUserId?: string;
}

type ChatDrafts = Record<string, string>;

type ConnectorGeom = { w: number; h: number; d: string };

function clampPos(doc: { content: { size: number } }, pos: number): number {
  return Math.max(1, Math.min(pos, doc.content.size));
}

function escapeAttrSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const CommentRail = defineComponent({
  name: 'CommentRail',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    store: { type: Object as PropType<CommentStore>, required: true },
    currentUserId: { type: String, default: 'you' },
  },
  setup(props, { slots }) {
    const flyoutId = `beakblock-comment-flyout-${useId()}`;
    const editorColRef = ref<HTMLElement | null>(null);
    const threads = ref<CommentThread[]>([]);
    const layoutY = ref<Record<string, number>>({});
    const connectorGeom = ref<ConnectorGeom | null>(null);
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
        connectorGeom.value = null;
        if (col) {
          col.style.removeProperty('--beakblock-comment-flyout-left');
          col.style.removeProperty('--beakblock-comment-flyout-top');
          col.style.removeProperty('--beakblock-comment-connector-left');
          col.style.removeProperty('--beakblock-comment-connector-width');
          col.style.removeProperty('--beakblock-comment-connector-top');
        }
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
      col.style.setProperty('--beakblock-comment-flyout-left', `${colRect.width + 20}px`);

      const sid = selectedThreadId.value;
      if (sid && next[sid] !== undefined) {
        col.style.setProperty('--beakblock-comment-flyout-top', `${next[sid]}px`);
      } else {
        col.style.removeProperty('--beakblock-comment-flyout-top');
      }

      const clearConnector = () => {
        connectorGeom.value = null;
        col.style.removeProperty('--beakblock-comment-connector-left');
        col.style.removeProperty('--beakblock-comment-connector-width');
        col.style.removeProperty('--beakblock-comment-connector-top');
      };

      if (!sid) {
        clearConnector();
        return;
      }

      const thread = activeThreads.value.find((t) => t.id === sid);
      const rail = col.querySelector('.beakblock-comment-shell__marker-rail');
      if (!thread || !rail) {
        clearConnector();
        return;
      }

      const escaped = escapeAttrSelector(sid);
      const annNodes = view.dom.querySelectorAll(`[data-thread-id="${escaped}"]`);

      let spanTop = Infinity;
      let spanBottom = -Infinity;
      let spanRight = -Infinity;

      if (annNodes.length > 0) {
        annNodes.forEach((el) => {
          const r = el.getBoundingClientRect();
          spanTop = Math.min(spanTop, r.top);
          spanBottom = Math.max(spanBottom, r.bottom);
          spanRight = Math.max(spanRight, r.right);
        });
      } else {
        try {
          const a = clampPos(doc, Math.min(thread.from, thread.to));
          const b = clampPos(doc, Math.max(thread.from, thread.to));
          const cFrom = view.coordsAtPos(a);
          const cTo = view.coordsAtPos(b);
          spanRight = Math.max(cFrom.right, cTo.right);
          spanTop = Math.min(cFrom.top, cTo.top);
          spanBottom = Math.max(cFrom.bottom, cTo.bottom);
        } catch {
          clearConnector();
          return;
        }
      }

      const flyoutEl = col.querySelector('.beakblock-comment-flyout');
      const railRect = rail.getBoundingClientRect();
      const lineEndX = flyoutEl ? flyoutEl.getBoundingClientRect().left : railRect.left;

      const spanH = Math.max(1, spanBottom - spanTop);
      const gapAbove = Math.round(Math.max(10, Math.min(20, 8 + spanH * 0.06)));
      const yBottom = spanTop - colRect.top;
      let yTop = yBottom - gapAbove;
      const minY = 4;
      if (yTop < minY) {
        yTop = minY;
      }
      if (yTop >= yBottom - 2) {
        clearConnector();
        return;
      }

      const x0 = spanRight - colRect.left;
      const x1 = lineEndX - colRect.left;
      if (x1 - x0 < 3) {
        clearConnector();
        return;
      }

      const w = Math.max(1, colRect.width);
      const h = Math.max(1, colRect.height);
      const rx0 = Math.round(x0 * 100) / 100;
      const ryBottom = Math.round(yBottom * 100) / 100;
      const ryTop = Math.round(yTop * 100) / 100;
      const rx1 = Math.round(x1 * 100) / 100;

      connectorGeom.value = {
        w,
        h,
        d: `M ${rx0} ${ryBottom} L ${rx0} ${ryTop} L ${rx1} ${ryTop}`,
      };
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
      editorColRef.value?.style.removeProperty('--beakblock-comment-flyout-left');
      editorColRef.value?.style.removeProperty('--beakblock-comment-flyout-top');
      editorColRef.value?.style.removeProperty('--beakblock-comment-connector-left');
      editorColRef.value?.style.removeProperty('--beakblock-comment-connector-width');
      editorColRef.value?.style.removeProperty('--beakblock-comment-connector-top');
      connectorGeom.value = null;
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

    watch(selectedThreadId, () => {
      nextTick(scheduleLayout);
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

    const renderThreadDetail = (thread: CommentThread) => {
      const auditLine = threadAuditMetaLine(thread);
      return h('article', { class: ['beakblock-comment-thread', thread.resolved ? 'beakblock-comment-thread--resolved' : ''].filter(Boolean).join(' ') }, [
        h('header', { class: 'beakblock-comment-thread__header' }, [
          h('div', [
            h('strong', thread.resolved ? 'Resolved thread' : 'Open thread'),
            h('div', { class: 'beakblock-comment-thread__meta' }, `${threadRangeLabel(thread)} · ${formatCommentDate(thread.createdAt)}`),
            ...(auditLine ? [h('div', { class: 'beakblock-comment-thread__audit' }, auditLine)] : []),
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
    };

    return () => {
      const count = activeThreads.value.length;

      const markerRail =
        count > 0
          ? h('div', { class: 'beakblock-comment-shell__marker-rail' }, [
              h(
                'div',
                {
                  class: 'beakblock-comment-markers__track',
                  role: 'group',
                  'aria-label': 'Comment threads',
                },
                activeThreads.value.map((thread) => {
                  const y = layoutY.value[thread.id] ?? 0;
                  const n = thread.comments.length;
                  const active = selectedThreadId.value === thread.id;
                  return h(
                    'button',
                    {
                      key: thread.id,
                      type: 'button',
                      class: [
                        'beakblock-comment-marker__bubble',
                        thread.resolved ? 'beakblock-comment-marker__bubble--resolved' : '',
                        active ? 'beakblock-comment-marker__bubble--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' '),
                      style: { top: `${y}px` },
                      title: thread.resolved ? 'Resolved thread' : 'Open thread',
                      'aria-expanded': active,
                      ...(active ? { 'aria-controls': flyoutId } : {}),
                      'aria-label': `Thread with ${n} ${n === 1 ? 'comment' : 'comments'}, ${thread.resolved ? 'resolved' : 'open'}`,
                      onClick: () => {
                        if (selectedThreadId.value === thread.id) {
                          selectedThreadId.value = null;
                        } else {
                          selectedThreadId.value = thread.id;
                          focusThreadInEditor(thread);
                        }
                        scheduleLayout();
                      },
                    },
                    [
                      h('span', { class: 'beakblock-comment-marker__bubble-icon', 'aria-hidden': 'true' }, '💬'),
                      h('span', { class: 'beakblock-comment-marker__bubble-n' }, String(n)),
                    ]
                  );
                })
              ),
            ])
          : null;

      const flyout =
        count > 0 && selectedThread.value
          ? h(
              'div',
              {
                class: 'beakblock-comment-flyout',
                id: flyoutId,
              },
              [
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'beakblock-comment-flyout__close',
                    'aria-label': 'Close thread',
                    onClick: () => {
                      selectedThreadId.value = null;
                    },
                  },
                  '\u00d7'
                ),
                h('div', { class: 'beakblock-comment-flyout__inner' }, [renderThreadDetail(selectedThread.value)]),
              ]
            )
          : null;

      const cg = connectorGeom.value;
      const connector =
        count > 0 && selectedThread.value && cg
          ? h(
              'svg',
              {
                class: 'beakblock-comment-flyout-connector',
                'aria-hidden': 'true',
                viewBox: `0 0 ${cg.w} ${cg.h}`,
                preserveAspectRatio: 'none',
              },
              [h('path', { class: 'beakblock-comment-flyout-connector__path', d: cg.d })]
            )
          : null;

      return h('div', { class: 'beakblock-comment-shell' }, [
        h('div', { class: 'beakblock-comment-shell__editor', ref: editorColRef }, [
          h('div', { class: 'beakblock-comment-shell__row' }, [
            h('div', { class: 'beakblock-comment-shell__doc' }, [slots.default?.() ?? []]),
            ...(markerRail ? [markerRail] : []),
          ]),
          connector,
          flyout,
        ]),
      ]);
    };
  },
});
