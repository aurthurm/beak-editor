/**
 * Built-in commands that work against the current BeakBlock core API.
 *
 * Command ids are dotted (`format.bold`, `paragraph.style.heading1`, `table.insertRowBelow`).
 * Commands whose schema node or editor method is missing report `isEnabled: false`
 * instead of throwing, so the same list works across schema extensions.
 *
 * @module
 */

import type {
  BeakBlockEditor,
  EditorState,
  Transaction,
  Node as PMNode,
} from '@amusendame/beakblock-core';
import {
  Fragment,
  TextSelection,
  addRowAfter,
  addRowBefore,
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
} from '@amusendame/beakblock-core';

import type { CommandContext, CommandDefinition } from './types';

type PMCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

/** Editor surface that may or may not exist yet (modes and review views are added by core 2.0). */
interface ModeAwareEditor {
  getMode?: () => string;
  setMode?: (mode: 'block' | 'office' | 'controlled') => void;
  setReviewView?: (view: 'markup' | 'final' | 'original') => void;
}

/** Marks cleared by `format.clearFormatting`. Links are deliberately kept. */
const CLEARABLE_MARKS = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'textColor',
  'backgroundColor',
  'fontSize',
];

/** Generate a block identifier. Uses `crypto.randomUUID` when available. */
export function newBlockId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a node of the named type, keeping only attributes the type declares and
 * filling `id` when the type has one. Returns null when the type is not in the schema.
 */
function makeNode(
  editor: BeakBlockEditor,
  name: string,
  attrs: Record<string, unknown> = {},
  content?: PMNode | PMNode[] | Fragment | null
): PMNode | null {
  const type = editor.pm.schema.nodes[name];
  if (!type) return null;
  const declared = (type.spec.attrs ?? {}) as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key in declared) filtered[key] = value;
  }
  if ('id' in declared && filtered.id === undefined) filtered.id = newBlockId();
  return type.create(filtered, content ?? null);
}

function hasNode(editor: BeakBlockEditor, name: string): boolean {
  return !!editor.pm.schema.nodes[name];
}

function hasMark(editor: BeakBlockEditor, name: string): boolean {
  return !!editor.pm.schema.marks[name];
}

function isList(node: PMNode | null | undefined): boolean {
  return !!node && (node.type.name === 'bulletList' || node.type.name === 'orderedList');
}

/** Run a transaction builder against the current state. Dispatches only when the builder returns true. */
function dispatchTr(editor: BeakBlockEditor, build: (tr: Transaction) => boolean): boolean {
  const tr = editor.pm.state.tr;
  if (!build(tr)) return false;
  editor.pm.dispatch(tr);
  return true;
}

/** Run an editor method that returns void, reporting whether the document or selection changed. */
function runChanging(editor: BeakBlockEditor, fn: () => void): boolean {
  const { doc, selection } = editor.pm.state;
  fn();
  return editor.pm.state.doc !== doc || editor.pm.state.selection !== selection;
}

function runStateCommand(editor: BeakBlockEditor, cmd: PMCommand): boolean {
  return cmd(editor.pm.state, (tr) => editor.pm.dispatch(tr));
}

/** Nearest textblock (paragraph, heading, codeBlock, ...) around the selection. */
function nearestTextblock(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isTextblock) return { node, pos: $from.before(depth) };
  }
  return null;
}

/** Nearest ancestor (excluding the selection's own textblock) whose type name is in `names`. */
function ancestorOfType(state: EditorState, names: string[]): { node: PMNode; pos: number; depth: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (names.includes(node.type.name)) return { node, pos: $from.before(depth), depth };
  }
  return null;
}

/** Insert an inline node (e.g. a field) at the caret. */
function insertInlineAtSelection(editor: BeakBlockEditor, node: PMNode): boolean {
  return dispatchTr(editor, (tr) => {
    tr.replaceSelectionWith(node, false);
    return true;
  });
}

/**
 * Insert a block node at the caret. Inside a non-empty textblock the block is inserted
 * between split halves (Word behaviour). An empty textblock is replaced. An optional trailing
 * paragraph is added after the block, and the caret ends in it (or after the block).
 */
