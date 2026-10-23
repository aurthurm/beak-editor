/**
 * ProseMirror node to Block conversion.
 *
 * @module
 */

import { Node as PMNode, Mark } from 'prosemirror-model';
import { v4 as uuid } from 'uuid';

import type {
  Block,
  FieldContent,
  IconContent,
  InlineContent,
  LinkContent,
  RevisionStyle,
  StyledText,
  TextStyles,
  UnknownInlineContent,
} from './types';
import { OFFICE_PARAGRAPH_ATTR_NAMES } from '../schema/nodes/officeParagraph';

/**
 * Node types whose office paragraph attributes are omitted from props when unset.
 */
const OFFICE_PROP_NODE_TYPES = new Set(['paragraph', 'heading']);

/**
 * Optional Office table attributes omitted from props when unset.
 */
const TABLE_OPTIONAL_PROP_NAMES: Record<string, readonly string[]> = {
  table: ['widthMode', 'widthValue', 'styleId', 'look'],
  tableRow: ['isHeader', 'cantSplit', 'heightTwips'],
  tableCell: ['widthTwips', 'borders', 'shading', 'padding', 'vAlign', 'hAlign'],
  tableHeader: ['widthTwips', 'borders', 'shading', 'padding', 'vAlign', 'hAlign'],
};

/**
 * Container node types that have block children instead of inline content.
 */
const CONTAINER_TYPES = new Set([
  'bulletList',
  'orderedList',
  'listItem',
  'checkList',
  'checkListItem',
  'columnList',
  'column',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
]);

/**
 * Converts a ProseMirror node to a Block.
 *
 * This is the reverse transformation that takes a ProseMirror node
 * and produces our JSON block format for serialization.
 *
 * Handles both simple blocks (paragraph, heading) and container blocks
 * (lists, columns) that have nested children.
 *
 * @example
 * ```typescript
 * const block = nodeToBlock(node);
 * console.log(block);
 * // { id: 'abc', type: 'paragraph', props: {}, content: [...] }
 * ```
 *
 * @param node - The ProseMirror node
 * @returns A Block object
 */
/** Restores the original JSON of an `unknownBlock` atom. */
function unknownBlockToBlock(node: PMNode): Block {
  const block: Block = {
    id: node.attrs.id || uuid(),
    type: String(node.attrs.originalType),
    props: JSON.parse(String(node.attrs.propsJson ?? '{}')) as Record<string, unknown>,
  };
  if (node.attrs.contentJson !== null) block.content = JSON.parse(String(node.attrs.contentJson));
  if (node.attrs.childrenJson !== null) block.children = JSON.parse(String(node.attrs.childrenJson));
  return block;
}

export function nodeToBlock(node: PMNode): Block {
  if (node.type.name === 'tableOfContents') {
    let items: unknown[] = [];
    try {
      items = JSON.parse(String(node.attrs.itemsJson ?? '[]')) as unknown[];
    } catch {
      items = [];
    }
    return {
      id: String(node.attrs.id || uuid()),
      type: 'tableOfContents',
      props: { items },
    };
  }

  if (node.type.name === 'unknownBlock') {
    return unknownBlockToBlock(node);
  }

  const { id, ...rawProps } = node.attrs;
  const props: Record<string, unknown> = { ...rawProps };

  // Reverse of blockPropAliases: the aliased attr is written back under the block prop name.
  const aliases = node.type.spec.blockPropAliases as Record<string, string> | undefined;
  for (const [propName, attrName] of Object.entries(aliases ?? {})) {
    if (!(attrName in props)) continue;
    // An unset alias was never in the block's props, so it is not written back.
    if (props[attrName] !== null && props[attrName] !== undefined) props[propName] = props[attrName];
    delete props[attrName];
  }

  if (OFFICE_PROP_NODE_TYPES.has(node.type.name)) {
    for (const name of OFFICE_PARAGRAPH_ATTR_NAMES) {
      if (props[name] === null || props[name] === undefined) {
        delete props[name];
      }
    }
  }

  // Office table attrs are omitted when unset; legacy colwidth/backgroundColor always kept.
  const optionalKeys = TABLE_OPTIONAL_PROP_NAMES[node.type.name];
  if (optionalKeys) {
    for (const name of optionalKeys) {
      if (props[name] === null || props[name] === undefined) delete props[name];
    }
  }

  if (node.type.name === 'sectionBreak' && props.pageSetup == null) {
    delete props.pageSetup;
  }

  const block: Block = {
    id: id || uuid(),
    type: node.type.name,
    props,
  };

  // Handle container blocks with block children
  if (CONTAINER_TYPES.has(node.type.name)) {
    // List items: extract inline content from first paragraph, rest as children
    if (node.type.name === 'listItem') {
      const firstChild = node.firstChild;
      if (firstChild && firstChild.isTextblock) {
        block.content = nodeContentToInline(firstChild);
      }
      // If there are nested lists or other blocks, add as children
      if (node.childCount > 1) {
        const children: Block[] = [];
        node.forEach((child, _offset, index) => {
          if (index > 0) {
            children.push(nodeToBlock(child));
          }
        });
        block.children = children;
      }
    } else if (node.type.name === 'checkListItem') {
      // Check list items have inline content directly (not wrapped in paragraph)
      block.content = nodeContentToInline(node);
    } else if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      // Table cells: all block children become children
      const cellChildren: Block[] = [];
      node.forEach((child) => {
        cellChildren.push(nodeToBlock(child));
      });
      block.children = cellChildren;
    } else {
      // Lists, tables, tableRows: all children become block children
      const blockChildren: Block[] = [];
      node.forEach((child) => {
        blockChildren.push(nodeToBlock(child));
      });
      block.children = blockChildren;
    }
    return block;
  }

  // Extension containers (any non-textblock with block children) keep their children
  if (!node.isTextblock && !node.isAtom && node.childCount > 0 && node.firstChild!.isBlock) {
    block.children = node.content.content.map((child) => nodeToBlock(child));
    return block;
  }

  // Extract inline content from text blocks
  if (node.isTextblock && node.content.size > 0) {
    block.content = nodeContentToInline(node);
  }

  return block;
}

