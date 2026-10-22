import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import { DecorationSet, EditorView } from 'prosemirror-view';
import { describe, expect, it } from 'vitest';

import { PORTRAIT_SETUP } from './__fixtures__/builders';
import { contentHeightPx, createPaginationPlugin, paginationPluginKey } from './pagination-plugin';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }] },
    text: { group: 'inline' },
  },
});

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('pagination plugin', () => {
  it('computes the content height of A4 with one-inch margins in pixels', () => {
    // 841.9pt page height minus 144pt of margins = 697.9pt of content.
    expect(contentHeightPx(PORTRAIT_SETUP)).toBeCloseTo(697.9 * (96 / 72), 1);
  });

  it('draws boundaries from injected block heights and never changes the document', async () => {
    const paragraphs = Array.from({ length: 30 }, (_value, index) =>
      schema.node('paragraph', null, schema.text(`Paragraph ${index}`))
    );
    const doc = schema.node('doc', null, paragraphs);
    const docBefore = JSON.stringify(doc.toJSON());
    const plugin = createPaginationPlugin({
      pageSetup: PORTRAIT_SETUP,
      measureBlock: () => 100,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const transactions: Transaction[] = [];
    const view = new EditorView(container, {
      state: EditorState.create({ schema, doc, plugins: [plugin] }),
      dispatchTransaction(tr) {
        transactions.push(tr);
        view.updateState(view.state.apply(tr));
      },
    });
    const docRef = view.state.doc;
    await flush();

    const state = paginationPluginKey.getState(view.state);
    // 930px per page holds nine 100px blocks: breaks before blocks 9, 18, and 27.
    const offsetOf = (childIndex: number) => {
      let offset = 0;
      for (let index = 0; index < childIndex; index += 1) offset += doc.child(index).nodeSize;
      return offset;
    };
    expect(state?.breaks).toEqual([offsetOf(9), offsetOf(18), offsetOf(27)]);
    const decorations = view.someProp('decorations', (fn) => fn(view.state)) as DecorationSet | undefined;
    expect(decorations?.find().length).toBe(3);

    expect(view.state.doc).toBe(docRef);
    expect(JSON.stringify(view.state.doc.toJSON())).toBe(docBefore);
    expect(transactions.every((tr) => !tr.docChanged)).toBe(true);
    view.destroy();
    container.remove();
  });
});
