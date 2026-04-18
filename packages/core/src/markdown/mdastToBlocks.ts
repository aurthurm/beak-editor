/**
 * Convert mdast (CommonMark + GFM) to BeakBlock {@link Block} trees.
 *
 * @module
 */

import type {
  Blockquote,
  List,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
} from 'mdast';
import { v4 as uuid } from 'uuid';

import type { Block, InlineContent } from '../blocks/types';
import type { CalloutType } from '../schema/nodes/callout';
import { phrasingToInlineContent } from './phrasing';

const CALLOUT_RE = /^\[(info|warning|success|error|note)\]\s*(.*)$/i;

function tryParseBeakblockLockComment(value: string): { lockReason?: string | null; lockId?: string | null } | null {
  const trimmed = value.trim();
  const m = trimmed.match(/<!--\s*beakblock-lock\s*([\s\S]*?)-->/i);
  if (!m) return null;
  const inner = (m[1] || '').trim();
  if (!inner) return {};
  let lockReason: string | null = null;
  let lockId: string | null = null;
  for (const part of inner.split(/\s+/)) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).toLowerCase();
    let v = part.slice(eq + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (key === 'reason') lockReason = v;
    if (key === 'lockid') lockId = v;
  }
  return { lockReason, lockId };
}

function newId(): string {
  return uuid();
}

/**
 * Convert a parsed mdast {@link Root} into top-level BeakBlock blocks.
 */
export function mdastToBlocks(root: Root): Block[] {
  const blocks: Block[] = [];
  let pendingLock: { lockReason?: string | null; lockId?: string | null } | null = null;

  for (const child of root.children) {
    if (child.type === 'yaml') continue;

    if (child.type === 'html') {
      const parsed = tryParseBeakblockLockComment(child.value || '');
      if (parsed) {
        pendingLock = parsed;
        continue;
      }
    }

    const produced = flowToBlocks(child);
    if (pendingLock) {
      const head = produced[0];
      if (head && head.type === 'heading') {
        head.props = {
          ...head.props,
          locked: true,
          ...(pendingLock.lockReason != null ? { lockReason: pendingLock.lockReason } : {}),
          ...(pendingLock.lockId != null ? { lockId: pendingLock.lockId } : {}),
        };
      }
      pendingLock = null;
    }

    blocks.push(...produced);
  }

  return blocks;
}

function flowToBlocks(node: RootContent): Block[] {
  switch (node.type) {
    case 'heading':
      return [
        {
          id: newId(),
          type: 'heading',
          props: { level: Math.min(6, Math.max(1, node.depth)) },
          content: phrasingToInlineContent(node.children, {}),
        },
      ];
    case 'paragraph':
      return [
        {
          id: newId(),
          type: 'paragraph',
          props: {},
          content: phrasingToInlineContent(node.children, {}),
        },
      ];
    case 'blockquote':
      return blockquoteToBlocks(node);
    case 'code':
      return [
        {
          id: newId(),
          type: 'codeBlock',
          props: { language: node.lang || '' },
          content: [{ type: 'text', text: node.value ?? '', styles: {} }],
        },
      ];
    case 'thematicBreak':
      return [{ id: newId(), type: 'divider', props: {} }];
    case 'list':
      return [listToBlock(node)];
    case 'table':
      return [tableToBlock(node)];
    case 'html':
      return [
        {
          id: newId(),
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: node.value || '', styles: {} }],
        },
      ];
    case 'definition':
    case 'footnoteDefinition':
      return [];
    default:
      return [];
  }
}

function blockquoteToBlocks(bq: Blockquote): Block[] {
  const merged: InlineContent[] = [];
  const trailing: Block[] = [];

  for (let i = 0; i < bq.children.length; i++) {
    const child = bq.children[i];
    if (child.type === 'paragraph') {
      if (merged.length > 0) merged.push({ type: 'hardBreak' });
      merged.push(...phrasingToInlineContent(child.children, {}));
    } else if (child.type === 'list') {
      trailing.push(listToBlock(child));
    } else {
      trailing.push(...flowToBlocks(child));
    }
  }

  if (merged.length === 0) {
    return trailing;
  }

  const callout = tryCalloutFromBlockquote(merged);
  if (callout) {
    return [callout, ...trailing];
  }

  return [{ id: newId(), type: 'blockquote', props: {}, content: merged }, ...trailing];
}

