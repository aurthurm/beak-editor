/**
 * Document construction, block <-> document conversion and structural validation.
 *
 * @module
 */

import { cloneJson } from '@amusendame/beakblock-core';
import type { Block } from '@amusendame/beakblock-core';

import { createDefaultNumbering } from './numbering';
import { createDefaultPageSetup } from './page';
import { normalizeBlockSpacing, normalizeStyleSheet } from './spacing';
import { createDefaultStyleSheet } from './styles';
import type {
  BeakDocument,
  DocumentIssue,
  DocumentProperties,
  DocumentSection,
  HeaderFooterSet,
  NumberingDefinitions,
  PageSetup,
  StyleSheet,
} from './types';

/** Schema version written by this package. */
export const CURRENT_SCHEMA_VERSION = 2 as const;

/** Creates a reasonably unique identifier with a prefix. */
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}-${time}${random}`;
}

/** Deep-clones JSON-like data (falls back to JSON for proxies and non-cloneable values). */
export function cloneValue<T>(value: T): T {
  return cloneJson(value);
}

/** Options for {@link blocksToDocument}. */
export interface BlocksToDocumentOptions {
  /** Document id. Generated when omitted. */
  id?: string;
  properties?: DocumentProperties;
  styles?: StyleSheet;
  numbering?: NumberingDefinitions;
  /** Page setup of the first section. Defaults to A4 portrait. */
  pageSetup?: PageSetup;
  /** Id of the first section. Defaults to `sec-1`. */
  firstSectionId?: string;
}

function pageSetupFromBreak(block: Block): PageSetup {
  const pageSetup = (block.props as { pageSetup?: PageSetup | null }).pageSetup;
  return pageSetup ? cloneValue(pageSetup) : createDefaultPageSetup();
}

/**
 * Builds a v2 document from flat core blocks.
 *
 * Each `sectionBreak` block closes the current section and starts a new one
 * whose id is the break's id and whose page setup is the break's `pageSetup`.
 * Other blocks are stored verbatim (cloned) in the current section.
 *
 * @example
 * ```typescript
 * const doc = blocksToDocument(blocks, { properties: { docNumber: 'SOP-001' } });
 * ```
 */
export function blocksToDocument(blocks: Block[], options: BlocksToDocumentOptions = {}): BeakDocument {
  const sections: DocumentSection[] = [];
  let current: DocumentSection = {
    id: options.firstSectionId ?? 'sec-1',
    pageSetup: options.pageSetup ? cloneValue(options.pageSetup) : createDefaultPageSetup(),
    blocks: [],
  };

  for (const block of blocks) {
    if (block.type === 'sectionBreak') {
      sections.push(current);
      current = {
        id: block.id || `sec-${sections.length + 1}`,
        pageSetup: pageSetupFromBreak(block),
        blocks: [],
      };
    } else {
      current.blocks.push(...normalizeBlockSpacing([cloneValue(block)]));
    }
  }
  sections.push(current);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id ?? createId('doc'),
    properties: cloneValue(options.properties ?? {}),
    styles: normalizeStyleSheet(cloneValue(options.styles ?? createDefaultStyleSheet())),
    numbering: cloneValue(options.numbering ?? createDefaultNumbering()),
    sections,
  };
}

/**
 * Flattens a document back into core blocks.
 *
 * Sections after the first are preceded by a `sectionBreak` block whose id is
 * the section id and whose props are `{ pageSetup }`. For a single-section
 * document this returns the stored blocks unchanged.
 */
export function documentToBlocks(doc: BeakDocument): Block[] {
  const blocks: Block[] = [];
  doc.sections.forEach((section, index) => {
    if (index > 0) {
      blocks.push({
        id: section.id,
        type: 'sectionBreak',
        props: { pageSetup: cloneValue(section.pageSetup) },
      });
    }
    for (const block of section.blocks) {
      blocks.push(cloneValue(block));
    }
  });
  return blocks;
}

/** Walks blocks and their children depth-first. */
function forEachBlock(
  blocks: Block[],
  visit: (block: Block, path: string) => void,
  basePath: string
): void {
  blocks.forEach((block, index) => {
    const path = `${basePath}[${index}]`;
    visit(block, path);
    if (block.children) {
      forEachBlock(block.children, visit, `${path}.children`);
    }
  });
}

function headerFooterBlocks(set: HeaderFooterSet | undefined): Block[] {
  if (!set) return [];
  return [...(set.default ?? []), ...(set.first ?? []), ...(set.even ?? [])];
}

/**
 * Checks a document for structural problems.
 *
 * Reports duplicate section and block ids, missing sections, unknown style
 * ids (paragraph, table, and the heading style a heading resolves to), unknown
 * or out-of-range numbering references, style inheritance cycles and dangling
 * `basedOn` references, and section breaks left inside a section.
 *
 * @returns Issues in discovery order. An empty array means the document is clean.
 */
export function validateDocumentStructure(doc: BeakDocument): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

  if (doc.sections.length === 0) {
    issues.push({ severity: 'error', code: 'missing-sections', message: 'Document has no sections.' });
  }

  const sectionIds = new Set<string>();
  for (const section of doc.sections) {
    if (sectionIds.has(section.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-section-id',
        message: `Section id "${section.id}" is used more than once.`,
        sectionId: section.id,
      });
    }
    sectionIds.add(section.id);
    if (!section.pageSetup || section.pageSetup.size.widthTwips <= 0 || section.pageSetup.size.heightTwips <= 0) {
      issues.push({
        severity: 'error',
        code: 'invalid-page-setup',
        message: `Section "${section.id}" has no valid page setup.`,
        sectionId: section.id,
      });
    }
  }

  // Style inheritance: dangling basedOn and cycles.
  for (const [id, style] of Object.entries(doc.styles.paragraph)) {
    if (style.basedOn && !has(doc.styles.paragraph, style.basedOn)) {
      issues.push({
        severity: 'warning',
        code: 'unknown-base-style',
        message: `Paragraph style "${id}" is based on unknown style "${style.basedOn}".`,
        path: `styles.paragraph.${id}`,
      });
    }
    const visited = new Set<string>([id]);
    let next = style.basedOn ?? null;
    while (next && has(doc.styles.paragraph, next)) {
      if (visited.has(next)) {
        issues.push({
          severity: 'error',
          code: 'style-cycle',
          message: `Paragraph style "${id}" is part of a basedOn cycle.`,
          path: `styles.paragraph.${id}`,
        });
        break;
      }
      visited.add(next);
      next = doc.styles.paragraph[next].basedOn ?? null;
    }
  }

  const blockIds = new Set<string>();
  const checkBlocks = (sectionId: string | undefined, blocks: Block[], basePath: string, isSectionBody: boolean) => {
    forEachBlock(
      blocks,
      (block, path) => {
        if (!block.id) {
          issues.push({
            severity: 'warning',
            code: 'missing-block-id',
            message: `Block of type "${block.type}" has no id.`,
            sectionId,
            path,
          });
        } else if (blockIds.has(block.id)) {
          issues.push({
            severity: 'error',
            code: 'duplicate-block-id',
            message: `Block id "${block.id}" is used more than once.`,
            blockId: block.id,
            sectionId,
            path,
          });
        } else {
          blockIds.add(block.id);
        }

        if (isSectionBody && block.type === 'sectionBreak') {
          issues.push({
            severity: 'warning',
            code: 'nested-section-break',
            message: 'sectionBreak found inside a section; it should split sections.',
            blockId: block.id,
            sectionId,
            path,
          });
        }

        const props = (block.props ?? {}) as Record<string, unknown>;
        const level = typeof props.level === 'number' ? props.level : 1;

        if (block.type === 'heading' && typeof props.styleId !== 'string') {
          const derived = `Heading${level}`;
          if (!has(doc.styles.paragraph, derived)) {
            issues.push({
              severity: 'error',
              code: 'unknown-style',
              message: `Heading style "${derived}" is not defined.`,
              blockId: block.id,
              sectionId,
              path,
            });
          }
        }

        if (typeof props.styleId === 'string' && (block.type === 'paragraph' || block.type === 'heading')) {
          if (!has(doc.styles.paragraph, props.styleId)) {
            issues.push({
              severity: 'error',
              code: 'unknown-style',
              message: `Paragraph style "${props.styleId}" is not defined.`,
              blockId: block.id,
              sectionId,
              path,
            });
          }
        }

        if (block.type === 'table' && typeof props.styleId === 'string' && !has(doc.styles.table, props.styleId)) {
          issues.push({
            severity: 'error',
            code: 'unknown-table-style',
            message: `Table style "${props.styleId}" is not defined.`,
            blockId: block.id,
            sectionId,
            path,
          });
        }

        const numbering = props.numbering as { numId?: unknown; level?: unknown } | null | undefined;
        if (numbering && typeof numbering === 'object' && typeof numbering.numId === 'string') {
          const instance = has(doc.numbering.instances, numbering.numId)
            ? doc.numbering.instances[numbering.numId]
            : undefined;
          if (!instance) {
            issues.push({
              severity: 'error',
              code: 'unknown-numbering',
              message: `Numbering instance "${numbering.numId}" is not defined.`,
              blockId: block.id,
              sectionId,
              path,
            });
          } else if (!has(doc.numbering.abstract, instance.abstractId)) {
            issues.push({
              severity: 'error',
              code: 'unknown-numbering-abstract',
              message: `Abstract numbering "${instance.abstractId}" is not defined.`,
              blockId: block.id,
              sectionId,
              path,
            });
          } else {
            const abstract = doc.numbering.abstract[instance.abstractId];
            const level = typeof numbering.level === 'number' ? numbering.level : -1;
            if (!abstract.levels.some((entry) => entry.level === level)) {
              issues.push({
                severity: 'error',
                code: 'invalid-numbering-level',
                message: `Level ${String(numbering.level)} is not defined for numbering "${numbering.numId}".`,
                blockId: block.id,
                sectionId,
                path,
              });
            }
          }
        }
      },
      basePath
    );
  };

  for (const section of doc.sections) {
    checkBlocks(section.id, section.blocks, `sections[${section.id}]`, true);
    checkBlocks(section.id, headerFooterBlocks(section.headers), `sections[${section.id}].headers`, false);
    checkBlocks(section.id, headerFooterBlocks(section.footers), `sections[${section.id}].footers`, false);
  }

  return issues;
}
