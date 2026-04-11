import { describe, expect, it } from 'vitest';

import { blocksToMarkdown } from './toMarkdown';
import { markdownToBlocks } from './parse';
import { looksLikeMarkdown } from './heuristic';

describe('markdownToBlocks', () => {
  it('parses headings and paragraphs', () => {
    const blocks = markdownToBlocks('# Title\n\nHello **world**.');
    expect(blocks[0]?.type).toBe('heading');
    expect(blocks[0]?.props).toMatchObject({ level: 1 });
    expect(blocks[1]?.type).toBe('paragraph');
    const content = blocks[1]?.content;
    expect(content?.some((c) => c.type === 'text' && c.styles.bold && c.text === 'world')).toBe(true);
  });

  it('parses GFM task lists', () => {
    const blocks = markdownToBlocks('- [x] Done\n- [ ] Todo');
    expect(blocks[0]?.type).toBe('checkList');
    const ch = blocks[0]?.children;
    expect(ch?.[0]?.type).toBe('checkListItem');
    expect(ch?.[0]?.props).toMatchObject({ checked: true });
    expect(ch?.[1]?.props).toMatchObject({ checked: false });
  });
});

describe('blocksToMarkdown', () => {
  it('round-trips a simple document', () => {
    const md = '# Hi\n\n- a\n- b\n';
    const back = blocksToMarkdown(markdownToBlocks(md));
    expect(back).toContain('# Hi');
    expect(back).toMatch(/[-*] a/);
    expect(back).toMatch(/[-*] b/);
  });
});

describe('looksLikeMarkdown', () => {
  it('detects fences and headings', () => {
    expect(looksLikeMarkdown('```js\nx\n```')).toBe(true);
    expect(looksLikeMarkdown('# Hello')).toBe(true);
    expect(looksLikeMarkdown('Just a sentence.')).toBe(false);
  });
});