function tryCalloutFromBlockquote(content: InlineContent[]): Block | null {
  const first = content[0];
  if (!first || first.type !== 'text') return null;
  const m = first.text.match(CALLOUT_RE);
  if (!m) return null;
  const variant = m[1].toLowerCase() as CalloutType;
  const restFirst = m[2] || '';
  const rest: InlineContent[] = [];
  if (restFirst) {
    rest.push({ type: 'text', text: restFirst, styles: { ...first.styles } });
  }
  for (let i = 1; i < content.length; i++) {
    rest.push(content[i]!);
  }
  return {
    id: newId(),
    type: 'callout',
    props: { calloutType: variant },
    content: rest,
  };
}

function listToBlock(list: List): Block {
  const tasky = list.children.some((item) => item.checked != null);
  if (tasky) {
    return {
      id: newId(),
      type: 'checkList',
      props: {},
      children: list.children.map(taskItemToBlock),
    };
  }
  if (list.ordered) {
    return {
      id: newId(),
      type: 'orderedList',
      props: { start: list.start ?? 1 },
      children: list.children.map(listItemToBlock),
    };
  }
  return {
    id: newId(),
    type: 'bulletList',
    props: {},
    children: list.children.map(listItemToBlock),
  };
}

function taskItemToBlock(item: ListItem): Block {
  let content: InlineContent[] = [];
  for (const child of item.children) {
    if (child.type === 'paragraph') {
      content = phrasingToInlineContent(child.children, {});
      break;
    }
  }
  return {
    id: newId(),
    type: 'checkListItem',
    props: { checked: Boolean(item.checked) },
    content,
  };
}

function listItemToBlock(item: ListItem): Block {
  const tail: Block[] = [];
  let main: InlineContent[] = [];
  let seenFirstParagraph = false;

  for (const child of item.children) {
    if (child.type === 'paragraph') {
      if (!seenFirstParagraph) {
        main = phrasingToInlineContent(child.children, {});
        seenFirstParagraph = true;
      } else {
        tail.push({
          id: newId(),
          type: 'paragraph',
          props: {},
          content: phrasingToInlineContent(child.children, {}),
        });
      }
    } else if (child.type === 'list') {
      tail.push(listToBlock(child));
    } else {
      tail.push(...flowToBlocks(child));
    }
  }

  return {
    id: newId(),
    type: 'listItem',
    props: {},
    content: main,
    ...(tail.length > 0 ? { children: tail } : {}),
  };
}

function tableToBlock(table: Table): Block {
  const rows: Block[] = [];
  let rowIndex = 0;
  for (const row of table.children) {
    if (!isTableRow(row)) continue;
    const cells: Block[] = [];
    for (const cell of row.children) {
      if (cell.type !== 'tableCell') continue;
      const cellBlocks = tableCellToBlocks(cell);
      const cellType = rowIndex === 0 ? 'tableHeader' : 'tableCell';
      cells.push({ id: newId(), type: cellType, props: {}, children: cellBlocks });
    }
    rows.push({ id: newId(), type: 'tableRow', props: {}, children: cells });
    rowIndex += 1;
  }
  return { id: newId(), type: 'table', props: {}, children: rows };
}

function isTableRow(node: TableRow | { type: string }): node is TableRow {
  return node.type === 'tableRow';
}

function tableCellToBlocks(cell: TableCell): Block[] {
  const content = phrasingToInlineContent(cell.children as PhrasingContent[], {});
  return [
    {
      id: newId(),
      type: 'paragraph',
      props: {},
      content: content.length > 0 ? content : [],
    },
  ];
}
