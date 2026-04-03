/**
 * createReactBlockSpec - Create custom React blocks for BeakBlock
 *
 * This allows you to create custom block types with React components
 * that integrate seamlessly with the BeakBlock editor.
 *
 * @example
 * ```tsx
 * import { createReactBlockSpec } from '@labbs/beakblock-react';
 *
 * const MyCustomBlock = createReactBlockSpec({
 *   type: 'myBlock',
 *   propSchema: {
 *     title: { default: '' },
 *     color: { default: 'blue' },
 *   },
 *   content: 'none', // or 'inline' for editable content
 * }, {
 *   render: ({ block, editor }) => (
 *     <div style={{ background: block.props.color }}>
 *       <h3>{block.props.title}</h3>
 *     </div>
 *   ),
 * });
 * ```
 *
 * @module
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  type BeakBlockEditor,
  type NodeView,
  type NodeViewConstructor,
  Node as PMNode,
  EditorView,
} from '@labbs/beakblock-core';

/**
 * Property schema definition for a block
 */
export interface PropSchema {
  [key: string]: {
    default: unknown;
  };
}

/**
 * Block spec configuration
 */
export interface BlockSpec<T extends PropSchema> {
  /** Unique block type identifier */
  type: string;
  /** Property schema with defaults */
  propSchema: T;
  /** Content type: 'none' for no content, 'inline' for text content */
  content: 'none' | 'inline';
}

/**
 * Props passed to the render component
 */
