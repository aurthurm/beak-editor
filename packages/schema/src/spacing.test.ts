import { describe, expect, it } from 'vitest';

import {
  blocksToDocument,
  createDefaultStyleSheet,
  documentToBlocks,
  migrateDocument,
  normalizeLineSpacing,
  resolveParagraphStyle,
} from './index';
import type { Block } from './index';

describe('line spacing units', () => {
  it('stores default auto line spacing in 240ths', () => {
    const styles = createDefaultStyleSheet();
    expect(styles.paragraph.Normal.paraProps?.spacing?.line).toBe(276);
    expect(styles.paragraph.Heading1.paraProps?.spacing?.line).toBe(240);
    expect(styles.paragraph.Heading2.paraProps?.spacing?.line).toBe(240);
    expect(styles.paragraph.Code.paraProps?.spacing?.line).toBe(240);
  });

  it('normalises legacy multipliers to 240ths', () => {
    expect(normalizeLineSpacing({ beforePt: 0, afterPt: 8, line: 1.15, lineRule: 'auto' }).line).toBe(276);
    expect(normalizeLineSpacing({ beforePt: 0, afterPt: 0, line: 1.5, lineRule: 'auto' }).line).toBe(360);
    expect(normalizeLineSpacing({ beforePt: 0, afterPt: 0, line: 276, lineRule: 'auto' }).line).toBe(276);
  });

  it('leaves exact and atLeast values untouched', () => {
    expect(normalizeLineSpacing({ beforePt: 0, afterPt: 0, line: 5, lineRule: 'exact' }).line).toBe(5);
    expect(normalizeLineSpacing({ beforePt: 0, afterPt: 0, line: 300, lineRule: 'atLeast' }).line).toBe(300);
  });

  it('does not mutate its input', () => {
    const input = { beforePt: 0, afterPt: 0, line: 1.15, lineRule: 'auto' as const };
    normalizeLineSpacing(input);
    expect(input.line).toBe(1.15);
  });

  it('migrates legacy block and style spacing to 240ths', () => {
    const legacy: Block[] = [
      {
        id: 'p-1',
        type: 'paragraph',
        props: { spacing: { beforePt: 6, afterPt: 6, line: 1.15, lineRule: 'auto' } },
        content: [{ type: 'text', text: 'Legacy' }],
      } as unknown as Block,
    ];
    const doc = migrateDocument(legacy);
    const migrated = documentToBlocks(doc)[0] as unknown as { props: { spacing: { line: number } } };
    expect(migrated.props.spacing.line).toBe(276);

    const styles = createDefaultStyleSheet();
    styles.paragraph.Normal.paraProps = { spacing: { beforePt: 0, afterPt: 8, line: 1.15, lineRule: 'auto' } };
    const withStyles = blocksToDocument([], { styles });
    expect(withStyles.styles.paragraph.Normal.paraProps?.spacing?.line).toBe(276);
  });

  it('normalises legacy spacing when resolving a style', () => {
    const styles = createDefaultStyleSheet();
    styles.paragraph.Legacy = {
      id: 'Legacy',
      name: 'Legacy',
      basedOn: null,
      paraProps: { spacing: { beforePt: 0, afterPt: 0, line: 1.5, lineRule: 'auto' } },
    };
    expect(resolveParagraphStyle(styles, 'Legacy')?.paraProps.spacing?.line).toBe(360);
  });
});
