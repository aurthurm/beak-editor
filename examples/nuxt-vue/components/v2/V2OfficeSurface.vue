<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import {
  BeakBlockView,
  BubbleMenu,
  FindReplace,
  OfficeShell,
  SlashMenu,
  StylesPane,
  TableHandles,
  TableMenu,
  useBeakBlock,
  useCommandRegistry,
} from '@amusendame/beakblock-vue';
import { createDefaultRibbon, type CommandDefinition } from '@amusendame/beakblock-commands';
import { createPaginationPlugin, type LayoutResult } from '@amusendame/beakblock-layout';
import type { BeakBlockEditor, BeakExtension, Block, EditorMode } from '@amusendame/beakblock-core';
import type { BeakDocument, PageSetup } from '@amusendame/beakblock-schema';
import type { Plugin } from 'prosemirror-state';
import { layoutFromBlocks, printHtmlFor, type LaidOut } from '~/utils/v2/layoutTools';

/**
 * The Office shell around one BeakBlock editor: ribbon with contextual tabs, quick access, command
 * search, rulers, navigation pane, styles pane, find and replace, zoom and view modes, a status bar
 * with page X of Y from the layout engine, and a Print Preview view rendered from the same IR.
 */
type ViewMode = 'print' | 'draft' | 'outline' | 'preview';

const props = withDefaults(
  defineProps<{
    blocks: Block[];
    baseDocument?: BeakDocument | null;
    mode?: EditorMode;
    extensions?: BeakExtension[];
    extraCommands?: CommandDefinition[];
    plugins?: Plugin[];
    pageSetup?: PageSetup;
    navigation?: boolean;
    showRulers?: boolean;
    showStyles?: boolean;
    initialViewMode?: ViewMode;
    label?: string;
    wordBehaviour?: boolean;
  }>(),
  {
    baseDocument: null,
    mode: 'office',
    extensions: () => [],
    extraCommands: () => [],
    plugins: () => [],
    pageSetup: undefined,
    navigation: true,
    showRulers: true,
    showStyles: false,
    initialViewMode: 'print',
    label: 'Office editor',
    wordBehaviour: true,
  }
);

const emit = defineEmits<{
  ready: [editor: BeakBlockEditor];
  change: [blocks: Block[]];
  layout: [laid: LaidOut];
}>();

const layoutRef = shallowRef<LayoutResult | null>(null);
const laidRef = shallowRef<LaidOut | null>(null);
const pageInfo = ref({ page: 1, pages: 1 });
const zoom = ref(1);
const viewMode = ref<ViewMode>(props.initialViewMode);
const multiPage = ref(true);
const focusMode = ref(false);
const findOpen = ref(false);
const stylesOpen = ref(props.showStyles);
const wordCount = ref(0);
const blockCount = ref(0);

const pagination = createPaginationPlugin({
  getLayout: () => layoutRef.value,
  measureBlock: (view, _node, pos) => {
    const dom = view.nodeDOM(pos);
    return dom instanceof HTMLElement ? dom.getBoundingClientRect().height : 0;
  },
});

const editor = useBeakBlock({
  initialContent: props.blocks,
  mode: props.mode,
  extensions: props.extensions,
  wordBehaviour: props.wordBehaviour,
  prosemirror: { plugins: [pagination, ...props.plugins] },
});

const { registry } = useCommandRegistry(editor, { extraCommands: props.extraCommands });

const ribbon = createDefaultRibbon();

let layoutTimer: ReturnType<typeof setTimeout> | null = null;

/** Page number of the top-level block at the caret, from the layout's source block ids. */
function currentPage(ed: BeakBlockEditor, layout: LayoutResult): number {
  const $from = ed.pm.state.selection.$from;
  const id = $from.depth >= 1 ? ($from.node(1).attrs.id as string | undefined) : undefined;
  if (!id) return 1;
  const page = layout.pages.find((p) => p.body.some((f) => f.sourceBlockId === id));
  return page?.number ?? 1;
}

function refreshLayout(ed: BeakBlockEditor): void {
  if (ed.isDestroyed) return;
  try {
    const laid = layoutFromBlocks(ed.getDocument(), props.baseDocument);
    laidRef.value = laid;
    layoutRef.value = laid.layout;
    pageInfo.value = { page: currentPage(ed, laid.layout), pages: Math.max(1, laid.layout.pageCount) };
    emit('layout', laid);
  } catch (error) {
    console.warn('[v2] layout failed', error);
  }
}

function scheduleLayout(ed: BeakBlockEditor): void {
  if (layoutTimer) clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => refreshLayout(ed), 220);
}

