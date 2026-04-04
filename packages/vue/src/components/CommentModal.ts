import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  Teleport,
  watch,
  type PropType,
} from 'vue';
import { type BeakBlockEditor, type CommentStore, type CommentThread } from '@aurthurm/beakblock-core';

import { formatCommentDate, QUICK_REACTIONS, threadRangeLabel } from './commentCommon';

export interface CommentModalProps {
  open: boolean;
  editor: BeakBlockEditor | null;
  store: CommentStore;
  currentUserId?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

type SelectionAnchor = { from: number; to: number; text: string };
type ChatDrafts = Record<string, string>;

export const CommentModal = defineComponent({
  name: 'CommentModal',
  props: {
    open: { type: Boolean, default: false },
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    store: { type: Object as PropType<CommentStore>, required: true },
    currentUserId: { type: String, default: 'you' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const anchor = ref<SelectionAnchor | null>(null);
    const threads = ref<CommentThread[]>([]);
    const draft = ref('');
    const replyDrafts = ref<ChatDrafts>({});
    const editingCommentId = ref<string | null>(null);
    const editingBody = ref('');
    let unsubscribe: (() => void) | null = null;

    watch(
      () => props.open,
      (open, _previous, onCleanup) => {
        unsubscribe?.();
        unsubscribe = null;
        if (!open || !props.editor || props.editor.isDestroyed) {
          anchor.value = null;
          draft.value = '';
          return;
        }

        const from = props.editor.pm.selection.from;
        const to = props.editor.pm.selection.to;
        const text = props.editor.pm.getSelectedText();
        anchor.value = from === to ? null : { from, to, text };
        draft.value = '';
        editingCommentId.value = null;
        editingBody.value = '';
        replyDrafts.value = {};
        threads.value = props.store.snapshot();

        unsubscribe = props.store.subscribe((snapshot) => {
          threads.value = snapshot;
        });

        onCleanup(() => {
          unsubscribe?.();
          unsubscribe = null;
        });
      },
      { immediate: true }
    );

    const visibleThreads = computed(() => {
      const sorted = [...threads.value]
        .filter((thread) => !thread.deletedAt)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      if (!anchor.value) return sorted;
      return sorted.filter((thread) => thread.from <= anchor.value!.to && thread.to >= anchor.value!.from);
    });

    const createThread = () => {
      if (!anchor.value || !draft.value.trim()) return;
      props.store.createThread({
        from: anchor.value.from,
        to: anchor.value.to,
        authorId: props.currentUserId,
        body: draft.value.trim(),
      });
      draft.value = '';
    };

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

    const portalTarget = () => (typeof document !== 'undefined' ? document.body : null);

    onBeforeUnmount(() => {
      unsubscribe?.();
      unsubscribe = null;
    });

    return () => {
      if (!props.open) return null;
      const target = portalTarget();
      if (!target) return null;

      return h(Teleport, { to: target }, [
        h(
          'div',
          { class: 'beakblock-modal-overlay', role: 'presentation', onMousedown: props.onClose },
          [
            h(
              'div',
              {
                class: 'beakblock-comment-modal',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': props.title || 'Comments',
                onMousedown: (event: MouseEvent) => event.stopPropagation(),
              },
              [
                h('div', { class: 'beakblock-modal-header' }, [
                  h('div', [
                    h('div', { class: 'beakblock-modal-kicker' }, 'Collaboration'),
                    h('h2', props.title || 'Comments'),
                    h('p', props.subtitle || 'Capture review notes, replies, reactions, and resolution state on the selected text.'),
                  ]),
                  h('button', { type: 'button', class: 'beakblock-modal-close', onClick: props.onClose, 'aria-label': 'Close' }, '×'),
                ]),
                h('div', { class: 'beakblock-comment-modal__body' }, [
                  h('section', { class: 'beakblock-comment-modal__composer' }, [
                    h('div', { class: 'beakblock-modal-section-title' }, 'Selected text'),
                    h('div', { class: 'beakblock-comment-modal__selection' }, anchor.value?.text || 'Select text in the editor before opening comments.'),
                    h('div', { class: 'beakblock-modal-section-title' }, 'New thread'),
                    h('textarea', {
                      class: 'beakblock-comment-modal__textarea',
                      value: draft.value,
                      placeholder: 'Leave a comment for your collaborators...',
                      onInput: (event: Event) => {
                        draft.value = (event.target as HTMLTextAreaElement).value;
                      },
                    }),
                    h('div', { class: 'beakblock-comment-modal__actions' }, [
                      h('button', { type: 'button', class: 'beakblock-modal-secondary', onClick: props.onClose }, 'Cancel'),
                      h('button', { type: 'button', class: 'beakblock-modal-primary', disabled: !anchor.value || !draft.value.trim(), onClick: createThread }, 'Add comment'),
                    ]),
                  ]),
                  h('section', { class: 'beakblock-comment-modal__threads' }, [
                    h('div', { class: 'beakblock-modal-section-title' }, 'Threads'),
                    visibleThreads.value.length === 0
                      ? h('div', { class: 'beakblock-comment-modal__empty' }, 'No comment threads yet.')
                      : visibleThreads.value.map((thread) =>
                          h(
                            'article',
                            { key: thread.id, class: ['beakblock-comment-thread', thread.resolved ? 'beakblock-comment-thread--resolved' : ''].filter(Boolean).join(' ') },
                            [
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
                            ]
                          )
                        ),
                  ]),
                ]),
              ]
            ),
          ]
        ),
      ]);
    };
  },
});
