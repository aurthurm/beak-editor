import { describe, expect, it } from 'vitest';

import { markdownToBlocks } from './parse';
import { blocksToHtml } from './toHtml';

describe('blocksToHtml', () => {
  it('renders headings and emphasis from blocks', () => {
    const blocks = markdownToBlocks('# Title\n\nHello **world**.');
    const html = blocksToHtml(blocks);
    expect(html).toContain('<h1');
    expect(html).toContain('Title');
    expect(html).toContain('<strong');
    expect(html).toContain('world');
  });

  it('renders task list markup', () => {
    const blocks = markdownToBlocks('- [x] Done\n- [ ] Todo');
    const html = blocksToHtml(blocks);
    expect(html).toContain('checkbox');
    expect(html).toContain('Done');
    expect(html).toContain('Todo');
  });
});
