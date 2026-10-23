/**
 * Block to ProseMirror node conversion.
 *
 * @module
 */

import { Schema, Node as PMNode, Mark } from 'prosemirror-model';
import { v4 as uuid } from 'uuid';

import type {
  Block,
  BuiltinInlineContent,
  InlineContent,
  PartialBlock,
  TextStyles,
  UnknownInlineContent,
} from './types';
import { splitUnknownAttrs } from './unknownContent';

/**
 * Fills the defaults of an input block: a generated `id` when missing or empty,
 * `props: {}` when missing, and the same for every child block.
 *
 * @param block - A block as supplied by the caller
 * @returns A complete {@link Block}
 */
export function normalizeBlock(block: PartialBlock): Block {
  const { children, ...rest } = block;
  const out: Block = { ...rest, id: rest.id || uuid(), props: rest.props ?? {} };
  if (children !== undefined) out.children = children.map(normalizeBlock);
  return out;
}

/**
 * Id of the paragraph that holds a container's inline text (a list item's first paragraph or a table
 * cell's text block). It is derived from the owner's id, so loading the same blocks always yields the
 * same ids and reading the document never mints a new one.
 */
export function implicitParagraphId(ownerId: string): string {
  return `${ownerId}/p`;
}

/**
 * Converts a Block to a ProseMirror node.
 *
 * This is the core transformation that takes our JSON block format
 * and produces the corresponding ProseMirror document structure.
 *
 * Handles both simple blocks (paragraph, heading) and container blocks
 * (lists, columns) that have nested children.
 *
 * @example
 * ```typescript
 * const block: Block = {
 *   id: 'abc',
 *   type: 'paragraph',
 *   props: {},
 *   content: [{ type: 'text', text: 'Hello', styles: { bold: true } }]
 * };
 *
 * const node = blockToNode(schema, block);
 * ```
 *
 * @param schema - The ProseMirror schema
 * @param block - The block to convert
 * @returns A ProseMirror Node
 */
export function blockToNode(schema: Schema, input: PartialBlock): PMNode {
  const block = normalizeBlock(input);
  const nodeType = schema.nodes[block.type];

  if (!nodeType) {
    // Keep the original block as JSON so it serialises back unchanged.
    const unknownType = schema.nodes.unknownBlock;
    if (!unknownType) {
      console.warn(`Unknown block type: ${block.type}, falling back to paragraph`);
      return schema.node('paragraph', { id: block.id || uuid() });
    }
    warnUnknownOnce('block', block.type);
    return unknownType.create({
      id: block.id || uuid(),
      originalType: block.type,
      propsJson: JSON.stringify(block.props ?? {}),
      contentJson: block.content === undefined ? null : JSON.stringify(block.content),
      childrenJson: block.children === undefined ? null : JSON.stringify(block.children),
    });
  }

  const attrs = splitUnknownAttrs(nodeType.spec.attrs ?? {}, {
    ...propsToAttrs(nodeType.spec.blockPropAliases, block.props),
    id: block.id || uuid(),
  });

  // List items: first paragraph from inline `content`, then optional nested blocks
  if (block.type === 'listItem') {
    const paraContent =
      block.content && block.content.length > 0 ? inlineContentToNodes(schema, block.content) : [];
    const parts: PMNode[] = [schema.node('paragraph', { id: implicitParagraphId(String(attrs.id)) }, paraContent)];
    if (block.children && block.children.length > 0) {
      for (const child of block.children) {
        parts.push(blockToNode(schema, child));
      }
    }
    return nodeType.create(attrs, parts);
  }

  // Handle container blocks with children (lists, columns, etc.)
  if (block.children && block.children.length > 0) {
    const childNodes = block.children.map((child) => blockToNode(schema, child));
    return nodeType.create(attrs, childNodes);
  }

  // Handle check list items - they have inline content directly
  if (block.type === 'checkListItem' && block.content) {
    return nodeType.create(attrs, inlineContentToNodes(schema, block.content));
  }

  // Handle image blocks - they are atomic and use props for src, alt, etc.
  if (block.type === 'image') {
    return nodeType.create(attrs);
  }

  if (block.type === 'tableOfContents') {
    const rawItems = (block.props as { items?: unknown }).items ?? [];
    return nodeType.create({
      id: block.id || uuid(),
      itemsJson: JSON.stringify(rawItems),
    });
  }

  // Handle table cells - they need block content (default to paragraph if only inline content)
  if ((block.type === 'tableCell' || block.type === 'tableHeader') && block.content && !block.children) {
    const paragraph = schema.node(
      'paragraph',
      { id: implicitParagraphId(String(attrs.id)) },
      inlineContentToNodes(schema, block.content)
    );
    return nodeType.create(attrs, [paragraph]);
  }

  // Handle leaf blocks with no content (divider)
  if (!block.content || block.content.length === 0) {
    // Check if node type allows empty content
    if (nodeType.spec.content === '' || nodeType.spec.content === undefined) {
      return nodeType.create(attrs);
    }
    // Otherwise create with empty inline content
    return nodeType.create(attrs, []);
  }

  // Standard blocks with inline content
  const content = inlineContentToNodes(schema, block.content);
  // A node that holds blocks (for example a step's `block+`) gets its inline content wrapped in a paragraph.
  if (!nodeType.inlineContent && nodeType.isBlock && content.length > 0 && schema.nodes.paragraph) {
    const wrapped = schema.node('paragraph', { id: implicitParagraphId(String(attrs.id)) }, content);
    return nodeType.createAndFill(attrs, [wrapped]) ?? nodeType.create(attrs, [wrapped]);
  }
  return nodeType.create(attrs, content);
}

