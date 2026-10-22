// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { blocksToMarkdown, markdownToBlocks } from './index';

describe('core in a Node environment (no DOM)', () => {
  it('imports the markdown conversion without touching document or window', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(typeof markdownToBlocks).toBe('function');
    expect(typeof blocksToMarkdown).toBe('function');
  });

  it('converts markdown to blocks and back', () => {
    const md = '# Title\n\nHello **world**.\n\n- first\n- second\n';
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe('heading');
    expect(blocks.map((b) => b.type)).toContain('bulletList');

    const out = blocksToMarkdown(blocks);
    expect(out).toContain('# Title');
    expect(out).toContain('**world**');
    expect(out).toContain('first');
    expect(out).toContain('second');
  });
});
