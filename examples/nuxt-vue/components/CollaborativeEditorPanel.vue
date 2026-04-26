<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';
import type { Transaction } from 'prosemirror-state';
import {
  BeakBlockView,
  BubbleMenu,
  createChartBlockSpec,
  CommentRail,
  MediaMenu,
  SlashMenu,
  TableHandles,
  TableMenu,
  useBeakBlock,
  useCustomSlashMenuItems,
  useEditorContent,
} from '@amusendame/beakblock-vue';
import { createCommentPlugin, InMemoryCommentStore } from '@amusendame/beakblock-core';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';

const emit = defineEmits<{
  ai: [mode: 'bubble' | 'slash'];
  comment: [];
}>();

const props = withDefaults(
  defineProps<{
    className?: string;
  }>(),
  { className: 'editor-view' }
);

const CURSOR_COLORS = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#059669',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#db2777',
] as const;

function colorForClient(clientId: number): string {
  return CURSOR_COLORS[Math.abs(clientId) % CURSOR_COLORS.length]!;
}

const config = useRuntimeConfig();

const displayName = ref(`Guest ${Math.floor(1000 + Math.random() * 9000)}`);
const roomId = ref(
  typeof config.public.collabRoom === 'string' && config.public.collabRoom.length > 0
    ? config.public.collabRoom
    : 'beakblock-nuxt-showcase'
);

const collabWsBase =
  typeof config.public.collabWsUrl === 'string' ? config.public.collabWsUrl.trim() : '';

const wsDisplay = computed(() => {
  return collabWsBase || 'not configured';
});

/** Snapshot at setup — avoids watchEffect/watcher accidentally tracking `config.public` churn from unrelated updates. */
const commentStore = new InMemoryCommentStore();
const customBlocks = [createChartBlockSpec()];

const collabSeed: Block[] = [
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text:
          'This document syncs in real time over Yjs. Run `pnpm dev` in this folder (it starts the collab WebSocket on port 1234), open two browser tabs on this sample, give yourself different display names, and type — you should see remote carets and selections.',
        styles: {},
      },
    ],
  },
];

const editor = useBeakBlock({
  initialContent: collabSeed,
  history: false,
  customBlocks,
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});

const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
const blocks = useEditorContent(editor);

const providerRef = ref<WebsocketProvider | null>(null);
/** `idle` = no provider yet (do not treat as failure). */
const connectionStatus = ref<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');

watch(
  editor,
  (ed, _prev, onCleanup) => {
    if (!ed || ed.isDestroyed) return;
    const off = ed.on('transaction', (payload: { transaction: unknown }) => {
      const tr = payload.transaction as Transaction;
      if (!tr.docChanged) return;
      commentStore.mapAnchors(tr.mapping);
    });
    onCleanup(() => {
      off();
    });
  },
  { immediate: true }
);

/**
 * Only re-run collab setup when the editor instance or room changes.
 * Do not use watchEffect here: it tracks every reactive read (e.g. displayName, config.public),
 * and document `change` → useEditorContent updates can indirectly retrigger teardown and spam
 * "WebSocket is closed before the connection is established".
 */
watch(
  [editor, roomId],
  ([ed, room], _prev, onCleanup) => {
    const r = (room ?? '').trim() || 'beakblock-nuxt-showcase';
    if (!ed || ed.isDestroyed) return;
    if (!collabWsBase) {
      connectionStatus.value = 'idle';
      return;
    }

    connectionStatus.value = 'connecting';
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(collabWsBase, r, ydoc);
    providerRef.value = provider;

    const onStatus = (event: { status: string }) => {
      if (event.status === 'connected') connectionStatus.value = 'connected';
      else if (event.status === 'disconnected') connectionStatus.value = 'disconnected';
      else connectionStatus.value = 'connecting';
    };
    provider.on('status', onStatus);

    provider.awareness.setLocalStateField('user', {
      name: displayName.value.trim() || 'Anonymous',
      color: colorForClient(provider.awareness.clientID),
    });

    const fragment = ydoc.getXmlFragment('prosemirror');
    ed.enableCollaboration({
      plugins: [ySyncPlugin(fragment), yCursorPlugin(provider.awareness), yUndoPlugin()],
    });

    void nextTick(() => {
      if (!ed.isDestroyed) {
        try {
          ed.focus('start');
        } catch {
          /* y-sync can replace the doc; selection may be invalid for one frame */
        }
      }
    });

    onCleanup(() => {
      provider.off('status', onStatus);
      ed.disableCollaboration();
      provider.destroy();
      ydoc.destroy();
      providerRef.value = null;
      connectionStatus.value = 'idle';
    });
  },
  { flush: 'post', immediate: true }
);

watch(displayName, () => {
  const p = providerRef.value;
  if (!p) return;
  p.awareness.setLocalStateField('user', {
    name: displayName.value.trim() || 'Anonymous',
    color: colorForClient(p.awareness.clientID),
  });
});

defineExpose({
  getEditor: (): BeakBlockEditor | null => editor.value,
  getBlocks: (): Block[] => blocks.value,
  getCommentStore: () => commentStore,
});
</script>

<template>
  <div class="collab-panel">
    <div class="collab-panel__bar" role="group" aria-label="Collaboration">
      <label class="collab-panel__field">
        <span class="collab-panel__label">Your name</span>
        <input v-model="displayName" type="text" class="collab-panel__input" autocomplete="nickname" />
      </label>
      <label class="collab-panel__field">
        <span class="collab-panel__label">Room</span>
        <input v-model="roomId" type="text" class="collab-panel__input" autocomplete="off" spellcheck="false" />
      </label>
      <div class="collab-panel__meta">
        <span
          class="collab-panel__pill"
          :class="{
            'collab-panel__pill--ok': connectionStatus === 'connected',
            'collab-panel__pill--bad': connectionStatus === 'disconnected',
            'collab-panel__pill--wait': connectionStatus === 'connecting' || connectionStatus === 'idle',
          }"
        >
          {{ connectionStatus === 'idle' ? '…' : connectionStatus }}
        </span>
        <span class="collab-panel__ws">{{ wsDisplay }}</span>
      </div>
      <p v-if="connectionStatus === 'disconnected'" class="collab-panel__help">
        Nothing is accepting WebSockets on this URL (connection refused or failed). From
        <code class="collab-panel__code">examples/nuxt-vue</code>, run
        <code class="collab-panel__code">pnpm dev</code> (starts Nuxt + the Yjs server), or in a second terminal run
        <code class="collab-panel__code">pnpm dev:collab</code> if you use
        <code class="collab-panel__code">pnpm dev:nuxt</code> alone. You should see
        <code class="collab-panel__code">running at '127.0.0.1' on port 1234</code> in the collab process logs.
      </p>
    </div>

    <div class="example-editor-panel">
      <CommentRail :editor="editor" :store="commentStore" current-user-id="amusendame">
        <BeakBlockView :editor="editor" :class-name="className" />
      </CommentRail>
      <SlashMenu :editor="editor" :custom-items="customSlashItems" @ai="emit('ai', 'slash')" />
      <BubbleMenu :editor="editor" @comment="emit('comment')" @ai="emit('ai', 'bubble')" />
      <TableMenu :editor="editor" />
      <TableHandles :editor="editor" />
      <MediaMenu :editor="editor" />
    </div>
  </div>
</template>