const warnedUnknown = new Set<string>();

/** Logs an unregistered block or inline type once per type name. */
function warnUnknownOnce(kind: 'block' | 'inline', type: string): void {
  const key = `${kind}:${type}`;
  if (warnedUnknown.has(key)) return;
  warnedUnknown.add(key);
  console.warn(
    kind === 'block'
      ? `BeakBlock: unregistered block type "${type}" is kept as an unsupported placeholder (unknownBlock) and is not editable.`
      : `BeakBlock: unregistered inline type "${type}" is kept as an unsupported placeholder (unknownInline) and is not editable.`
  );
}

/**
 * Maps block props to node attrs. A prop named in `aliases` (block prop name to node attr name)
 * is stored under the attr name, so it does not collide with a reserved attr such as `id`.
 */
export function propsToAttrs(
  aliases: Record<string, string> | undefined,
  props: Record<string, unknown>
): Record<string, unknown> {
  const attrs: Record<string, unknown> = { ...props };
  for (const [propName, attrName] of Object.entries(aliases ?? {})) {
    if (!(propName in attrs)) continue;
    attrs[attrName] = attrs[propName];
    delete attrs[propName];
  }
  return attrs;
}

/**
 * Converts inline content to ProseMirror text nodes.
 *
 * @param schema - The ProseMirror schema
 * @param content - Array of inline content items
 * @returns Array of ProseMirror nodes
 */
