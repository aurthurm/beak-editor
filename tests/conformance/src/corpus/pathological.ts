/**
 * Pathological inputs: empty blocks, very deep nesting, a 10k-character paragraph, unknown block and
 * inline types, and emoji, zero-width and control characters. Invented content.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { docBuilder } from './builders';

/** Empty blocks everywhere: empty content arrays, empty headings, empty list items and table cells. */
export function emptyBlocks(): Block[] {
  const b = docBuilder('empty');
  return [
    b.p([]),
    b.h(2, ''),
    b.p(''),
    b.ul(['', { text: '' }]),
    b.block('checkList', {}, undefined, []),
    b.block('blockquote', {}, []),
    b.block('callout', { calloutType: 'info' }, []),
    b.block('codeBlock', { language: null }, []),
    b.table([[{ text: '' }, { text: '' }], [{ text: '' }, { text: '' }]]),
    b.block('controlledSection', { sectionId: 'empty-section', title: '', templateSectionId: null, policyRef: null, required: false, allowedBlocks: null, ownerName: null, workflowState: 'draft', locked: false }, undefined, []),
    b.p('Final paragraph after empty blocks.'),
  ];
}

/** Lists nested twelve levels deep, with a child paragraph at every level. */
export function deepNesting(depth = 12): Block[] {
  const b = docBuilder('deep');
  const build = (level: number): Block => {
    const item = b.ul([
      {
        text: `Level ${level}`,
        children: level < depth ? [build(level + 1)] : [b.p(`Deepest content at level ${level}.`)],
      },
    ]);
    return item;
  };
  return [b.h(1, 'Nesting stress', { styleId: 'Heading1' }), build(1)];
}

/** A single paragraph of 10,000 characters with varied styling. */
export function longParagraph(chars = 10000): Block[] {
  const b = docBuilder('long-para');
  const unit = 'Specimen handling must follow the approved routine, and every deviation is recorded. ';
  const text = unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);
  return [
    b.h(1, 'Long paragraph', { styleId: 'Heading1' }),
    b.p([b.text(text.slice(0, 5000)), b.text(text.slice(5000), { bold: true })]),
  ];
}

/** Emoji (including ZWJ sequences), zero-width characters, combining marks and control characters. */
export function unicodeEdgeCases(): Block[] {
  const b = docBuilder('uni');
  return [
    b.h(1, 'Characters 🧪🔬', { styleId: 'Heading1' }),
    b.p('Family emoji: 👨‍👩‍👧‍👦 flags: 🇿🇼 skin tone: 👍🏽 keycap: 1️⃣'),
    b.p('Zero width space:​end. Zero width joiner:‍end. Word joiner:⁠end. BOM:﻿end.'),
    b.p('Combining marks: é ä ñ and Hangul 한국어 with decomposed jamo 각.'),
    b.p('Bidi controls: ‮abc‬ and ⁧LTR isolate⁩.'),
    b.p('Control characters: bell\u0007 vertical-tab\u000B form-feed\u000C escape\u001B end.'),
    b.p('Tab\there, non-breaking space, line separator  and paragraph separator  inside text.'),
  ];
}

/** Unknown block and inline types, which must survive the schema and IR path without being dropped. */
export function unknownBlockTypes(): Block[] {
  const b = docBuilder('unk');
  return [
    b.h(1, 'Extension types nobody registered', { styleId: 'Heading1' }),
    b.block('hologram', { projection: 'front', depthMm: 4 }, [b.text('A block type this build does not know.')]),
    b.block('telemetry', { channels: ['a', 'b'], enabled: true }),
    b.p([b.text('Inline: '), { type: 'mystery', props: { code: 'X-9' } }, b.text(' continues.')]),
    b.block('paragraph', { textAlign: 'left', mystery: { nested: [1, 2, { deep: true }] } }, [b.text('Unknown prop on a known type.')]),
  ];
}
