/**
 * DOCX importer: OOXML package to BeakDoc IR.
 *
 * @module
 */

import { IR_VERSION, irToDocument, type IRBlock, type IRDocument } from '@amusendame/beakblock-ir';

import { parseBodySections } from './body';
import type { PartContext, SharedState } from './context';
import { parseXml, type DomParserLike } from './dom';
import type { LossReport } from './losses';
import { bodyOf, readDocumentProperties, readPackage, readRelationships, readText } from './package';
import { parseNumbering, parseStyles } from './styles';

/** Options for {@link importDocx}. */
export interface ImportDocxOptions {
  /** DOM parser to use. Defaults to the global `DOMParser` (browsers and jsdom). */
  domParser?: DomParserLike;
  /**
   * When `false`, passthrough blocks are removed from the IR. Their losses are
   * still reported. Defaults to `true`.
   */
  keepPassthrough?: boolean;
}

/** Result of {@link importDocx}. */
export interface ImportDocxResult {
  ir: IRDocument;
  losses: LossReport[];
}

/** Result of {@link importDocxToDocument}. */
export interface ImportDocxToDocumentResult {
  /** Schema v2 document, ready for `editor` or `documentToBlocks`. */
  document: ReturnType<typeof irToDocument>;
  ir: IRDocument;
  losses: LossReport[];
}

function resolveParser(options: ImportDocxOptions): DomParserLike {
  if (options.domParser) return options.domParser;
  const globalParser = (globalThis as { DOMParser?: new () => DomParserLike }).DOMParser;
  if (!globalParser) {
    throw new Error('DOMParser is not available. Pass options.domParser in non-browser environments.');
  }
  return new globalParser();
}

function createIdFactory(): (prefix: string) => string {
  const session = Math.random().toString(36).slice(2, 8);
  let counter = 0;
  return (prefix: string) => {
    counter += 1;
    return `${prefix}-${session}${counter.toString(36)}`;
  };
}

function stripPassthrough(blocks: IRBlock[]): IRBlock[] {
  return blocks
    .filter((block) => block.type !== 'passthrough')
    .map((block): IRBlock => {
      if (block.type === 'table') {
        return {
          ...block,
          rows: block.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => ({ ...cell, blocks: stripPassthrough(cell.blocks) })),
          })),
        };
      }
      if (block.type === 'sdt') return { ...block, blocks: stripPassthrough(block.blocks) };
      return block;
    });
}

/**
 * Imports a DOCX file into BeakDoc IR.
 *
 * Unsupported structures become passthrough blocks and are reported in `losses`.
 * The function throws only when the input is not a WordprocessingML package.
 *
 * @example
 * ```typescript
 * const { ir, losses } = await importDocx(new Uint8Array(await file.arrayBuffer()));
 * ```
 */
export async function importDocx(bytes: Uint8Array | ArrayBuffer, options: ImportDocxOptions = {}): Promise<ImportDocxResult> {
  const parser = resolveParser(options);
  const files = readPackage(bytes);
  const documentXml = readText(files, 'word/document.xml');
  if (documentXml === null) {
    throw new Error('Not a WordprocessingML package: word/document.xml is missing.');
  }

  const losses: LossReport[] = [];
  const shared: SharedState = {
    parser,
    files,
    losses,
    mediaCache: new Map(),
    partBlocks: new Map<string, IRBlock[]>(),
    styles: { paragraph: {}, character: {}, table: {} },
    numbering: { abstract: {}, instances: {} },
    nextId: createIdFactory(),
  };

  const sidePart = (path: string): PartContext => ({
    shared,
    partPath: path,
    rels: new Map(),
    paragraphIndex: 0,
  });

  const stylesXml = readText(files, 'word/styles.xml');
  if (stylesXml !== null) {
    const doc = parseXml(stylesXml, parser);
    if (doc) shared.styles = parseStyles(doc.documentElement);
    else losses.push({ code: 'part-parse-error', severity: 'error', message: 'word/styles.xml is not well-formed XML.', location: 'word/styles.xml' });
  }

  const numberingXml = readText(files, 'word/numbering.xml');
  if (numberingXml !== null) {
    const doc = parseXml(numberingXml, parser);
    if (doc) shared.numbering = parseNumbering(doc.documentElement, sidePart('word/numbering.xml'));
    else losses.push({ code: 'part-parse-error', severity: 'error', message: 'word/numbering.xml is not well-formed XML.', location: 'word/numbering.xml' });
  }

  const documentDoc = parseXml(documentXml, parser);
  if (!documentDoc) {
    throw new Error('word/document.xml is not well-formed XML.');
  }
  const body = bodyOf(documentDoc);
  if (!body) {
    throw new Error('word/document.xml has no w:body element.');
  }

  const ctx: PartContext = {
    shared,
    partPath: 'word/document.xml',
    rels: readRelationships(files, 'word/document.xml', parser),
    paragraphIndex: 0,
  };
  const sections = parseBodySections(body, ctx, shared.nextId);

  const ir: IRDocument = {
    irVersion: IR_VERSION,
    id: shared.nextId('doc'),
    properties: readDocumentProperties(files, parser),
    styles: shared.styles,
    numbering: shared.numbering,
    sections: sections.map((section) =>
      options.keepPassthrough === false
        ? {
            ...section,
            body: stripPassthrough(section.body),
            headers: section.headers && mapSet(section.headers, stripPassthrough),
            footers: section.footers && mapSet(section.footers, stripPassthrough),
          }
        : section,
    ),
  };
  return { ir, losses };
}

function mapSet<T extends { default?: IRBlock[]; first?: IRBlock[]; even?: IRBlock[] }>(set: T, fn: (blocks: IRBlock[]) => IRBlock[]): T {
  const out: { default?: IRBlock[]; first?: IRBlock[]; even?: IRBlock[] } = {};
  if (set.default) out.default = fn(set.default);
  if (set.first) out.first = fn(set.first);
  if (set.even) out.even = fn(set.even);
  return out as T;
}

/**
 * Imports a DOCX file and converts it to a schema v2 document.
 *
 * Passthrough blocks are emitted as `ooxmlPassthrough` blocks with `xml` and
 * `preview` props, so write-back can restore them verbatim.
 */
export async function importDocxToDocument(
  bytes: Uint8Array | ArrayBuffer,
  options: ImportDocxOptions = {},
): Promise<ImportDocxToDocumentResult> {
  const { ir, losses } = await importDocx(bytes, options);
  const document = irToDocument(ir);
  return { document, ir, losses };
}