export function inlineContentToNodes(schema: Schema, content: InlineContent[]): PMNode[] {
  return content.flatMap((raw) => {
    const item = raw as BuiltinInlineContent;
    if (item.type === 'text') {
      // ProseMirror rejects empty text nodes, so empty runs are dropped.
      if (!item.text) return [];
      const marks = stylesToMarks(schema, item.styles);
      return [schema.text(item.text, marks)];
    }

    if (item.type === 'link') {
      const linkMarkType = schema.marks.link;
      if (!linkMarkType) return [];

      const linkMark = linkMarkType.create({
        href: item.href,
        title: item.title ?? null,
        target: item.target ?? null,
      });

      return item.content.flatMap((textItem) => {
        if (!textItem.text) return [];
        const textMarks = stylesToMarks(schema, textItem.styles);
        return [schema.text(textItem.text, [...textMarks, linkMark])];
      });
    }

    if (item.type === 'icon') {
      const iconNodeType = schema.nodes.icon;
      if (!iconNodeType) return item.symbol ? [schema.text(item.symbol)] : [];
      return [iconNodeType.create({
        icon: item.icon,
        symbol: item.symbol,
        size: item.size ?? 36,
      })];
    }

    if (item.type === 'hardBreak') {
      const br = schema.nodes.hardBreak;
      if (!br) return [];
      return [br.create()];
    }

    if (item.type === 'field') {
      const fieldType = schema.nodes.field;
      if (!fieldType) return item.fallback ? [schema.text(item.fallback)] : [];
      return [fieldType.create({
        id: uuid(),
        fieldType: item.fieldType,
        name: item.name ?? null,
        format: item.format ?? null,
        fallback: item.fallback ?? null,
      })];
    }

    // Extension inline node: recreate from the schema by type name
    const custom = raw as UnknownInlineContent;
    const nodeType = schema.nodes[custom.type];
    if (!nodeType || !nodeType.isInline) {
      // Keep the item as an atom holding its JSON, so it serialises back unchanged.
      const unknownType = schema.nodes.unknownInline;
      warnUnknownOnce('inline', custom.type);
      if (!unknownType) return [];
      return [
        unknownType.create({
          originalType: custom.type,
          propsJson: custom.props === undefined ? null : JSON.stringify(custom.props),
          contentJson: custom.content === undefined ? null : JSON.stringify(custom.content),
        }),
      ];
    }
    const children = custom.content ? inlineContentToNodes(schema, custom.content) : undefined;
    const attrs = splitUnknownAttrs(nodeType.spec.attrs ?? {}, { ...(custom.props ?? {}) });
    return [nodeType.create(attrs, children)];
  });
}

/**
 * Converts text styles to ProseMirror marks.
 *
 * @param schema - The ProseMirror schema
 * @param styles - The text styles object
 * @returns Array of ProseMirror marks
 */
export function stylesToMarks(schema: Schema, styles: TextStyles): readonly Mark[] {
  const marks: Mark[] = [];

  if (styles.bold && schema.marks.bold) {
    marks.push(schema.marks.bold.create());
  }
  if (styles.italic && schema.marks.italic) {
    marks.push(schema.marks.italic.create());
  }
  if (styles.underline && schema.marks.underline) {
    marks.push(schema.marks.underline.create());
  }
  if (styles.strikethrough && schema.marks.strikethrough) {
    marks.push(schema.marks.strikethrough.create());
  }
  if (styles.code && schema.marks.code) {
    marks.push(schema.marks.code.create());
  }
  if (styles.textColor && schema.marks.textColor) {
    marks.push(schema.marks.textColor.create({ color: styles.textColor }));
  }
  if (styles.backgroundColor && schema.marks.backgroundColor) {
    marks.push(schema.marks.backgroundColor.create({ color: styles.backgroundColor }));
  }
  if (styles.fontSize && schema.marks.fontSize) {
    marks.push(schema.marks.fontSize.create({ size: styles.fontSize }));
  }
  if (styles.revision) {
    const revision = styles.revision;
    const markName = revision.kind === 'insert' ? 'insertion' : 'deletion';
    const markType = schema.marks[markName];
    if (markType) {
      marks.push(
        markType.create({
          revisionId: revision.revisionId,
          authorId: revision.authorId ?? null,
          authorName: revision.authorName ?? null,
          at: revision.at,
          aiGenerated: revision.aiGenerated === true,
          groupId: revision.groupId ?? null,
        })
      );
    }
  }

  return marks;
}

/**
 * Creates a document from an array of blocks.
 *
 * @param schema - The ProseMirror schema
 * @param blocks - Array of blocks (optional)
 * @returns A ProseMirror document node
 */
export function blocksToDoc(schema: Schema, blocks?: PartialBlock[]): PMNode {
  if (!blocks || blocks.length === 0) {
    // Create empty paragraph as default content
    return schema.node('doc', null, [
      schema.node('paragraph', { id: uuid() }),
    ]);
  }

  const nodes = blocks.map((block) => blockToNode(schema, block));
  return schema.node('doc', null, nodes);
}
