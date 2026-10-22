import { describe, expect, it } from 'vitest';

import {
  PAGE_SIZES,
  createDefaultNumbering,
  createDefaultPageSetup,
  createDefaultStyleSheet,
  createPageSetup,
  fontStack,
  mmToTwips,
  ptToTwips,
  pxToTwips,
  resolveParagraphStyle,
  twipsToPt,
  twipsToPx,
  NUMBERING_IDS,
} from './index';
import type { StyleSheet } from './index';

describe('units', () => {
  it('converts points and twips', () => {
    expect(ptToTwips(12)).toBe(240);
    expect(twipsToPt(240)).toBe(12);
    expect(ptToTwips(0.5)).toBe(10);
  });

  it('converts pixels at 96 dpi (1px = 15 twips)', () => {
    expect(twipsToPx(1440)).toBe(96);
    expect(pxToTwips(96)).toBe(1440);
    expect(pxToTwips(1)).toBe(15);
  });

  it('converts millimetres', () => {
    expect(mmToTwips(25.4)).toBe(1440);
    expect(mmToTwips(210)).toBe(11906);
  });
});

describe('page setup', () => {
  it('defines A4, Letter, Legal and A3 in twips', () => {
    expect(PAGE_SIZES.A4).toEqual({ widthTwips: 11906, heightTwips: 16838 });
    expect(PAGE_SIZES.Letter).toEqual({ widthTwips: 12240, heightTwips: 15840 });
    expect(Object.keys(PAGE_SIZES).sort()).toEqual(['A3', 'A4', 'Legal', 'Letter']);
  });

  it('creates an A4 portrait default with 1 inch margins', () => {
    const setup = createDefaultPageSetup();
    expect(setup.size).toEqual(PAGE_SIZES.A4);
    expect(setup.orientation).toBe('portrait');
    expect(setup.margins.top).toBe(1440);
    expect(setup.margins.header).toBe(720);
  });

  it('swaps dimensions for landscape and applies margin overrides', () => {
    const setup = createPageSetup({ size: 'Letter', orientation: 'landscape', margins: { left: 720 } });
    expect(setup.size).toEqual({ widthTwips: 15840, heightTwips: 12240 });
    expect(setup.margins.left).toBe(720);
    expect(setup.margins.right).toBe(1440);
  });
});