export interface BlockRenderProps<T extends PropSchema> {
  /** The block data */
  block: {
    id: string;
    type: string;
    props: { [K in keyof T]: T[K]['default'] };
  };
  /** The editor instance */
  editor: BeakBlockEditor;
  /** Whether the editor is in editable mode */
  isEditable: boolean;
  /** Content DOM element for inline content (only if content: 'inline') */
  contentRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Slash menu configuration for a custom block
 */
export interface SlashMenuConfig {
  /** Display title in the menu */
  title: string;
  /** Description shown below the title */
  description?: string;
  /** Icon identifier (matches built-in icons) or 'custom' */
  icon?: string;
  /** Alternative search keywords */
  aliases?: string[];
  /** Group/category for the menu */
  group?: string;
}

/**
 * Block implementation with render function
 */
export interface BlockImplementation<T extends PropSchema> {
  render: React.ComponentType<BlockRenderProps<T>>;
  /** Slash menu configuration (optional - if not provided, block won't appear in slash menu) */
  slashMenu?: SlashMenuConfig;
}

/**
 * Return type of createReactBlockSpec
 */
export interface ReactBlockSpec<T extends PropSchema> {
  /** Block type identifier */
  type: string;
  /** Property schema */
  propSchema: T;
  /** Content type */
  content: 'none' | 'inline';
  /** ProseMirror node spec (simplified type for compatibility) */
  nodeSpec: Record<string, unknown>;
  /** NodeView constructor factory */
  createNodeView: (editor: BeakBlockEditor) => NodeViewConstructor;
  /** Slash menu configuration (optional - if not provided, block won't appear in slash menu) */
  slashMenu?: SlashMenuConfig;
}

/**
 * Context for React block components
 */
interface ReactBlockContext {
  editor: BeakBlockEditor;
}

const BlockContext = React.createContext<ReactBlockContext | null>(null);

/**
 * Hook to access the editor from within a block component
 */
export function useBlockEditor(): BeakBlockEditor | null {
  const context = React.useContext(BlockContext);
  return context?.editor ?? null;
}

/**
 * Create a custom React block specification for BeakBlock
 *
 * @param spec - Block specification with type, props, and content model
 * @param implementation - Block implementation with render component
 * @returns A block spec that can be registered with the editor
 */
export function createReactBlockSpec<T extends PropSchema>(
  spec: BlockSpec<T>,
  implementation: BlockImplementation<T>
): ReactBlockSpec<T> {
  const { type, propSchema, content } = spec;
  const { render: RenderComponent, slashMenu } = implementation;

  // Build ProseMirror attrs from prop schema
  const attrs: Record<string, { default: unknown }> = {
    id: { default: null },
  };
  for (const [key, value] of Object.entries(propSchema)) {
    attrs[key] = { default: value.default };
  }

  // Create the node spec
  const nodeSpec = {
    group: 'block',
    content: content === 'inline' ? 'inline*' : '',
    atom: content === 'none',
    attrs,
    parseDOM: [
      {
        tag: `div[data-block-type="${type}"]`,
        getAttrs: (dom: HTMLElement) => {
          const result: Record<string, unknown> = {
            id: dom.getAttribute('data-block-id'),
          };
          for (const key of Object.keys(propSchema)) {
            const attr = dom.getAttribute(`data-${key}`);
            if (attr !== null) {
              // Try to parse as JSON for complex values
              try {
                result[key] = JSON.parse(attr);
              } catch {
                result[key] = attr;
              }
            }
          }
          return result;
        },
      },
    ],
    toDOM: (node: PMNode) => {
      const domAttrs: Record<string, string> = {
        'data-block-type': type,
        'data-block-id': node.attrs.id || '',
        class: `beakblock-custom-block beakblock-${type}`,
        contenteditable: 'false',
      };
      // Add props as data attributes
      for (const key of Object.keys(propSchema)) {
        const value = node.attrs[key];
        if (value !== undefined && value !== null) {
          domAttrs[`data-${key}`] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
      if (content === 'inline') {
        return ['div', domAttrs, 0];
      }
      return ['div', domAttrs];
    },
  };

  // Create NodeView constructor
  const createNodeView = (editor: BeakBlockEditor): NodeViewConstructor => {
    return (node: PMNode, _view: EditorView, _getPos: () => number | undefined, _decorations, _innerDecorations): NodeView => {
      // Create container
      const dom = document.createElement('div');
      dom.className = `beakblock-custom-block beakblock-${type}`;
      dom.setAttribute('data-block-type', type);
      dom.setAttribute('data-block-id', node.attrs.id || '');
      dom.contentEditable = 'false';

      // Content DOM for inline content
      let contentDOM: HTMLElement | undefined;
      if (content === 'inline') {
        contentDOM = document.createElement('div');
        contentDOM.className = 'beakblock-block-content';
        contentDOM.contentEditable = 'true';
      }

      // React root
      let root: Root | null = null;
      const reactContainer = document.createElement('div');
      reactContainer.className = 'beakblock-react-container';
      dom.appendChild(reactContainer);

      // Render function
      const renderReact = (currentNode: PMNode) => {
        const block = {
          id: currentNode.attrs.id || '',
          type,
          props: {} as { [K in keyof T]: T[K]['default'] },
        };

        // Extract props from node attrs
        for (const key of Object.keys(propSchema)) {
          (block.props as Record<string, unknown>)[key] = currentNode.attrs[key];
        }

        const contentRef = React.createRef<HTMLDivElement>();

        const element = (
          <BlockContext.Provider value={{ editor }}>
            <RenderComponent
              block={block}
              editor={editor}
              isEditable={editor.isEditable}
              contentRef={content === 'inline' ? contentRef : undefined}
            />
          </BlockContext.Provider>
        );

        if (!root) {
          root = createRoot(reactContainer);
        }
        root.render(element);

        // Append contentDOM after React renders if needed
        if (content === 'inline' && contentDOM) {
          const dom = contentDOM; // Capture in closure
          requestAnimationFrame(() => {
            const contentContainer = contentRef.current;
            if (contentContainer && !contentContainer.contains(dom)) {
              contentContainer.appendChild(dom);
            }
          });
        }
      };

      // Initial render
      renderReact(node);

      return {
        dom,
        contentDOM,
        update: (updatedNode: PMNode) => {
          if (updatedNode.type.name !== type) return false;
          renderReact(updatedNode);
          return true;
        },
        destroy: () => {
          if (root) {
            root.unmount();
            root = null;
          }
        },
        stopEvent: (event: Event) => {
          // Allow clicks and other events inside the block
          return event.target !== dom;
        },
        ignoreMutation: () => {
          // Ignore mutations from React
          return true;
        },
      };
    };
  };

  return {
    type,
    propSchema,
    content,
    nodeSpec,
    createNodeView,
    slashMenu,
  };
}

/**
 * Helper to update block props from within a block component
 */
export function useUpdateBlock<T extends PropSchema>(
  editor: BeakBlockEditor | null,
  blockId: string
) {
  return React.useCallback(
    (updates: Partial<{ [K in keyof T]: T[K]['default'] }>) => {
      if (!editor || editor.isDestroyed) return;

      // Find the block position
      let pos: number | null = null;
      editor.pm.doc.descendants((node, nodePos) => {
        if (node.attrs.id === blockId) {
          pos = nodePos;
          return false;
        }
      });

      if (pos !== null) {
        const node = editor.pm.doc.nodeAt(pos);
        if (node) {
          const tr = editor.pm.createTransaction();
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...updates });
          editor.pm.dispatch(tr);
        }
      }
    },
    [editor, blockId]
  );
}