function insertBlockAtSelection(editor: BeakBlockEditor, node: PMNode, trailing?: PMNode | null): boolean {
  return dispatchTr(editor, (tr) => {
    const caret = tr.selection.from;
    const { $from } = tr.selection;
    let depth = $from.depth;
    while (depth > 0 && !$from.node(depth).isTextblock) depth--;

    let cursor: number;
    let split = false;
    if (depth === 0) {
      tr.insert(tr.selection.to, trailing ? [node, trailing] : [node]);
      cursor = tr.selection.to + node.nodeSize;
    } else {
      const block = $from.node(depth);
      const start = $from.before(depth);
      const end = $from.after(depth);
      if (block.content.size === 0) {
        tr.replaceWith(start, end, trailing ? [node, trailing] : [node]);
        cursor = start + node.nodeSize;
      } else {
        let insertAt: number;
        if (tr.selection.empty && $from.parentOffset > 0 && $from.parentOffset < block.content.size) {
          // Split: the second half already serves as the trailing paragraph.
          tr.split(caret);
          insertAt = caret + 1;
          split = true;
        } else if ($from.parentOffset === 0) {
          insertAt = start;
        } else {
          insertAt = end;
        }
        tr.insert(insertAt, trailing && !split ? [node, trailing] : [node]);
        cursor = insertAt + node.nodeSize;
      }
    }

    const target = trailing || split ? cursor + 1 : cursor;
    const pos = Math.max(0, Math.min(tr.doc.content.size, target));
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
    return true;
  });
}

// ---------------------------------------------------------------------------
// List helpers
// ---------------------------------------------------------------------------

interface ListItemContext {
  item: PMNode;
  itemPos: number;
  list: PMNode;
  listPos: number;
  index: number;
  depth: number;
}

function listItemContext(state: EditorState): ListItemContext | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 1; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== 'listItem') continue;
    const parent = $from.node(depth - 1);
    if (!isList(parent)) return null;
    return {
      item: node,
      itemPos: $from.before(depth),
      list: parent,
      listPos: $from.before(depth - 1),
      index: $from.index(depth - 1),
      depth,
    };
  }
  return null;
}

/** Nest the item under its previous sibling (Word Tab behaviour). */
function indentListItem(editor: BeakBlockEditor): boolean {
  const ctx = listItemContext(editor.pm.state);
  if (!ctx || ctx.index === 0) return false;
  const { item, itemPos, list, listPos, index } = ctx;
  const prev = list.child(index - 1);
  let prevOffset = 0;
  for (let i = 0; i < index - 1; i++) prevOffset += list.child(i).nodeSize;
  const prevPos = listPos + 1 + prevOffset;

  const last = prev.lastChild;
  let newPrevContent: Fragment;
  let itemContentStart: number;
  if (last && last.type === list.type) {
    const nestedItems = last.content.append(Fragment.from(item));
    const nested = last.type.create(last.attrs, nestedItems);
    newPrevContent = prev.content.replaceChild(prev.childCount - 1, nested);
    const nestedStart = prevPos + 1 + prev.content.size - last.nodeSize;
    itemContentStart = nestedStart + 1 + last.content.size + 1;
  } else {
    const attrs: Record<string, unknown> = { ...list.attrs };
    if ('id' in attrs) attrs.id = newBlockId();
    const nested = list.type.create(attrs, Fragment.from(item));
    newPrevContent = prev.content.append(Fragment.from(nested));
    itemContentStart = prevPos + 1 + prev.content.size + 2;
  }
  const newPrev = prev.type.create(prev.attrs, newPrevContent, prev.marks);
  const { from, to } = editor.pm.state.selection;

  return dispatchTr(editor, (tr) => {
    tr.replaceWith(prevPos, itemPos + item.nodeSize, newPrev);
    const shift = itemContentStart - (itemPos + 1);
    const start = Math.max(0, Math.min(tr.doc.content.size, from + shift));
    const end = Math.max(0, Math.min(tr.doc.content.size, to + shift));
    tr.setSelection(TextSelection.create(tr.doc, start, end));
    return true;
  });
}

