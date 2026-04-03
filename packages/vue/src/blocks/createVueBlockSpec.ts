import {
  createApp,
  defineComponent,
  h,
  inject,
  provide,
  shallowRef,
  type App,
  type Component,
  type InjectionKey,
  type Ref,
} from 'vue';
import {
  EditorView,
  Node as PMNode,
  type NodeView,
  type NodeViewConstructor,
  type BeakBlockEditor,
} from '@aurthurm/beakblock-core';

export interface PropSchema {
  [key: string]: {
    default: unknown;
  };
}

export interface BlockSpec<T extends PropSchema> {
  type: string;
  propSchema: T;
  content: 'none' | 'inline';
}

export interface BlockRenderProps<T extends PropSchema> {
  block: {
    id: string;
    type: string;
    props: { [K in keyof T]: T[K]['default'] };
  };
  editor: BeakBlockEditor;
  isEditable: boolean;
  contentRef?: Ref<HTMLElement | null>;
}

export interface SlashMenuConfig {
  title: string;
  description?: string;
  icon?: string;
  aliases?: string[];
  group?: string;
}

export interface BlockImplementation<T extends PropSchema> {
  render: Component<BlockRenderProps<T>>;
  slashMenu?: SlashMenuConfig;
}

export interface VueBlockSpec<T extends PropSchema> {
  type: string;
  propSchema: T;
  content: 'none' | 'inline';
  nodeSpec: Record<string, unknown>;
  createNodeView: (editor: BeakBlockEditor) => NodeViewConstructor;
  slashMenu?: SlashMenuConfig;
}

export const BeakBlockEditorKey: InjectionKey<BeakBlockEditor | null> = Symbol('BeakBlockEditor');

export function useBlockEditor(): BeakBlockEditor | null {
  return inject(BeakBlockEditorKey, null);
}

function buildBlockProps<T extends PropSchema>(
  node: PMNode,
  type: string,
  propSchema: T
): BlockRenderProps<T>['block'] {
  const props = {} as { [K in keyof T]: T[K]['default'] };
  for (const key of Object.keys(propSchema)) {
    (props as Record<string, unknown>)[key] = node.attrs[key];
  }

  return {
    id: node.attrs.id || '',
    type,
    props,
  };
}

export function createVueBlockSpec<T extends PropSchema>(
  spec: BlockSpec<T>,
  implementation: BlockImplementation<T>
): VueBlockSpec<T> {
  const { type, propSchema, content } = spec;
  const { render: RenderComponent, slashMenu } = implementation;

  const attrs: Record<string, { default: unknown }> = {
    id: { default: null },
  };
  for (const [key, value] of Object.entries(propSchema)) {
    attrs[key] = { default: value.default };
  }

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
      for (const key of Object.keys(propSchema)) {
        const value = node.attrs[key];
        if (value !== undefined && value !== null) {
          domAttrs[`data-${key}`] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
      return content === 'inline' ? ['div', domAttrs, 0] : ['div', domAttrs];
    },
  };

  const createNodeView = (editor: BeakBlockEditor): NodeViewConstructor => {
    return (node: PMNode, _view: EditorView, _getPos: () => number | undefined): NodeView => {
      const dom = document.createElement('div');
      dom.className = `beakblock-custom-block beakblock-${type}`;
      dom.setAttribute('data-block-type', type);
      dom.setAttribute('data-block-id', node.attrs.id || '');
      dom.contentEditable = 'false';

      let contentDOM: HTMLElement | undefined;
      if (content === 'inline') {
        contentDOM = document.createElement('div');
        contentDOM.className = 'beakblock-block-content';
        contentDOM.contentEditable = 'true';
        dom.appendChild(contentDOM);
      }

      const appContainer = document.createElement('div');
      appContainer.className = 'beakblock-vue-container';
      dom.appendChild(appContainer);

      const contentRef = shallowRef<HTMLElement | null>(contentDOM ?? null);
      let app: App | null = null;
      let currentNode = node;

      const mount = () => {
        app = createApp(
          defineComponent({
            name: `BeakBlockCustomBlock_${type}`,
            setup() {
              provide(BeakBlockEditorKey, editor);
              return () =>
                h(RenderComponent, {
                  block: buildBlockProps(currentNode, type, propSchema),
                  editor,
                  isEditable: editor.isEditable,
                  contentRef: content === 'inline' ? contentRef : undefined,
                });
            },
          })
        );
        app.mount(appContainer);
      };

      mount();

      return {
        dom,
        contentDOM,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== type) return false;
          currentNode = updatedNode;
          if (app) {
            app.unmount();
          }
          mount();
          return true;
        },
        destroy() {
          if (app) {
            app.unmount();
            app = null;
          }
        },
        stopEvent(event: Event) {
          return event.target !== dom;
        },
        ignoreMutation() {
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

export function useUpdateBlock<T extends PropSchema>(
  editor: BeakBlockEditor | null,
  blockId: string
): (updates: Partial<{ [K in keyof T]: T[K]['default'] }>) => void {
  return (updates) => {
    if (!editor || editor.isDestroyed) return;

    let pos: number | null = null;
    editor.pm.doc.descendants((node, nodePos) => {
      if (node.attrs.id === blockId) {
        pos = nodePos;
        return false;
      }
      return true;
    });

    if (pos !== null) {
      const node = editor.pm.doc.nodeAt(pos);
      if (node) {
        const tr = editor.pm.createTransaction();
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...updates });
        editor.pm.dispatch(tr);
      }
    }
  };
}