function countWordsIn(blocks: Block[]): number {
  let total = 0;
  const visit = (list: Block[]) => {
    for (const b of list) {
      for (const c of (b.content ?? []) as Array<{ text?: string }>) {
        if (typeof c.text === 'string') total += c.text.trim().split(/\s+/).filter(Boolean).length;
      }
      if (b.children) visit(b.children);
    }
  };
  visit(blocks);
  return total;
}

watch(
  editor,
  (ed, _prev, onCleanup) => {
    if (!ed) return;
    emit('ready', ed);
    refreshLayout(ed);
    const updateCounts = () => {
      const blocks = ed.getDocument();
      blockCount.value = blocks.length;
      wordCount.value = countWordsIn(blocks);
    };
    updateCounts();
    const offChange = ed.on('change', ({ blocks }) => {
      emit('change', blocks);
      updateCounts();
      scheduleLayout(ed);
    });
    const offSel = ed.on('selectionChange', () => {
      if (layoutRef.value) pageInfo.value = { page: currentPage(ed, layoutRef.value), pages: pageInfo.value.pages };
    });
    onCleanup(() => {
      offChange();
      offSel();
    });
  },
  { immediate: true }
);

const printHtml = computed(() => (laidRef.value ? printHtmlFor(laidRef.value, props.label) : ''));

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    findOpen.value = true;
  }
}

defineExpose({
  getEditor: (): BeakBlockEditor | null => editor.value,
  getBlocks: (): Block[] => editor.value?.getDocument() ?? [],
  getLaidOut: (): LaidOut | null => laidRef.value,
});

onBeforeUnmount(() => {
  if (layoutTimer) clearTimeout(layoutTimer);
});
</script>

<template>
  <div class="v2-surface" :data-mode="mode" @keydown="onKeydown">
    <div class="v2-surface__main">
      <OfficeShell
        :editor="editor"
        :registry="registry"
        :ribbon="ribbon"
        :mode="mode"
        :navigation="navigation"
        :show-rulers="showRulers"
        :page-setup="pageSetup ?? laidRef?.doc.sections[0]?.pageSetup ?? undefined"
        :zoom="zoom"
        :view-mode="viewMode"
        :multi-page="multiPage"
        :focus-mode="focusMode"
        :page-info="pageInfo"
        :label="label"
        @update:zoom="(z: number) => (zoom = z)"
        @update:view-mode="(m: ViewMode) => (viewMode = m)"
        @update:multi-page="(v: boolean) => (multiPage = v)"
        @update:focus-mode="(v: boolean) => (focusMode = v)"
      >
        <template #printPreview>
          <iframe
            v-if="printHtml"
            class="v2-print-frame"
            title="Print preview rendered from the layout IR"
            sandbox=""
            :srcdoc="printHtml"
          />
        </template>
        <BeakBlockView :editor="editor" class-name="editor-view v2-editor-view" />
      </OfficeShell>

      <template v-if="mode === 'block'">
        <SlashMenu :editor="editor" />
        <BubbleMenu :editor="editor" />
        <TableMenu :editor="editor" />
        <TableHandles :editor="editor" />
      </template>

      <div class="v2-surface__toolbar">
        <button type="button" class="v2-chip" :aria-pressed="findOpen" @click="findOpen = !findOpen">Find &amp; replace (Ctrl+H)</button>
        <button type="button" class="v2-chip" :aria-pressed="stylesOpen" @click="stylesOpen = !stylesOpen">Styles pane</button>
        <span class="v2-surface__stats">
          {{ wordCount }} words · {{ blockCount }} top-level blocks · page {{ pageInfo.page }} of {{ pageInfo.pages }}
        </span>
      </div>
      <div v-if="findOpen" class="v2-surface__find">
        <FindReplace :editor="editor" @close="findOpen = false" />
      </div>
    </div>
    <aside v-if="stylesOpen" class="v2-surface__styles" aria-label="Styles pane">
      <StylesPane :editor="editor" :registry="registry" />
    </aside>
  </div>
</template>

<style scoped>
.v2-surface {
  display: flex;
  gap: 12px;
  min-width: 0;
  align-items: stretch;
}
.v2-surface__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.v2-surface__styles {
  flex: 0 0 240px;
  max-height: 720px;
  overflow: auto;
  border: 1px solid #d6d3cd;
  border-radius: 6px;
  background: #fff;
}
.v2-surface__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
}
.v2-surface__stats {
  margin-left: auto;
  color: #5b5752;
}
.v2-surface__find {
  border: 1px solid #d6d3cd;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
}
.v2-chip {
  border: 1px solid #c9c4bb;
  background: #fff;
  border-radius: 999px;
  padding: 3px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.v2-chip[aria-pressed='true'] {
  background: #2b579a;
  color: #fff;
  border-color: #2b579a;
}
.v2-print-frame {
  width: 100%;
  height: 760px;
  border: 0;
  background: #e7e6e6;
}
</style>