/** The item that contains the current list item, when the current item is nested. */
function outdentTarget(state: EditorState): { ctx: ListItemContext; parentItem: PMNode; parentPos: number } | null {
  const ctx = listItemContext(state);
  if (!ctx || ctx.depth < 3) return null;
  const { $from } = state.selection;
  const parentItem = $from.node(ctx.depth - 2);
  if (parentItem.type.name !== 'listItem' || !isList($from.node(ctx.depth - 3))) return null;
  return { ctx, parentItem, parentPos: $from.before(ctx.depth - 2) };
}

/** Lift a nested item out of its parent item. Later siblings stay nested under the lifted item. */
function outdentListItem(editor: BeakBlockEditor): boolean {
  const state = editor.pm.state;
  const target = outdentTarget(state);
  if (!target) return false;
  const { ctx, parentItem, parentPos } = target;
  const listRel = ctx.listPos - (parentPos + 1);
  const { item, list, index } = ctx;

  const keptBefore: PMNode[] = [];
  const nestedAfter: PMNode[] = [];
  list.forEach((child, _offset, i) => {
    if (i < index) keptBefore.push(child);
    else if (i > index) nestedAfter.push(child);
  });

  const parentChildren: PMNode[] = [];
  parentItem.forEach((child, offset) => {
    if (offset !== listRel) {
      parentChildren.push(child);
      return;
    }
    if (keptBefore.length > 0) parentChildren.push(list.type.create(list.attrs, keptBefore));
  });
  const newParent = parentItem.type.create(parentItem.attrs, parentChildren);

  const movedChildren: PMNode[] = [];
  item.forEach((child) => movedChildren.push(child));
  if (nestedAfter.length > 0) {
    const attrs: Record<string, unknown> = { ...list.attrs };
    if ('id' in attrs) attrs.id = newBlockId();
    movedChildren.push(list.type.create(attrs, nestedAfter));
  }
  const movedItem = item.type.create(item.attrs, movedChildren);

  const { from, to } = state.selection;
  const movedStart = parentPos + newParent.nodeSize + 1;
  const itemContentStart = ctx.itemPos + 1;

  return dispatchTr(editor, (tr) => {
    tr.replaceWith(parentPos, parentPos + parentItem.nodeSize, [newParent, movedItem]);
    const shift = movedStart - itemContentStart;
    const start = Math.max(0, Math.min(tr.doc.content.size, from + shift));
    const end = Math.max(0, Math.min(tr.doc.content.size, to + shift));
    tr.setSelection(TextSelection.create(tr.doc, start, end));
    return true;
  });
}

/** Blocks that replace a list when it is unwrapped: its item content, flattened recursively. */
function flattenList(list: PMNode): PMNode[] {
  const out: PMNode[] = [];
  list.forEach((item) => {
    item.forEach((child) => {
      if (isList(child)) out.push(...flattenList(child));
      else out.push(child);
    });
  });
  return out;
}

/** Keep only attributes declared by `type`, generating an id when the type has one. */
function attrsFor(type: PMNode['type'], attrs: Record<string, unknown>): Record<string, unknown> {
  const declared = (type.spec.attrs ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key in declared) out[key] = value;
  }
  if ('id' in declared && out.id === undefined) out.id = newBlockId();
  return out;
}

/**
 * Toggle a list. Applies the list kind to the enclosing list (switching bullets and numbering
 * in place), unwraps it when the same kind is requested again, or wraps the block.
 */
function toggleList(editor: BeakBlockEditor, kind: 'bulletList' | 'orderedList'): boolean {
  const state = editor.pm.state;
  const list = ancestorOfType(state, ['bulletList', 'orderedList']);
  if (!list) return runChanging(editor, () => editor.setBlockType(kind));

  if (list.node.type.name === kind) {
    const blocks = flattenList(list.node);
    if (blocks.length === 0) return false;
    return dispatchTr(editor, (tr) => {
      tr.replaceWith(list.pos, list.pos + list.node.nodeSize, blocks);
      return true;
    });
  }

  const type = editor.pm.schema.nodes[kind];
  if (!type) return false;
  return dispatchTr(editor, (tr) => {
    tr.setNodeMarkup(list.pos, type, attrsFor(type, list.node.attrs));
    return true;
  });
}

