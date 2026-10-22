/**
 * Structural validation of the IR.
 *
 * @module
 */

import type { IRBlock, IRDocument, IRIssue, IRInline, IRTable } from './types';

/**
 * Checks an IR table: grid coverage per row, and that every continuation cell
 * sits under a cell that is still open from the row above.
 */
function checkTable(table: IRTable, path: string, issues: IRIssue[]): void {
  const columnCount = table.grid.length;
  let previous = new Set<number>();
  table.rows.forEach((row, rowIndex) => {
    let col = 0;
    const covered = new Set<number>();
    for (const cell of row.cells) {
      if (cell.props.gridSpan < 1) {
        issues.push({ severity: 'error', code: 'invalid-grid-span', message: 'gridSpan must be at least 1.', path });
      }
      if (cell.props.vMerge === 'continue' && !previous.has(col)) {
        issues.push({
          severity: 'warning',
          code: 'orphan-continue-cell',
          message: `Row ${rowIndex} has a continuation cell at column ${col} with no merge above.`,
          path,
        });
      }
      const open = cell.props.vMerge === 'restart' || cell.props.vMerge === 'continue';
      for (let offset = 0; offset < cell.props.gridSpan; offset += 1) {
        if (open) covered.add(col + offset);
      }
      col += cell.props.gridSpan;
      validateBlocks(cell.blocks, `${path}.rows[${rowIndex}]`, issues);
    }
    if (columnCount > 0 && col !== columnCount) {
      issues.push({
        severity: 'error',
        code: 'grid-mismatch',
        message: `Row ${rowIndex} spans ${col} columns but the grid has ${columnCount}.`,
        path,
      });
    }
    previous = covered;
  });
}

function validateInline(inline: IRInline, path: string, issues: IRIssue[]): void {
  if (inline.type === 'run' && inline.revision && !inline.revision.at) {
    issues.push({ severity: 'error', code: 'revision-missing-time', message: 'Revision has no timestamp.', path });
  }
  if (inline.type === 'field' && !inline.instr) {
    issues.push({ severity: 'error', code: 'field-missing-instr', message: 'Field has no instruction.', path });
  }
  if (inline.type === 'custom' && !inline.inlineType) {
    issues.push({ severity: 'error', code: 'custom-inline-missing-type', message: 'Custom inline has no type.', path });
  }
}

function validateBlocks(blocks: IRBlock[], basePath: string, issues: IRIssue[]): void {
  blocks.forEach((block, index) => {
    const path = `${basePath}[${index}]`;
    switch (block.type) {
      case 'paragraph':
        block.runs.forEach((inline, runIndex) => validateInline(inline, `${path}.runs[${runIndex}]`, issues));
        break;
      case 'table':
        checkTable(block, path, issues);
        break;
      case 'sdt':
        if (!block.tag) {
          issues.push({ severity: 'error', code: 'sdt-missing-tag', message: 'sdt has no tag.', path });
        }
        validateBlocks(block.blocks, `${path}.blocks`, issues);
        break;
      case 'image':
        if (!block.src) {
          issues.push({ severity: 'warning', code: 'image-missing-src', message: 'Image has no src.', path });
        }
        break;
      default:
        break;
    }
  });
}

/**
 * Validates an IR document.
 *
 * Checks duplicate section ids, paragraph style and numbering references, table
 * grids and vertical merges, sdt tags, and revision timestamps.
 *
 * @returns Issues in discovery order. An empty array means the IR is clean.
 *
 * @example
 * ```typescript
 * const problems = validateIR(documentToIR(doc)).filter((i) => i.severity === 'error');
 * ```
 */
export function validateIR(ir: IRDocument): IRIssue[] {
  const issues: IRIssue[] = [];
  const sectionIds = new Set<string>();

  ir.sections.forEach((section, sectionIndex) => {
    const path = `sections[${sectionIndex}]`;
    if (sectionIds.has(section.id)) {
      issues.push({ severity: 'error', code: 'duplicate-section-id', message: `Section id "${section.id}" repeats.`, path });
    }
    sectionIds.add(section.id);
    validateBlocks(section.body, `${path}.body`, issues);
    for (const set of [section.headers, section.footers]) {
      if (!set) continue;
      for (const blocks of [set.default, set.first, set.even]) {
        if (blocks) validateBlocks(blocks, `${path}.headerFooter`, issues);
      }
    }
  });

  const checkStyleAndNumbering = (blocks: IRBlock[], basePath: string) => {
    blocks.forEach((block, index) => {
      const path = `${basePath}[${index}]`;
      if (block.type === 'paragraph') {
        const styleId = block.props.styleId;
        if (styleId !== undefined && !Object.prototype.hasOwnProperty.call(ir.styles.paragraph, styleId)) {
          issues.push({ severity: 'error', code: 'unknown-style', message: `Unknown paragraph style "${styleId}".`, path });
        }
        const numbering = block.props.numbering;
        if (numbering) {
          const instance = Object.prototype.hasOwnProperty.call(ir.numbering.instances, numbering.numId)
            ? ir.numbering.instances[numbering.numId]
            : undefined;
          if (!instance) {
            issues.push({ severity: 'error', code: 'unknown-numbering', message: `Unknown numbering "${numbering.numId}".`, path });
          } else {
            const abstract = ir.numbering.abstract[instance.abstractId];
            if (!abstract || !abstract.levels.some((entry) => entry.level === numbering.level)) {
              issues.push({ severity: 'error', code: 'invalid-numbering-level', message: `Level ${numbering.level} is not defined.`, path });
            }
          }
        }
      }
    });
  };

  ir.sections.forEach((section, sectionIndex) => {
    checkStyleAndNumbering(section.body, `sections[${sectionIndex}].body`);
  });

  return issues;
}
