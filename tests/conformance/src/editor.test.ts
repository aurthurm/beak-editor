/**
 * Editor suite: every corpus document loads into a real BeakBlockEditor (jsdom) with the
 * extensions it needs, and `getDocument()` returns an equivalent document after `setDocument()`.
 *
 * Equivalence is `canonicalEditorBlocks` (support/canonical.ts), which documents each normalisation.
 * Editor defects still open are asserted with `it.fails` and named in KNOWN_EDITOR_BUGS, so the suite stays
 * green while they exist and goes red when they are fixed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blocksToDoc, BeakBlockEditor, type BeakExtension, type Block } from '@amusendame/beakblock-core';
import { clinicalExtension, formsExtension } from '@amusendame/beakblock-blocks-clinical';
import { officeBlocksExtension } from '@amusendame/beakblock-blocks-office';
import { qmsExtension, SIGNATURE_SERVICE_META } from '@amusendame/beakblock-blocks-qms';
import { reviewExtension } from '@amusendame/beakblock-review';

import { corpus, cloneBlocks } from './corpus';
import { canonicalEditorBlocks } from './support/canonical';
import { deepDiff, formatDiff } from './support/deepDiff';

/**
 * Every extension family, so each document loads as it would in the full editor. Review is added
 * in view-only mode because the corpus is loaded for reading, not for tracking new edits.
 */
function allExtensions(): BeakExtension[] {
  return [
    clinicalExtension({}),
    formsExtension({}),
    officeBlocksExtension({}),
    qmsExtension({}),
    reviewExtension({ enabled: false, author: { id: 'reader', name: 'Reader' } }),
  ];
}

/** Known editor defects that make the whole document fail, keyed by corpus id. */
const KNOWN_EDITOR_BUGS: Record<string, string> = {
  'pathological-unknown-types':
    'unregistered block types (hologram, telemetry) load as empty paragraphs and unknown inline nodes are dropped, silently',
};

/**
 * Corpus documents that were released and saved with signed signatures. They load with
 * `trustedLoad: true`; a default `setDocument` must refuse them.
 */
const TRUSTED_LOAD_IDS = new Set(['qms-release']);

/** Loads blocks as the QMS service does: the signature-service meta lets signed signatures in. */
function loadAsSignatureService(editor: BeakBlockEditor, blocks: Block[]): void {
  const doc = blocksToDoc(editor.pm.state.schema, blocks);
  const tr = editor.pm.createTransaction();
  tr.setMeta(SIGNATURE_SERVICE_META, true);
  tr.replaceWith(0, editor.pm.doc.content.size, doc.content);
  editor.pm.dispatch(tr);
}