/** Convert the nearest textblock to a checklist item, or unwrap the checklist when already in one. */
function toggleCheckList(editor: BeakBlockEditor): boolean {
  const state = editor.pm.state;
  const checklist = ancestorOfType(state, ['checkList']);
  if (checklist) {
    const paragraphs: PMNode[] = [];
    checklist.node.forEach((itemNode) => {
      const para = makeNode(editor, 'paragraph', {}, itemNode.content);
      if (para) paragraphs.push(para);
    });
    if (paragraphs.length === 0) return false;
    return dispatchTr(editor, (tr) => {
      tr.replaceWith(checklist.pos, checklist.pos + checklist.node.nodeSize, paragraphs);
      return true;
    });
  }
  const block = nearestTextblock(state);
  if (!block) return false;
  const item = makeNode(editor, 'checkListItem', { checked: false }, block.node.content);
  const list = item ? makeNode(editor, 'checkList', {}, item) : null;
  if (!list) return false;
  return dispatchTr(editor, (tr) => {
    tr.replaceWith(block.pos, block.pos + block.node.nodeSize, list);
    return true;
  });
}

/** Apply a textAlign value to every alignable textblock touched by the selection. */
function setAlignment(editor: BeakBlockEditor, align: string): boolean {
  const { from, to } = editor.pm.state.selection;
  const targets: Array<{ pos: number; node: PMNode }> = [];
  editor.pm.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && node.type.spec.attrs?.textAlign !== undefined) {
      targets.push({ pos, node });
      return false;
    }
    return true;
  });
  if (targets.length === 0) return false;
  return dispatchTr(editor, (tr) => {
    for (const { pos, node } of targets) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: align });
    }
    return true;
  });
}

function currentAlignment(state: EditorState): string {
  const block = nearestTextblock(state);
  const value = block?.node.attrs.textAlign;
  return typeof value === 'string' ? value : 'left';
}

// ---------------------------------------------------------------------------
// Command factories
// ---------------------------------------------------------------------------

function markCommand(
  name: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code',
  label: string,
  icon: string,
  shortcut?: string
): CommandDefinition {
  return {
    id: `format.${name}`,
    label,
    description: `Toggle ${label.toLowerCase()} formatting on the selection`,
    icon,
    group: 'Font',
    shortcut,
    operation: 'formatText',
    repeatable: true,
    isEnabled: ({ editor }) => editor.isEditable && hasMark(editor, name),
    isActive: ({ editor }) => hasMark(editor, name) && editor.pm.isMarkActive(name),
    run: ({ editor }) => editor.pm.toggleMark(name),
  };
}

function paragraphStyle(
  id: string,
  label: string,
  icon: string,
  shortcut: string | undefined,
  apply: (editor: BeakBlockEditor) => boolean,
  isActive: (ctx: CommandContext) => boolean
): CommandDefinition {
  return {
    id,
    label,
    description: `Apply the ${label} paragraph style`,
    icon,
    group: 'Styles',
    shortcut,
    operation: 'changeStyle',
    repeatable: true,
    isEnabled: ({ editor }) => editor.isEditable && !!nearestTextblock(editor.pm.state),
    isActive,
    run: ({ editor }) => apply(editor),
  };
}

