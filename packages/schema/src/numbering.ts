/**
 * Default numbering definitions: bullets, decimal lists, heading outline and checkboxes.
 *
 * @module
 */

import type { AbstractNumbering, NumberFormat, NumberingDefinitions, NumberingLevel } from './types';

/** Well-known `numId` values in {@link createDefaultNumbering}. */
export const NUMBERING_IDS = {
  bullet: '1',
  decimal: '2',
  heading: '3',
  checklist: '4',
} as const;

/** Well-known abstract numbering ids. */
export const ABSTRACT_NUMBERING_IDS = {
  bullet: 'bullet',
  decimal: 'decimal',
  heading: 'heading',
  checklist: 'checklist',
} as const;

const BULLET_GLYPHS = ['•', '◦', '▪'];
const DECIMAL_FORMATS: readonly NumberFormat[] = ['decimal', 'lowerLetter', 'lowerRoman'];

function bulletLevels(count: number): NumberingLevel[] {
  return Array.from({ length: count }, (_value, level) => ({
    level,
    format: 'bullet' as const,
    text: BULLET_GLYPHS[level % BULLET_GLYPHS.length],
    start: 1,
    indent: { leftPt: 18 * (level + 1), hangingPt: 18 },
  }));
}

function decimalLevels(count: number): NumberingLevel[] {
  return Array.from({ length: count }, (_value, level) => ({
    level,
    format: DECIMAL_FORMATS[level % DECIMAL_FORMATS.length],
    text: `%${level + 1}.`,
    start: 1,
    indent: { leftPt: 18 * (level + 1), hangingPt: 18 },
  }));
}

function headingLevels(count: number): NumberingLevel[] {
  return Array.from({ length: count }, (_value, level) => ({
    level,
    format: 'decimal' as const,
    text: Array.from({ length: level + 1 }, (_part, index) => `%${index + 1}`).join('.'),
    start: 1,
    indent: { leftPt: 36 + 6 * level, hangingPt: 36 + 6 * level },
    paraStyleId: `Heading${level + 1}`,
  }));
}

/**
 * Creates the default numbering: a bullet list (`numId` "1"), a decimal list
 * ("2"), a heading outline 1 / 1.1 / 1.1.1 linked to Heading1-6 ("3"), and a
 * checkbox list ("4").
 *
 * @example
 * ```typescript
 * const numbering = createDefaultNumbering();
 * numbering.instances[NUMBERING_IDS.heading]; // { abstractId: 'heading' }
 * ```
 */
export function createDefaultNumbering(): NumberingDefinitions {
  const abstract: Record<string, AbstractNumbering> = {
    [ABSTRACT_NUMBERING_IDS.bullet]: {
      id: ABSTRACT_NUMBERING_IDS.bullet,
      name: 'Bullets',
      multiLevelType: 'hybridMultilevel',
      levels: bulletLevels(9),
    },
    [ABSTRACT_NUMBERING_IDS.decimal]: {
      id: ABSTRACT_NUMBERING_IDS.decimal,
      name: 'Numbered',
      multiLevelType: 'hybridMultilevel',
      levels: decimalLevels(9),
    },
    [ABSTRACT_NUMBERING_IDS.heading]: {
      id: ABSTRACT_NUMBERING_IDS.heading,
      name: 'Heading outline',
      multiLevelType: 'multilevel',
      levels: headingLevels(6),
    },
    [ABSTRACT_NUMBERING_IDS.checklist]: {
      id: ABSTRACT_NUMBERING_IDS.checklist,
      name: 'Checklist',
      multiLevelType: 'singleLevel',
      levels: [{ level: 0, format: 'bullet', text: '☐', start: 1, indent: { leftPt: 18, hangingPt: 18 } }],
    },
  };

  return {
    abstract,
    instances: {
      [NUMBERING_IDS.bullet]: { abstractId: ABSTRACT_NUMBERING_IDS.bullet },
      [NUMBERING_IDS.decimal]: { abstractId: ABSTRACT_NUMBERING_IDS.decimal },
      [NUMBERING_IDS.heading]: { abstractId: ABSTRACT_NUMBERING_IDS.heading },
      [NUMBERING_IDS.checklist]: { abstractId: ABSTRACT_NUMBERING_IDS.checklist },
    },
  };
}