describe('style sheet', () => {
  const styles = createDefaultStyleSheet();

  it('contains the required paragraph styles', () => {
    for (const id of [
      'Normal',
      'Heading1',
      'Heading2',
      'Heading3',
      'Heading4',
      'Heading5',
      'Heading6',
      'Title',
      'Caption',
      'ListParagraph',
      'TOC1',
      'TOC2',
      'TOC3',
      'Quote',
      'Callout',
      'Code',
      'Divider',
    ]) {
      expect(styles.paragraph[id], id).toBeDefined();
    }
    expect(styles.table.TableGrid).toBeDefined();
  });

  it('bases headings on Normal', () => {
    for (let level = 1; level <= 6; level += 1) {
      expect(styles.paragraph[`Heading${level}`].basedOn).toBe('Normal');
    }
  });

  it('uses bundled metric-compatible fonts with fallbacks', () => {
    expect(styles.paragraph.Normal.runProps?.font).toBe('Carlito');
    expect(styles.paragraph.Code.runProps?.font).toBe('Liberation Mono');
    expect(fontStack('Caladea')).toContain('"Cambria"');
    expect(fontStack('Caladea')).toMatch(/serif$/);
  });

  it('resolves inherited properties for a heading', () => {
    const heading = resolveParagraphStyle(styles, 'Heading2');
    expect(heading).not.toBeNull();
    expect(heading?.chain).toEqual(['Heading2', 'Normal']);
    expect(heading?.runProps.font).toBe('Carlito');
    expect(heading?.runProps.sizePt).toBe(14);
    expect(heading?.paraProps.keepNext).toBe(true);
    expect(heading?.paraProps.spacing?.lineRule).toBe('auto');
  });

  it('returns null for unknown or empty style ids', () => {
    expect(resolveParagraphStyle(styles, 'Nope')).toBeNull();
    expect(resolveParagraphStyle(styles, '')).toBeNull();
    expect(resolveParagraphStyle(styles, undefined)).toBeNull();
  });

  it('lets derived styles override base properties', () => {
    const custom: StyleSheet = {
      paragraph: {
        Base: { id: 'Base', name: 'Base', basedOn: null, runProps: { sizePt: 10, color: 'FF0000' } },
        Mid: { id: 'Mid', name: 'Mid', basedOn: 'Base', runProps: { sizePt: 12 } },
        Leaf: { id: 'Leaf', name: 'Leaf', basedOn: 'Mid', paraProps: { keepNext: true } },
      },
      character: {},
      table: {},
    };
    const leaf = resolveParagraphStyle(custom, 'Leaf');
    expect(leaf?.chain).toEqual(['Leaf', 'Mid', 'Base']);
    expect(leaf?.runProps).toEqual({ sizePt: 12, color: 'FF0000' });
    expect(leaf?.paraProps).toEqual({ keepNext: true });
  });

  it('terminates on basedOn cycles', () => {
    const cyclic: StyleSheet = {
      paragraph: {
        A: { id: 'A', name: 'A', basedOn: 'B', runProps: { bold: true } },
        B: { id: 'B', name: 'B', basedOn: 'A', runProps: { italic: true } },
      },
      character: {},
      table: {},
    };
    const resolved = resolveParagraphStyle(cyclic, 'A');
    expect(resolved?.chain).toEqual(['A', 'B']);
    expect(resolved?.runProps).toEqual({ bold: true, italic: true });
  });

  it('terminates on a self-referencing style and on dangling basedOn', () => {
    const self: StyleSheet = {
      paragraph: { S: { id: 'S', name: 'S', basedOn: 'S', runProps: { sizePt: 9 } } },
      character: {},
      table: {},
    };
    expect(resolveParagraphStyle(self, 'S')?.chain).toEqual(['S']);

    const dangling: StyleSheet = {
      paragraph: { D: { id: 'D', name: 'D', basedOn: 'Missing' } },
      character: {},
      table: {},
    };
    expect(resolveParagraphStyle(dangling, 'D')?.chain).toEqual(['D']);
  });
});

describe('numbering', () => {
  const numbering = createDefaultNumbering();

  it('defines bullet, decimal, heading and checklist instances', () => {
    expect(numbering.instances[NUMBERING_IDS.bullet].abstractId).toBe('bullet');
    expect(numbering.instances[NUMBERING_IDS.decimal].abstractId).toBe('decimal');
    expect(numbering.instances[NUMBERING_IDS.heading].abstractId).toBe('heading');
    expect(numbering.instances[NUMBERING_IDS.checklist].abstractId).toBe('checklist');
  });

  it('uses bullet glyphs for bullets and decimal formats for ordered lists', () => {
    expect(numbering.abstract.bullet.levels[0].format).toBe('bullet');
    expect(numbering.abstract.decimal.levels[0].format).toBe('decimal');
    expect(numbering.abstract.decimal.levels[1].format).toBe('lowerLetter');
  });

  it('builds a 1 / 1.1 / 1.1.1 heading pattern linked to Heading styles', () => {
    const heading = numbering.abstract.heading.levels;
    expect(heading[0].text).toBe('%1');
    expect(heading[1].text).toBe('%1.%2');
    expect(heading[2].text).toBe('%1.%2.%3');
    expect(heading[2].paraStyleId).toBe('Heading3');
  });
});

describe('default stylesheet and numbering are independent copies', () => {
  it('returns fresh objects on every call', () => {
    const a = createDefaultStyleSheet();
    a.paragraph.Normal.runProps = { sizePt: 99 };
    expect(createDefaultStyleSheet().paragraph.Normal.runProps?.sizePt).toBe(11);
  });
});
