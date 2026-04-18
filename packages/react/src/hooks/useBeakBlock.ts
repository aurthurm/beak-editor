/**
 * useBeakBlock - The main React hook for BeakBlock
 *
 * Creates and manages an BeakBlockEditor instance within React's lifecycle.
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock({
 *     initialContent: [
 *       { type: 'paragraph', content: [{ type: 'text', text: 'Hello!', styles: {} }] }
 *     ],
 *   });
 *
 *   return <BeakBlockView editor={editor} />;
 * }
 * ```
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  BeakBlockEditor,
  EditorConfig,
  Block,
  SlashMenuItem,
  NodeViewConstructor,
  codeBlockNodeView,
  embedNodeView,
  tableOfContentsNodeView,
} from '@amusendame/beakblock-core';
import type { ReactBlockSpec, PropSchema } from '../blocks';

/**
 * Options for useBeakBlock hook
 */
export interface UseBeakBlockOptions extends Omit<EditorConfig, 'element'> {
  /**
   * Custom React block specifications to register with the editor.
   * These blocks will be rendered using React components.
   */
  customBlocks?: ReactBlockSpec<PropSchema>[];
}

/**
 * Create and manage an BeakBlockEditor instance
 *
 * @param options - Editor configuration options
 * @returns The BeakBlockEditor instance, or null during initialization
 *
 * @remarks
 * This hook properly handles React 18+ StrictMode, which mounts components twice
 * in development. The editor is created in useEffect to ensure a fresh instance
 * is created after each mount/unmount cycle.
 */
export function useBeakBlock(options: UseBeakBlockOptions = {}): BeakBlockEditor | null {
  const [editor, setEditor] = useState<BeakBlockEditor | null>(null);
  const optionsRef = useRef(options);
  // Store a reference to the editor that nodeViews can use
  const editorRef = useRef<BeakBlockEditor | null>(null);

  useEffect(() => {
    const { customBlocks, ...editorOptions } = optionsRef.current;

    // Build customNodes from custom block specs
    const customNodes: NonNullable<EditorConfig['customNodes']> = {};
    if (customBlocks && customBlocks.length > 0) {
      for (const blockSpec of customBlocks) {
        customNodes[blockSpec.type] = blockSpec.nodeSpec;
      }
    }

    // Build nodeViews from custom blocks
    const nodeViews: Record<string, NodeViewConstructor> = {};

    if (customBlocks && customBlocks.length > 0) {
      for (const blockSpec of customBlocks) {
        nodeViews[blockSpec.type] = (node, view, getPos, decorations, innerDecorations) => {
          const editor = editorRef.current;
          if (!editor) {
            throw new Error('Editor not initialized');
          }
          const nodeViewConstructor = blockSpec.createNodeView(editor);
          return nodeViewConstructor(node, view, getPos, decorations, innerDecorations);
        };
      }
    }

    // Create editor WITHOUT nodeViews first to avoid the race condition:
    // ProseMirror calls nodeView constructors during EditorView construction,
    // but editorRef.current isn't set yet, causing a crash when initialContent
    // contains custom blocks.
    const newEditor = new BeakBlockEditor({
      ...editorOptions,
      customNodes: Object.keys(customNodes).length > 0 ? customNodes : undefined,
      prosemirror: editorOptions.prosemirror,
    });

    // Now the ref is available for nodeView callbacks
    editorRef.current = newEditor;

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
    setEditor(newEditor);

    return () => {
      newEditor.destroy();
      editorRef.current = null;
    };
  }, []);

  return editor;
}

/**
 * Hook to subscribe to editor document changes
 *
 * @param editor - The BeakBlockEditor instance
 * @returns The current document blocks
 */
export function useEditorContent(editor: BeakBlockEditor | null): Block[] {
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Set initial content
    setBlocks(editor.getDocument());

    // Subscribe to changes
    const unsubscribe = editor.on('change', ({ blocks }) => {
      setBlocks(blocks);
    });

    return unsubscribe;
  }, [editor]);

  return blocks;
}

/**
 * Hook to subscribe to editor selection changes
 *
 * @param editor - The BeakBlockEditor instance
 * @returns The currently selected blocks
 */
export function useEditorSelection(editor: BeakBlockEditor | null): Block[] {
  const [selected, setSelected] = useState<Block[]>([]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Set initial selection
    setSelected(editor.getSelectedBlocks());

    // Subscribe to selection changes
    const unsubscribe = editor.on('selectionChange', ({ blocks }) => {
      setSelected(blocks);
    });

    return unsubscribe;
  }, [editor]);

  return selected;
}

/**
 * Hook to track editor focus state
 *
 * @param editor - The BeakBlockEditor instance
 * @returns Whether the editor is focused
 */
export function useEditorFocus(editor: BeakBlockEditor | null): boolean {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Set initial focus state
    setFocused(editor.hasFocus);

    // Subscribe to focus events
    const unsubscribeFocus = editor.on('focus', () => setFocused(true));
    const unsubscribeBlur = editor.on('blur', () => setFocused(false));

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [editor]);

  return focused;
}

/**
 * Hook to generate slash menu items from custom React blocks
 *
 * @param editor - The BeakBlockEditor instance
 * @param customBlocks - Array of custom block specifications
 * @returns Array of SlashMenuItem for custom blocks that have slashMenu config
 *
 * @example
 * ```tsx
 * const customItems = useCustomSlashMenuItems(editor, [DatabaseBlock, EmbedBlock]);
 * return <SlashMenu editor={editor} additionalItems={customItems} />;
 * ```
 */
export function useCustomSlashMenuItems(
  editor: BeakBlockEditor | null,
  customBlocks: ReactBlockSpec<PropSchema>[]
): SlashMenuItem[] {
  return useMemo(() => {
    if (!editor || editor.isDestroyed) return [];

    return customBlocks
      .filter((block): block is ReactBlockSpec<PropSchema> & { slashMenu: NonNullable<ReactBlockSpec<PropSchema>['slashMenu']> } =>
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
            // Build default attrs from propSchema
            const attrs: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(propSchema)) {
              attrs[key] = value.default;
            }
            // Create and insert the node
            const nodeType = view.state.schema.nodes[type];
            if (nodeType) {
              const node = nodeType.create(attrs);
              view.dispatch(view.state.tr.replaceSelectionWith(node));
            }
          },
        };
      });
  }, [editor, customBlocks]);
}
