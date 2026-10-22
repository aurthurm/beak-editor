import { describe, expect, it } from 'vitest';

import {
  MigrationRegistry,
  blocksToDocument,
  createDefaultStyleSheet,
  documentToBlocks,
  fixtures,
  migrateDocument,
  richSopBlocks,
  richSopBlocksWithSections,
  validateDocumentStructure,
} from './index';
import type { Block, BeakDocument } from './index';
import { cloneJson } from '@amusendame/beakblock-core';

const clone = <T>(value: T): T => cloneJson(value);

describe('migrateDocument: v1 losslessness', () => {
  it('round-trips the rich fixture through blocksToDocument/documentToBlocks', () => {
    const input = clone(richSopBlocks);
    const doc = migrateDocument(input);
    expect(doc.schemaVersion).toBe(2);
    expect(doc.sections).toHaveLength(1);
    expect(documentToBlocks(doc)).toEqual(input);
  });

  it('accepts the wrapped {schemaVersion: 1, blocks} form', () => {
    const input = clone(richSopBlocks);
    const doc = migrateDocument({ schemaVersion: 1, blocks: input });
    expect(documentToBlocks(doc)).toEqual(input);
  });

  it('accepts a v2 document unchanged and fills missing defaults', () => {
    const doc = migrateDocument(migrateDocument(richSopBlocks));
    const bare = { schemaVersion: 2, id: 'x', sections: doc.sections } as unknown as BeakDocument;
    const filled = migrateDocument(bare);
    expect(filled.sections).toEqual(doc.sections);
    expect(filled.styles.paragraph.Normal).toBeDefined();
    expect(filled.numbering.instances['1']).toBeDefined();
    expect(filled.properties).toEqual({});
  });

  it('does not mutate its input', () => {
    const input = clone(richSopBlocks);
    const snapshot = clone(input);
    migrateDocument(input);
    expect(input).toEqual(snapshot);
  });

  it('rejects unrecognised input and future versions', () => {
    expect(() => migrateDocument('nope')).toThrow(TypeError);
    expect(() => migrateDocument({ foo: 1 })).toThrow(TypeError);
    expect(() => migrateDocument({ schemaVersion: 9, sections: [] })).toThrow(RangeError);
  });
});

describe('sectionBreak splitting', () => {
  it('splits the rich fixture into two sections at sectionBreak', () => {
    const doc = migrateDocument(clone(richSopBlocksWithSections));
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[1].id).toBe('sb-appendix');
    expect(doc.sections[1].pageSetup.orientation).toBe('landscape');
    expect(doc.sections[1].blocks[0].id).toBe('h-appendix');
    expect(doc.sections[0].blocks.some((block) => block.type === 'sectionBreak')).toBe(false);
  });

  it('re-emits the sectionBreak with the next section pageSetup', () => {
    const blocks = documentToBlocks(migrateDocument(clone(richSopBlocksWithSections)));
    expect(blocks).toEqual(richSopBlocksWithSections);
  });

  it('uses the first section page setup option and generates a default when breaks lack one', () => {
    const blocks: Block[] = [
      { id: 'p1', type: 'paragraph', props: {}, content: [] },
      { id: 'sb', type: 'sectionBreak', props: { pageSetup: null } },
      { id: 'p2', type: 'paragraph', props: {} },
    ];
    const doc = blocksToDocument(blocks, { firstSectionId: 'first' });
    expect(doc.sections.map((section) => section.id)).toEqual(['first', 'sb']);
    expect(doc.sections[1].pageSetup.size.widthTwips).toBe(11906);
  });
});

describe('MigrationRegistry', () => {
  it('registers steps and migrates through the chain', () => {
    const registry = new MigrationRegistry({ currentVersion: 4 })
      .register(1, (doc) => ({ ...(doc as object), step: 2 }))
      .register(2, (doc) => ({ ...(doc as object), step: 3 }))
      .register(3, (doc) => ({ ...(doc as object), step: 4 }));
    expect(registry.versions()).toEqual([1, 2, 3]);
    expect(registry.migrate({ v: 1 }, 1)).toEqual({ v: 1, step: 4 });
    expect(registry.migrate({ v: 1 }, 2, 3)).toEqual({ v: 1, step: 3 });
  });

  it('refuses duplicate steps, missing steps and downgrades', () => {
    const registry = new MigrationRegistry({ currentVersion: 3 }).register(1, (doc) => doc);
    expect(() => registry.register(1, (doc) => doc)).toThrow();
    expect(() => registry.register(0, (doc) => doc)).toThrow(RangeError);
    expect(() => registry.migrate({}, 2)).toThrow(/No migration/);
    expect(() => registry.migrate({}, 3, 1)).toThrow(RangeError);
  });

  it('migrates documents through a custom registry for a future version', () => {
    const v2 = migrateDocument(richSopBlocks);
    const registry = new MigrationRegistry({ currentVersion: 3 }).register(2, (doc) => ({
      ...(doc as object),
      schemaVersion: 3,
      marker: 'v3',
    }));
    const upgraded = registry.migrate(v2, 2) as Record<string, unknown>;
    expect(upgraded.marker).toBe('v3');
  });
});

describe('validateDocumentStructure', () => {
  it('reports no errors for the rich fixture', () => {
    const issues = validateDocumentStructure(migrateDocument(clone(richSopBlocks)));
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('reports duplicate block ids, unknown styles, numbering and missing sections', () => {
    const doc = migrateDocument(clone(richSopBlocks));
    doc.sections[0].blocks.push({ id: 'h-purpose', type: 'paragraph', props: { styleId: 'NoSuchStyle' } });
    doc.sections[0].blocks.push({
      id: 'bad-num',
      type: 'paragraph',
      props: { numbering: { numId: '99', level: 0 } },
    });
    doc.sections[0].blocks.push({
      id: 'bad-level',
      type: 'paragraph',
      props: { numbering: { numId: '1', level: 42 } },
    });
    doc.sections[0].blocks.push({ id: 'bad-table', type: 'table', props: { styleId: 'Ghost' }, children: [] });

    const codes = validateDocumentStructure(doc).map((issue) => issue.code);
    expect(codes).toContain('duplicate-block-id');
    expect(codes).toContain('unknown-style');
    expect(codes).toContain('unknown-numbering');
    expect(codes).toContain('invalid-numbering-level');
    expect(codes).toContain('unknown-table-style');

    const empty = { ...doc, sections: [] } as BeakDocument;
    expect(validateDocumentStructure(empty).map((issue) => issue.code)).toContain('missing-sections');
  });

  it('reports duplicate section ids, style cycles and dangling basedOn references', () => {
    const doc = migrateDocument(clone(richSopBlocksWithSections));
    doc.sections[1].id = doc.sections[0].id;
    const styles = createDefaultStyleSheet();
    styles.paragraph.Normal.basedOn = 'Heading1';
    styles.paragraph.Quote.basedOn = 'Missing';
    doc.styles = styles;

    const codes = validateDocumentStructure(doc).map((issue) => issue.code);
    expect(codes).toContain('duplicate-section-id');
    expect(codes).toContain('style-cycle');
    expect(codes).toContain('unknown-base-style');
  });

  it('exposes the fixture namespace', () => {
    expect(fixtures.richSopBlocks).toBe(richSopBlocks);
    expect(fixtures.richSopBlocksWithSections).toBe(richSopBlocksWithSections);
  });
});
