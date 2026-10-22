/**
 * Flattens IR sections into the linear list of layout units the paginator walks.
 *
 * A paragraph that contains a page break run is split into pieces around a
 * `pageBreak` unit. Controlled sections (`sdt`) become `sdtStart` and `sdtEnd`
 * markers around their children. Table cell content is not a unit: it is measured as
 * part of its row.
 *
 * @module
 */

import type { IRBlock, IRImageBlock, IRInline, IRParagraph, IRSection, IRTable } from '@amusendame/beakblock-ir';

/** Kind of a layout unit. */
export type UnitKind =
  | 'sectionStart'
  | 'pageBreak'
  | 'paragraph'
  | 'table'
  | 'image'
  | 'passthrough'
  | 'sdtStart'
  | 'sdtEnd';

/** One step of the paginator. */
export interface LayoutUnit {
  kind: UnitKind;
  /** 0-based index of the section the unit belongs to. */
  section: number;
  /** Ordinal of the IR leaf block; `-1` for markers. */
  blockIndex: number;
  path: string;
  sourceBlockId?: string;
  /** Paragraph with `runs` restricted to this piece. */
  paragraph?: IRParagraph;
  /** Index of the first run of this piece in the original paragraph. */
  runOffset: number;
  table?: IRTable;
  image?: IRImageBlock;
  passthrough?: { preview?: string };
}

/**
 * Builds the unit list for a set of sections.
 *
 * @example
 * ```typescript
 * const units = flattenSections(ir.sections);
 * ```
 */
export function flattenSections(sections: readonly IRSection[]): LayoutUnit[] {
  const units: LayoutUnit[] = [];
  let blockIndex = 0;

  const pushParagraph = (paragraph: IRParagraph, path: string, section: number, runs: IRInline[], runOffset: number, index: number) => {
    units.push({
      kind: 'paragraph',
      section,
      blockIndex: index,
      path,
      sourceBlockId: paragraph.source?.blockId,
      paragraph: { ...paragraph, runs },
      runOffset,
    });
  };

  const walk = (blocks: readonly IRBlock[], prefix: string, section: number) => {
    blocks.forEach((block, position) => {
      const path = `${prefix}/${position}`;
      switch (block.type) {
        case 'paragraph': {
          const index = blockIndex;
          blockIndex += 1;
          const breaks = block.runs.flatMap((item, at) =>
            item.type === 'break' && item.kind === 'page' ? [at] : []
          );
          if (breaks.length === 0) {
            pushParagraph(block, path, section, block.runs, 0, index);
            break;
          }
          let start = 0;
          const pushPiece = (from: number, to: number) => {
            if (to <= from) return;
            pushParagraph(block, path, section, block.runs.slice(from, to), from, index);
          };
          for (const at of breaks) {
            pushPiece(start, at);
            units.push({ kind: 'pageBreak', section, blockIndex: -1, path, runOffset: at });
            start = at + 1;
          }
          pushPiece(start, block.runs.length);
          break;
        }
        case 'table': {
          units.push({ kind: 'table', section, blockIndex: blockIndex, path, sourceBlockId: block.source?.blockId, table: block, runOffset: 0 });
          blockIndex += 1;
          break;
        }
        case 'image': {
          units.push({ kind: 'image', section, blockIndex: blockIndex, path, sourceBlockId: block.source?.blockId, image: block, runOffset: 0 });
          blockIndex += 1;
          break;
        }
        case 'passthrough': {
          units.push({
            kind: 'passthrough',
            section,
            blockIndex: blockIndex,
            path,
            sourceBlockId: block.source?.blockId,
            passthrough: block.preview !== undefined ? { preview: block.preview } : {},
            runOffset: 0,
          });
          blockIndex += 1;
          break;
        }
        case 'sdt': {
          units.push({ kind: 'sdtStart', section, blockIndex: -1, path, runOffset: 0 });
          walk(block.blocks, path, section);
          units.push({ kind: 'sdtEnd', section, blockIndex: -1, path, runOffset: 0 });
          break;
        }
        default:
          break;
      }
    });
  };

  sections.forEach((section, index) => {
    units.push({ kind: 'sectionStart', section: index, blockIndex: -1, path: `s${index}`, runOffset: 0 });
    walk(section.body, `s${index}`, index);
  });
  return units;
}

/** Index of the first unit whose block index is at least `blockIndex`, or the unit count. */
export function firstUnitForBlock(units: readonly LayoutUnit[], blockIndex: number): number {
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (unit.blockIndex >= 0 && unit.blockIndex >= blockIndex) return index;
  }
  return units.length;
}
