import { describe, expect, it } from 'vitest';

import { blocksToMarkdown } from './toMarkdown';
import { markdownToBlocks } from './parse';
import { looksLikeMarkdown } from './heuristic';

describe('markdownToBlocks', () => {
  it('parses beakblock-lock HTML comment before a heading', () => {
    const md = '<!-- beakblock-lock reason="policy" lockId="x" -->\n\n# Title\n\n';
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe('heading');
    expect(blocks[0]?.props).toMatchObject({
      level: 1,
      locked: true,
      lockReason: 'policy',
      lockId: 'x',
    });
  });

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
  it('emits lock comment before locked headings', () => {
    const md = blocksToMarkdown([
      {
        id: 'h',
        type: 'heading',
        props: { level: 1, locked: true, lockReason: 'r1' },
        content: [{ type: 'text', text: 'T', styles: {} }],
      },
    ]);
    expect(md).toContain('<!-- beakblock-lock');
    expect(md).toContain('beakblock-lock');
    expect(md).toContain('# T');
    const back = markdownToBlocks(md);
    expect(back[0]?.props?.locked).toBe(true);
    expect(back[0]?.props?.lockReason).toBe('r1');
  });

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