/**
 * Serializes an extension inline node (type, attrs, optional inline children).
 *
 * @param child - An inline, non-text node that is not built in
 */
function customInlineContent(child: PMNode): UnknownInlineContent {
  const item: UnknownInlineContent = { type: child.type.name, props: { ...child.attrs } };
  if (child.childCount > 0) item.content = nodeContentToInline(child);
  return item;
}

/**
 * Extracts inline content from a text block node.
 *
 * @param node - A text block node
 * @returns Array of inline content
 */
function nodeContentToInline(node: PMNode): InlineContent[] {
  const content: InlineContent[] = [];
  let currentLink: LinkContent | null = null;

  const flushLink = () => {
    if (currentLink) {
      content.push(currentLink);
      currentLink = null;
    }
  };

  node.content.forEach((child) => {
    if (child.type.name === 'icon') {
      flushLink();
      const iconItem: IconContent = {
        type: 'icon',
        icon: String(child.attrs.icon || ''),
        symbol: String(child.attrs.symbol || child.text || ''),
        size: child.attrs.size ? Number(child.attrs.size) : undefined,
      };
      content.push(iconItem);
      return;
    }

    if (child.type.name === 'hardBreak') {
      flushLink();
      content.push({ type: 'hardBreak' });
      return;
    }

    if (child.type.name === 'field') {
      flushLink();
      const fieldItem: FieldContent = {
        type: 'field',
        fieldType: String(child.attrs.fieldType || 'PAGE'),
        name: child.attrs.name != null ? String(child.attrs.name) : null,
        ...(child.attrs.format ? { format: String(child.attrs.format) } : {}),
        ...(child.attrs.fallback != null ? { fallback: String(child.attrs.fallback) } : {}),
      };
      content.push(fieldItem);
      return;
    }

    if (child.isText) {
      const linkMark = child.marks.find((mark) => mark.type.name === 'link');
      const styles = marksToStyles(child.marks);
      const textItem: StyledText = {
        type: 'text',
        text: child.text || '',
        styles,
      };

      if (!linkMark) {
        flushLink();
        content.push(textItem);
        return;
      }

      const linkAttrs = {
        href: String(linkMark.attrs.href || ''),
        title: linkMark.attrs.title ?? undefined,
        target: linkMark.attrs.target ?? undefined,
      };

      if (
        currentLink &&
        currentLink.href === linkAttrs.href &&
        currentLink.title === linkAttrs.title &&
        currentLink.target === linkAttrs.target
      ) {
        currentLink.content.push(textItem);
        return;
      }

      flushLink();
      currentLink = {
        type: 'link',
        href: linkAttrs.href,
        ...(linkAttrs.title ? { title: linkAttrs.title } : {}),
        ...(linkAttrs.target ? { target: linkAttrs.target as '_blank' | '_self' } : {}),
        content: [textItem],
      };
    }

    if (!child.isText) {
      // Extension inline node: keep its type, attrs and any inline children
      flushLink();
      // Unregistered extension nodes pass through as loose objects; see UnknownInlineContent.
      content.push(customInlineContent(child) as InlineContent);
    }
  });

  flushLink();

  return content;
}

/**
 * Converts ProseMirror marks to text styles.
 *
 * @param marks - Array of ProseMirror marks
 * @returns A TextStyles object
 */
export function marksToStyles(marks: readonly Mark[]): TextStyles {
  const styles: TextStyles = {};

  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        styles.bold = true;
        break;
      case 'italic':
        styles.italic = true;
        break;
      case 'underline':
        styles.underline = true;
        break;
      case 'strikethrough':
        styles.strikethrough = true;
        break;
      case 'code':
        styles.code = true;
        break;
      case 'textColor':
        styles.textColor = String(mark.attrs.color || '');
        break;
      case 'backgroundColor':
        styles.backgroundColor = String(mark.attrs.color || '');
        break;
      case 'fontSize':
        styles.fontSize = Number(mark.attrs.size || 0) || undefined;
        break;
      case 'insertion':
        styles.revision = revisionFromMark('insert', mark.attrs);
        break;
      case 'deletion':
        styles.revision = revisionFromMark('delete', mark.attrs);
        break;
    }
  }

  return styles;
}

/**
 * Builds a {@link RevisionStyle} from revision mark attrs, omitting null fields.
 *
 * @param kind - `'insert'` or `'delete'`
 * @param attrs - Mark attrs
 */
function revisionFromMark(kind: 'insert' | 'delete', attrs: Record<string, unknown>): RevisionStyle {
  return {
    kind,
    revisionId: String(attrs.revisionId ?? ''),
    ...(attrs.authorId ? { authorId: String(attrs.authorId) } : {}),
    ...(attrs.authorName ? { authorName: String(attrs.authorName) } : {}),
    at: String(attrs.at ?? ''),
    ...(attrs.aiGenerated ? { aiGenerated: true } : {}),
    ...(attrs.groupId ? { groupId: String(attrs.groupId) } : {}),
  };
}

/**
 * Converts a document to an array of blocks.
 *
 * @param doc - The ProseMirror document node
 * @returns Array of blocks
 */
export function docToBlocks(doc: PMNode): Block[] {
  const blocks: Block[] = [];

  doc.forEach((node) => {
    blocks.push(nodeToBlock(node));
  });

  return blocks;
}