function alignCommand(value: 'left' | 'center' | 'right' | 'justify', icon: string, shortcut: string): CommandDefinition {
  const label = `Align ${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  return {
    id: `paragraph.align.${value}`,
    label,
    description: `${label} the selected paragraphs`,
    icon,
    group: 'Paragraph',
    shortcut,
    operation: 'editAttrs',
    repeatable: true,
    isEnabled: ({ editor }) => editor.isEditable && !!nearestTextblock(editor.pm.state),
    isActive: ({ editor }) => currentAlignment(editor.pm.state) === value,
    run: ({ editor }) => setAlignment(editor, value),
  };
}

function insertCommand(
  id: string,
  label: string,
  icon: string,
  group: string,
  operation: string,
  enabled: (editor: BeakBlockEditor) => boolean,
  run: (ctx: CommandContext) => boolean,
  extra: Partial<CommandDefinition> = {}
): CommandDefinition {
  return {
    id,
    label,
    description: label,
    icon,
    group,
    operation,
    repeatable: true,
    isEnabled: ({ editor }) => editor.isEditable && enabled(editor),
    run,
    ...extra,
  };
}

function tableCommand(
  id: string,
  label: string,
  icon: string,
  cmd: PMCommand
): CommandDefinition {
  return {
    id,
    label,
    description: label,
    icon,
    group: 'Table',
    operation: 'changeTableStructure',
    repeatable: true,
    isEnabled: ({ editor }) => editor.isEditable && isInTable(editor.pm.state),
    run: ({ editor }) => runStateCommand(editor, cmd),
  };
}

function buildTable(editor: BeakBlockEditor, rows: number, cols: number): PMNode | null {
  const cellFor = (): PMNode | null => {
    const para = makeNode(editor, 'paragraph');
    return para ? makeNode(editor, 'tableCell', {}, para) : null;
  };
  const rowNodes: PMNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: PMNode[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = cellFor();
      if (!cell) return null;
      cells.push(cell);
    }
    const row = makeNode(editor, 'tableRow', {}, cells);
    if (!row) return null;
    rowNodes.push(row);
  }
  return makeNode(editor, 'table', {}, rowNodes);
}

function dimension(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function readArgs(ctx: CommandContext): Record<string, unknown> {
  return ctx.args && typeof ctx.args === 'object' ? (ctx.args as Record<string, unknown>) : {};
}

/** Commands for the 2.0 field node. Inline, so inserted at the caret. */
function fieldCommand(
  id: string,
  label: string,
  fieldType: 'PAGE' | 'NUMPAGES' | 'DOCPROPERTY',
  fallback: string | null,
  defaultName: string | null
): CommandDefinition {
  return insertCommand(
    id,
    label,
    'hash',
    'Insert',
    'replaceText',
    (editor) => hasNode(editor, 'field'),
    ({ editor, args }) => {
      const name = fieldType === 'DOCPROPERTY' ? (readArgs({ editor, args }).name as string | undefined) ?? defaultName : null;
      const node = makeNode(editor, 'field', { fieldType, name, format: null, fallback });
      return node ? insertInlineAtSelection(editor, node) : false;
    }
  );
}

function modeCommand(mode: 'block' | 'office' | 'controlled', label: string, icon: string): CommandDefinition {
  return {
    id: `view.mode.${mode}`,
    label,
    description: `Switch the editor to ${label} mode`,
    icon,
    group: 'View',
    isEnabled: ({ editor }) => typeof (editor as unknown as ModeAwareEditor).setMode === 'function',
    isActive: ({ editor }) => {
      const e = editor as unknown as ModeAwareEditor;
      return typeof e.getMode === 'function' && e.getMode() === mode;
    },
    run: ({ editor }) => {
      const e = editor as unknown as ModeAwareEditor;
      if (typeof e.setMode !== 'function') return false;
      e.setMode(mode);
      return true;
    },
  };
}

function reviewViewCommand(view: 'markup' | 'final' | 'original', label: string, icon: string): CommandDefinition {
  return {
    id: `review.view.${view}`,
    label,
    description: `Show tracked changes as ${label.toLowerCase()}`,
    icon,
    group: 'Review',
    isEnabled: ({ editor }) => typeof (editor as unknown as ModeAwareEditor).setReviewView === 'function',
    run: ({ editor }) => {
      const e = editor as unknown as ModeAwareEditor;
      if (typeof e.setReviewView !== 'function') return false;
      e.setReviewView(view);
      return true;
    },
  };
}

/**
 * Create the built-in command set.
 *
 * Register with `registry.register(createBuiltInCommands())`. Commands are grouped
 * (`Font`, `Styles`, `Paragraph`, `Insert`, `Table`, `History`, `View`, `Review`).
 */
export function createBuiltInCommands(): CommandDefinition[] {
  const commands: CommandDefinition[] = [
    // Font
    markCommand('bold', 'Bold', 'bold', 'Mod-b'),
    markCommand('italic', 'Italic', 'italic', 'Mod-i'),
    markCommand('underline', 'Underline', 'underline', 'Mod-u'),
    markCommand('strikethrough', 'Strikethrough', 'strikethrough'),
    markCommand('code', 'Inline code', 'code'),
    {
      id: 'format.textColor',
      label: 'Font color',
      description: 'Set the text color of the selection. Args: { color: string }',
      icon: 'palette',
      group: 'Font',
      operation: 'formatText',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable && hasMark(editor, 'textColor'),
      isActive: ({ editor }) => hasMark(editor, 'textColor') && editor.pm.isMarkActive('textColor'),
      run: ({ editor, args }) => {
        const color = readArgs({ editor, args }).color;
        if (typeof color !== 'string' || !color) return false;
        return runChanging(editor, () => editor.setTextColor(color));
      },
    },
    {
      id: 'format.highlight',
      label: 'Highlight',
      description: 'Highlight the selection. Args: { color?: string } (default yellow)',
      icon: 'highlighter',
      group: 'Font',
      operation: 'formatText',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable && hasMark(editor, 'backgroundColor'),
      isActive: ({ editor }) => hasMark(editor, 'backgroundColor') && editor.pm.isMarkActive('backgroundColor'),
      run: ({ editor, args }) => {
        const color = readArgs({ editor, args }).color;
        const value = typeof color === 'string' && color ? color : '#ffff00';
        return runChanging(editor, () => editor.setBackgroundColor(value));
      },
    },
    {
      id: 'format.clearFormatting',
      label: 'Clear formatting',
      description: 'Remove character formatting from the selection',
      icon: 'remove-formatting',
      group: 'Font',
      operation: 'formatText',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable,
      run: ({ editor }) =>
        dispatchTr(editor, (tr) => {
          const { from, to, empty } = editor.pm.state.selection;
          if (empty) {
            tr.setStoredMarks([]);
            return true;
          }
          const doc = editor.pm.state.doc;
          let changed = false;
          for (const name of CLEARABLE_MARKS) {
            const type = editor.pm.schema.marks[name];
            if (type && doc.rangeHasMark(from, to, type)) {
              tr.removeMark(from, to, type);
              changed = true;
            }
          }
          return changed;
        }),
    },

    // Styles
    paragraphStyle(
      'paragraph.style.normal',
      'Normal',
      'pilcrow',
      'Mod-Shift-n',
      (editor) => runChanging(editor, () => editor.setBlockType('paragraph')),
      ({ editor }) => nearestTextblock(editor.pm.state)?.node.type.name === 'paragraph'
    ),
    ...([1, 2, 3, 4, 5, 6] as const).map((level) =>
      paragraphStyle(
        `paragraph.style.heading${level}`,
        `Heading ${level}`,
        `heading-${level}`,
        level <= 3 ? `Mod-Alt-${level}` : undefined,
        (editor) => runChanging(editor, () => editor.setBlockType('heading', { level })),
        ({ editor }) => {
          const block = nearestTextblock(editor.pm.state);
          return block?.node.type.name === 'heading' && block.node.attrs.level === level;
        }
      )
    ),
    paragraphStyle(
      'paragraph.style.title',
      'Title',
      'heading',
      undefined,
      // No dedicated title node in the core schema: fall back to Heading 1.
      (editor) => runChanging(editor, () => editor.setBlockType('heading', { level: 1 })),
      ({ editor }) => {
        const block = nearestTextblock(editor.pm.state);
        return block?.node.type.name === 'heading' && block.node.attrs.level === 1;
      }
    ),
    paragraphStyle(
      'paragraph.style.quote',
      'Quote',
      'quote',
      undefined,
      (editor) => runChanging(editor, () => editor.setBlockType('blockquote')),
      ({ editor }) => nearestTextblock(editor.pm.state)?.node.type.name === 'blockquote'
    ),

    // Paragraph alignment (Word: Ctrl+L, Ctrl+E, Ctrl+R, Ctrl+J)
    alignCommand('left', 'align-left', 'Mod-l'),
    alignCommand('center', 'align-center', 'Mod-e'),
    alignCommand('right', 'align-right', 'Mod-r'),
    alignCommand('justify', 'align-justify', 'Mod-j'),

    // Lists
    {
      id: 'list.bullet',
      label: 'Bullets',
      description: 'Convert the selection to a bulleted list',
      icon: 'list',
      group: 'Paragraph',
      operation: 'editAttrs',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable && !!nearestTextblock(editor.pm.state),
      isActive: ({ editor }) => ancestorOfType(editor.pm.state, ['bulletList']) !== null,
      run: ({ editor }) => toggleList(editor, 'bulletList'),
    },
    {
      id: 'list.numbered',
      label: 'Numbering',
      description: 'Convert the selection to a numbered list',
      icon: 'list-ordered',
      group: 'Paragraph',
      operation: 'editAttrs',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable && !!nearestTextblock(editor.pm.state),
      isActive: ({ editor }) => ancestorOfType(editor.pm.state, ['orderedList']) !== null,
      run: ({ editor }) => toggleList(editor, 'orderedList'),
    },
    {
      id: 'list.check',
      label: 'Checklist',
      description: 'Toggle a checklist for the selected paragraph',
      icon: 'list-checks',
      group: 'Paragraph',
      operation: 'editAttrs',
      repeatable: true,
      isEnabled: ({ editor }) =>
        editor.isEditable && hasNode(editor, 'checkList') && hasNode(editor, 'checkListItem') && !!nearestTextblock(editor.pm.state),
      isActive: ({ editor }) => ancestorOfType(editor.pm.state, ['checkList']) !== null,
      run: ({ editor }) => toggleCheckList(editor),
    },
    {
      id: 'list.indent',
      label: 'Increase indent',
      description: 'Nest the current list item one level deeper',
      icon: 'indent',
      group: 'Paragraph',
      operation: 'moveBlock',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable && (listItemContext(editor.pm.state)?.index ?? 0) > 0,
      run: ({ editor }) => indentListItem(editor),
    },
    {
      id: 'list.outdent',
      label: 'Decrease indent',
      description: 'Lift the current list item one level out',
      icon: 'outdent',
      group: 'Paragraph',
      operation: 'moveBlock',
      repeatable: true,
      isEnabled: ({ editor }) => editor.isEditable && outdentTarget(editor.pm.state) !== null,
      run: ({ editor }) => outdentListItem(editor),
    },

    // Insert
    insertCommand(
      'insert.table',
      'Table',
      'table',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'table') && hasNode(editor, 'tableRow') && hasNode(editor, 'tableCell'),
      ({ editor, args }) => {
        const a = readArgs({ editor, args });
        const rows = dimension(a.rows, 3, 1, 50);
        const cols = dimension(a.cols ?? a.columns, 3, 1, 20);
        const table = buildTable(editor, rows, cols);
        return table ? insertBlockAtSelection(editor, table) : false;
      }
    ),
    insertCommand(
      'insert.image',
      'Picture',
      'image',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'image'),
      ({ editor, args }) => {
        const a = readArgs({ editor, args });
        if (typeof a.src !== 'string' || !a.src) return false;
        const node = makeNode(editor, 'image', {
          src: a.src,
          alt: typeof a.alt === 'string' ? a.alt : '',
          width: typeof a.width === 'number' ? a.width : null,
          alignment: typeof a.alignment === 'string' ? a.alignment : 'center',
        });
        return node ? insertBlockAtSelection(editor, node) : false;
      }
    ),
    insertCommand(
      'insert.divider',
      'Divider',
      'minus',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'divider'),
      ({ editor }) => {
        const divider = makeNode(editor, 'divider');
        const para = makeNode(editor, 'paragraph');
        return divider ? insertBlockAtSelection(editor, divider, para) : false;
      }
    ),
    insertCommand(
      'insert.callout',
      'Callout',
      'info',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'callout'),
      ({ editor, args }) => {
        const a = readArgs({ editor, args });
        const calloutType = typeof a.calloutType === 'string' ? a.calloutType : 'info';
        const node = makeNode(editor, 'callout', { calloutType });
        return node ? insertBlockAtSelection(editor, node) : false;
      }
    ),
    insertCommand(
      'insert.codeBlock',
      'Code block',
      'square-code',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'codeBlock'),
      ({ editor }) => {
        const type = editor.pm.schema.nodes.codeBlock;
        if (!type) return false;
        const node = makeNode(editor, 'codeBlock', { language: '' }, type.schema.text(' '));
        return node ? insertBlockAtSelection(editor, node) : false;
      }
    ),
    insertCommand(
      'insert.toc',
      'Table of contents',
      'list-tree',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'tableOfContents'),
      ({ editor }) => {
        const node = makeNode(editor, 'tableOfContents', { itemsJson: '[]' });
        const para = makeNode(editor, 'paragraph');
        return node ? insertBlockAtSelection(editor, node, para) : false;
      }
    ),
    insertCommand(
      'insert.columns',
      'Columns',
      'columns-2',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'columnList') && hasNode(editor, 'column'),
      ({ editor, args }) => {
        const count = dimension(readArgs({ editor, args }).count, 2, 2, 4);
        const width = Math.round((100 / count) * 100) / 100;
        const columns: PMNode[] = [];
        for (let i = 0; i < count; i++) {
          const para = makeNode(editor, 'paragraph');
          const col = para ? makeNode(editor, 'column', { width }, para) : null;
          if (!col) return false;
          columns.push(col);
        }
        const list = makeNode(editor, 'columnList', {}, columns);
        return list ? insertBlockAtSelection(editor, list) : false;
      }
    ),
    insertCommand(
      'insert.pageBreak',
      'Page break',
      'file-break',
      'Insert',
      'insertBlock',
      (editor) => hasNode(editor, 'pageBreak'),
      ({ editor }) => {
        const node = makeNode(editor, 'pageBreak');
        const para = makeNode(editor, 'paragraph');
        return node ? insertBlockAtSelection(editor, node, para) : false;
      },
      { shortcut: 'Mod-Enter' }
    ),
    fieldCommand('insert.field.page', 'Page number', 'PAGE', '1', null),
    fieldCommand('insert.field.numPages', 'Number of pages', 'NUMPAGES', '1', null),
    fieldCommand('insert.field.docProperty', 'Document property', 'DOCPROPERTY', null, 'docNumber'),

    // Table structure
    tableCommand('table.insertRowAbove', 'Insert row above', 'arrow-up-from-line', addRowBefore),
    tableCommand('table.insertRowBelow', 'Insert row below', 'arrow-down-to-line', addRowAfter),
    tableCommand('table.insertColumnLeft', 'Insert column left', 'arrow-left-from-line', addColumnBefore),
    tableCommand('table.insertColumnRight', 'Insert column right', 'arrow-right-from-line', addColumnAfter),
    tableCommand('table.deleteRow', 'Delete row', 'trash-2', deleteRow),
    tableCommand('table.deleteColumn', 'Delete column', 'trash-2', deleteColumn),
    tableCommand('table.deleteTable', 'Delete table', 'table-x', deleteTable),

    // History
    {
      id: 'history.undo',
      label: 'Undo',
      description: 'Undo the last change',
      icon: 'undo-2',
      group: 'History',
      shortcut: 'Mod-z',
      isEnabled: ({ editor }) => editor.isEditable,
      run: ({ editor }) => editor.undo(),
    },
    {
      id: 'history.redo',
      label: 'Redo',
      description: 'Redo the last undone change',
      icon: 'redo-2',
      group: 'History',
      shortcut: ['Mod-y', 'Mod-Shift-z'],
      isEnabled: ({ editor }) => editor.isEditable,
      run: ({ editor }) => editor.redo(),
    },

    // View modes
    modeCommand('block', 'Block', 'pen-line'),
    modeCommand('office', 'Office', 'file-text'),
    modeCommand('controlled', 'Controlled', 'shield-check'),

    // Review views
    reviewViewCommand('markup', 'Markup', 'eye'),
    reviewViewCommand('final', 'Final', 'file-check'),
    reviewViewCommand('original', 'Original', 'history'),
  ];

  return commands;
}
