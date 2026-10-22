/**
 * Test helpers: block builders and editor setup.
 *
 * @module
 */

import { afterEach } from 'vitest';
import { BeakBlockEditor, type BeakExtension, type Block } from '@amusendame/beakblock-core';

let counter = 0;

/** Returns a unique block id for test fixtures. */
export function nextId(): string {
  counter += 1;
  return `t${counter}`;
}

/** Builds a block with a fresh id. */
export function block(type: string, props: Record<string, unknown> = {}, extra: Partial<Block> = {}): Block {
  return { id: nextId(), type, props, ...extra };
}

/** Builds a paragraph with plain text. */
export function paragraph(text: string): Block {
  return block('paragraph', {}, { content: text ? [{ type: 'text', text, styles: {} }] : [] });
}

/** Builds a procedure step whose text is one paragraph. */
export function step(text: string, props: Record<string, unknown> = {}): Block {
  return block('sopStep', props, { children: [paragraph(text)] });
}

/** Builds a safety warning whose text is one paragraph. */
export function warning(text: string, props: Record<string, unknown> = { level: 'caution' }): Block {
  return block('safetyWarning', props, { children: [paragraph(text)] });
}

/** Builds a table cell (or header cell) with plain text. */
export function cell(text: string, header = false): Block {
  return block(header ? 'tableHeader' : 'tableCell', {}, { children: [paragraph(text)] });
}

/** Builds a reagent table block from rows of text; the first row is the header. */
export function reagentTable(rows: string[][], props: Record<string, unknown> = {}): Block {
  const tableRows = rows.map((row, index) =>
    block('tableRow', { isHeader: index === 0 }, { children: row.map((text) => cell(text, index === 0)) })
  );
  return block('reagentTable', props, { children: [block('table', {}, { children: tableRows })] });
}

const editors: BeakBlockEditor[] = [];

/** Creates a mounted editor with the given extensions and removes it after each test. */
export function createEditor(extensions: BeakExtension[], initialContent?: Block[]): BeakBlockEditor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new BeakBlockEditor({ element, extensions, initialContent });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  document.body.innerHTML = '';
});

/** Waits for pending microtasks and a macrotask (plugin view initialisation, provider lookups). */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Finds a block by type in a block tree, depth first. */
export function findBlock(blocks: Block[], type: string): Block | undefined {
  for (const item of blocks) {
    if (item.type === type) return item;
    const nested = item.children ? findBlock(item.children, type) : undefined;
    if (nested) return nested;
  }
  return undefined;
}