describe('editor: corpus loads and round-trips through getDocument()', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  for (const entry of corpus) {
    const bug = KNOWN_EDITOR_BUGS[entry.id];
    const runner = bug ? it.fails : it;
    runner(`${entry.id} setDocument -> getDocument is equivalent${bug ? ` [known bug: ${bug}]` : ''}`, () => {
      const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: entry.meta.category === 'controlled' ? 'controlled' : 'office', extensions: allExtensions() });
      try {
        editor.setDocument(cloneBlocks(entry.blocks), { trustedLoad: TRUSTED_LOAD_IDS.has(entry.id) });
        const diffs = deepDiff(canonicalEditorBlocks(entry.blocks), canonicalEditorBlocks(editor.getDocument()));
        expect(diffs.length, `${entry.id}:\n${formatDiff(diffs)}`).toBe(0);
      } finally {
        editor.destroy();
      }
    });
  }

  it('signed signature blocks load through the signature service (props.id excepted, see below)', () => {
    const entry = corpus.find((c) => c.id === 'qms-release')!;
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: allExtensions() });
    try {
      loadAsSignatureService(editor, cloneBlocks(entry.blocks));
      const diffs = deepDiff(canonicalEditorBlocks(entry.blocks), canonicalEditorBlocks(editor.getDocument()));
      expect(diffs.length, formatDiff(diffs)).toBe(0);
    } finally {
      editor.destroy();
    }
  });

  it('second setDocument -> getDocument cycle is stable for every document', () => {
    for (const entry of corpus) {
      const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office', extensions: allExtensions() });
      try {
        editor.setDocument(cloneBlocks(entry.blocks));
        const first = canonicalEditorBlocks(editor.getDocument());
        editor.setDocument(structuredClone(first) as Block[]);
        expect(canonicalEditorBlocks(editor.getDocument()), entry.id).toStrictEqual(first);
      } finally {
        editor.destroy();
      }
    }
  });

  it('switching modes does not change the document', () => {
    const entry = corpus.find((c) => c.id === 'lab-gram-stain')!;
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'block', extensions: allExtensions() });
    try {
      editor.setDocument(cloneBlocks(entry.blocks));
      const before = canonicalEditorBlocks(editor.getDocument());
      for (const mode of ['office', 'controlled', 'block'] as const) {
        editor.setMode(mode);
        expect(editor.getMode()).toBe(mode);
        expect(container.querySelector('[data-beakblock-mode]')?.getAttribute('data-beakblock-mode')).toBe(mode);
      }
      expect(canonicalEditorBlocks(editor.getDocument())).toStrictEqual(before);
    } finally {
      editor.destroy();
    }
  });

  it('extension block types are registered in the block registry', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office', extensions: allExtensions() });
    try {
      for (const type of ['equation', 'caption', 'sopStep', 'safetyWarning', 'controlledSection', 'signatureBlock', 'approvalBlock', 'repeatingSection']) {
        expect(editor.blockRegistry.has(type), type).toBe(true);
      }
    } finally {
      editor.destroy();
    }
  });
});

describe('editor: specific load behaviour', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('a released document with signed signatures loads with trustedLoad: true', () => {
    const entry = corpus.find((c) => c.id === 'qms-release')!;
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: allExtensions() });
    try {
      editor.setDocument(cloneBlocks(entry.blocks), { trustedLoad: true });
      expect(editor.getDocument().length).toBe(entry.blocks.length);
      expect(editor.getDocument().some((b) => b.type === 'signatureBlock' && b.props.signatureId)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('a default setDocument refuses a signed signature block, warns, and keeps the old document', () => {
    const entry = corpus.find((c) => c.id === 'qms-release')!;
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: allExtensions() });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const before = canonicalEditorBlocks(editor.getDocument());
      editor.setDocument(cloneBlocks(entry.blocks));
      expect(canonicalEditorBlocks(editor.getDocument())).toStrictEqual(before);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      editor.destroy();
    }
  });

  it('a sopStep with inline content (not block children) keeps its text', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office', extensions: allExtensions() });
    try {
      editor.setDocument([
        { id: 'o1', type: 'orderedList', props: { start: 1 }, children: [{ id: 'o2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'a', styles: {} }] }] },
        { id: 's1', type: 'sopStep', props: { stepNumber: 1 }, content: [{ type: 'text', text: 'Keep me', styles: {} }] },
      ] as Block[]);
      expect(JSON.stringify(editor.getDocument())).toContain('Keep me');
    } finally {
      editor.destroy();
    }
  });

  it('caption number survives load', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office', extensions: allExtensions() });
    try {
      editor.setDocument([{ id: 'c1', type: 'caption', props: { label: 'Figure', number: 3 }, content: [{ type: 'text', text: 'x', styles: {} }] }] as Block[]);
      expect(editor.getDocument()[0].props.number).toBe(3);
    } finally {
      editor.destroy();
    }
  });

  it('QMS atom props.id survives load when it differs from the block id', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: allExtensions() });
    try {
      loadAsSignatureService(editor, [{ id: 'block-1', type: 'acknowledgement', props: { id: 'ack-7', statement: 'Read.', required: true } }] as Block[]);
      expect(editor.getDocument()[0].props.id).toBe('ack-7');
    } finally {
      editor.destroy();
    }
  });
});
