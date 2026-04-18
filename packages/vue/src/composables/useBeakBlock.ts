import { computed, onBeforeUnmount, onMounted, ref, shallowRef, unref, watch, type ComputedRef, type MaybeRef, type Ref } from 'vue';
import {
  BeakBlockEditor,
  codeBlockNodeView,
  embedNodeView,
  tableOfContentsNodeView,
  type Block,
  type EditorConfig,
  type SlashMenuItem,
  type NodeViewConstructor,
} from '@amusendame/beakblock-core';
import type { PropSchema, VueBlockSpec } from '../blocks';

export type UseBeakBlockOptions = Omit<EditorConfig, 'element'> & {
  customBlocks?: VueBlockSpec<PropSchema>[];
};

export function useBeakBlock(options: UseBeakBlockOptions = {}): Ref<BeakBlockEditor | null> {
  const editor = shallowRef<BeakBlockEditor | null>(null);
  const optionsRef = ref(options);
  const editorRef = shallowRef<BeakBlockEditor | null>(null);

  onMounted(() => {
    const { customBlocks, ...editorOptions } = optionsRef.value;

    const customNodes: NonNullable<EditorConfig['customNodes']> = {};
    const nodeViews: Record<string, NodeViewConstructor> = {};

    if (customBlocks?.length) {
      for (const blockSpec of customBlocks) {
        customNodes[blockSpec.type] = blockSpec.nodeSpec;
        nodeViews[blockSpec.type] = (node, view, getPos, decorations, innerDecorations) => {
          const currentEditor = editorRef.value;
          if (!currentEditor) {
            throw new Error('Editor not initialized');
          }
          const nodeViewConstructor = blockSpec.createNodeView(currentEditor);
          return nodeViewConstructor(node, view, getPos, decorations, innerDecorations);
        };
      }
    }

    const newEditor = new BeakBlockEditor({
      ...editorOptions,
      customNodes: Object.keys(customNodes).length > 0 ? customNodes : undefined,
      prosemirror: editorOptions.prosemirror,
    });

    editorRef.value = newEditor;

    const tocViews: Record<string, NodeViewConstructor> = newEditor.pm.state.schema.nodes.tableOfContents
      ? { tableOfContents: tableOfContentsNodeView }
      : {};
    const embedViews: Record<string, NodeViewConstructor> = newEditor.pm.state.schema.nodes.embed
      ? { embed: embedNodeView }
      : {};
    const codeBlockViews: Record<string, NodeViewConstructor> = newEditor.pm.state.schema.nodes.codeBlock
      ? { codeBlock: codeBlockNodeView }
      : {};
    const mergedNodeViews = {
      ...tocViews,
      ...embedViews,
      ...codeBlockViews,
      ...(editorOptions.prosemirror?.nodeViews ?? {}),
      ...nodeViews,
    };
    if (Object.keys(mergedNodeViews).length > 0) {
      newEditor.pm.view.setProps({ nodeViews: mergedNodeViews });
    }

    editor.value = newEditor;
  });

  onBeforeUnmount(() => {
    editor.value?.destroy();
    editorRef.value = null;
    editor.value = null;
  });

  return editor;
}

export function useEditorContent(editor: MaybeRef<BeakBlockEditor | null>): Ref<Block[]> {
  const blocks = ref<Block[]>([]);

  watch(
    () => unref(editor),
    (currentEditor, _previousEditor, onCleanup) => {
      blocks.value = currentEditor && !currentEditor.isDestroyed ? currentEditor.getDocument() : [];

      if (!currentEditor || currentEditor.isDestroyed) {
        return;
      }

      const unsubscribe = currentEditor.on('change', ({ blocks: nextBlocks }) => {
        blocks.value = nextBlocks;
      });

      onCleanup(() => {
        unsubscribe();
      });
    },
    { immediate: true }
  );

  return blocks;
}

export function useEditorSelection(editor: MaybeRef<BeakBlockEditor | null>): Ref<Block[]> {
  const selectedBlocks = ref<Block[]>([]);

  watch(
    () => unref(editor),
    (currentEditor, _previousEditor, onCleanup) => {
      selectedBlocks.value = currentEditor && !currentEditor.isDestroyed ? currentEditor.getSelectedBlocks() : [];

      if (!currentEditor || currentEditor.isDestroyed) {
        return;
      }

      const unsubscribe = currentEditor.on('selectionChange', ({ blocks: nextBlocks }) => {
        selectedBlocks.value = nextBlocks;
      });

      onCleanup(() => {
        unsubscribe();
      });
    },
    { immediate: true }
  );

  return selectedBlocks;
}

export function useEditorFocus(editor: MaybeRef<BeakBlockEditor | null>): Ref<boolean> {
  const focused = ref(false);

  watch(
    () => unref(editor),
    (currentEditor, _previousEditor, onCleanup) => {
      focused.value = Boolean(currentEditor && !currentEditor.isDestroyed && currentEditor.hasFocus);

      if (!currentEditor || currentEditor.isDestroyed) {
        return;
      }

      const unsubscribeFocus = currentEditor.on('focus', () => {
        focused.value = true;
      });
      const unsubscribeBlur = currentEditor.on('blur', () => {
        focused.value = false;
      });

      onCleanup(() => {
        unsubscribeFocus();
        unsubscribeBlur();
      });
    },
    { immediate: true }
  );

  return focused;
}

export function useCustomSlashMenuItems(
  editor: MaybeRef<BeakBlockEditor | null>,
  customBlocks: MaybeRef<VueBlockSpec<PropSchema>[]>
): ComputedRef<SlashMenuItem[]> {
  return computed(() => {
    const currentEditor = unref(editor);
    const blocks = unref(customBlocks);

    if (!currentEditor || currentEditor.isDestroyed) return [];

    return blocks
      .filter((block): block is VueBlockSpec<PropSchema> & { slashMenu: NonNullable<VueBlockSpec<PropSchema>['slashMenu']> } =>
        block.slashMenu !== undefined
      )
      .map((block): SlashMenuItem => {
        const { slashMenu, type, propSchema } = block;
        return {
          id: type,
          title: slashMenu.title,
          description: slashMenu.description,
          icon: slashMenu.icon,
          keywords: slashMenu.aliases,
          group: slashMenu.group || 'Custom',
          action: (view) => {
            const attrs: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(propSchema)) {
              attrs[key] = value.default;
            }
            const nodeType = view.state.schema.nodes[type];
            if (nodeType) {
              const node = nodeType.create(attrs);
              view.dispatch(view.state.tr.replaceSelectionWith(node));
            }
          },
        };
      });
  });
}
