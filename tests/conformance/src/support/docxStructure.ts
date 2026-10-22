/**
 * Structural summary of a BeakDoc IR document, used to compare a document before DOCX export with
 * the same document after DOCX import. The summary keeps what a reader or Word user would notice:
 * paragraph text and style, list membership, tables and their grids and spans, content controls,
 * fields, and tracked revisions. It ignores ids and other internal bookkeeping.
 *
 * `formatDiff` (deepDiff.ts) prints the differences, one per line, with paths such as
 * `$.sections[0].body[3].blocks[1].text`.
 *
 * @module
 */

type Json = Record<string, unknown>;

export interface ParagraphSummary {
  kind: 'paragraph';
  styleId: string | null;
  text: string;
  numbering: string | null;
  fields: string[];
  revisions: string[];
  breaks: string[];
}

export interface TableSummary {
  kind: 'table';
  grid: number[];
  rows: { header: boolean; cells: { span: number; vMerge: string | null; blocks: NodeSummary[] }[] }[];
}

export interface SdtSummary {
  kind: 'sdt';
  tag: string;
  blocks: NodeSummary[];
}

export interface OtherSummary {
  kind: 'image' | 'passthrough' | 'unknown';
  detail: string;
}

export type NodeSummary = ParagraphSummary | TableSummary | SdtSummary | OtherSummary;

export interface SectionSummary {
  pageSize: string;
  body: NodeSummary[];
}

export interface StructureSummary {
  sections: SectionSummary[];
}

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

function summariseInline(runs: unknown[], summary: ParagraphSummary): void {
  for (const run of runs) {
    if (!isRecord(run)) continue;
    if (run.type === 'run') {
      summary.text += String(run.text ?? '');
      const revision = run.revision;
      if (isRecord(revision)) {
        const label = String(revision.kind);
        summary.revisions.push(`${label}:${String(revision.author ?? revision.authorId ?? '')}`);
      }
    } else if (run.type === 'custom') {
      // DOCX has no form for extension inline nodes, so the expected outcome of export and import
      // is their plain-text fallback as an ordinary run. Flattening them here models that outcome.
      summary.text += String(run.text ?? '');
    } else if (run.type === 'field') {
      summary.fields.push(`${String(run.fieldType)}${run.name ? `(${String(run.name)})` : ''}`);
    } else if (run.type === 'break') {
      summary.breaks.push(String(run.kind));
    } else if (run.type === 'image') {
      summary.breaks.push('image');
    }
  }
}

function summariseBlock(block: unknown): NodeSummary {
  if (!isRecord(block)) return { kind: 'unknown', detail: String(block) };
  switch (block.type) {
    case 'paragraph': {
      const props = isRecord(block.props) ? block.props : {};
      const numbering = isRecord(props.numbering) ? `${String(props.numbering.numId)}:${String(props.numbering.level)}` : null;
      const summary: ParagraphSummary = {
        kind: 'paragraph',
        styleId: typeof props.styleId === 'string' ? props.styleId : null,
        text: '',
        numbering,
        fields: [],
        revisions: [],
        breaks: [],
      };
      summariseInline(Array.isArray(block.runs) ? block.runs : [], summary);
      return summary;
    }
    case 'table': {
      const grid = Array.isArray(block.grid) ? (block.grid as number[]) : [];
      const rows = (Array.isArray(block.rows) ? block.rows : []).map((row) => {
        const r = isRecord(row) ? row : {};
        const rowProps = isRecord(r.props) ? r.props : {};
        return {
          header: rowProps.isHeader === true,
          cells: (Array.isArray(r.cells) ? r.cells : []).map((cell) => {
            const c = isRecord(cell) ? cell : {};
            const cellProps = isRecord(c.props) ? c.props : {};
            return {
              span: typeof cellProps.gridSpan === 'number' ? cellProps.gridSpan : 1,
              vMerge: typeof cellProps.vMerge === 'string' ? cellProps.vMerge : null,
              blocks: (Array.isArray(c.blocks) ? c.blocks : []).map(summariseBlock),
            };
          }),
        };
      });
      return { kind: 'table', grid, rows };
    }
    case 'sdt':
      return { kind: 'sdt', tag: String(block.tag), blocks: (Array.isArray(block.blocks) ? block.blocks : []).map(summariseBlock) };
    case 'image':
      return { kind: 'image', detail: String(block.alt ?? block.src ?? '') };
    case 'passthrough':
      return { kind: 'passthrough', detail: String(block.preview ?? '') };
    default:
      return { kind: 'unknown', detail: String(block.type) };
  }
}

/** Summarises every section of an IR document. */
export function summariseStructure(ir: unknown): StructureSummary {
  const doc = isRecord(ir) ? ir : {};
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  return {
    sections: sections.map((section) => {
      const s = isRecord(section) ? section : {};
      const setup = isRecord(s.pageSetup) ? s.pageSetup : {};
      const size = isRecord(setup.size) ? setup.size : {};
      return {
        pageSize: `${String(size.widthTwips)}x${String(size.heightTwips)}:${String(setup.orientation ?? 'portrait')}`,
        body: (Array.isArray(s.body) ? s.body : []).map(summariseBlock),
      };
    }),
  };
}

/** Counts elements of each kind, for quick checks against raw XML. */
export function countKinds(summary: StructureSummary): Record<string, number> {
  const counts: Record<string, number> = { paragraph: 0, table: 0, sdt: 0, tableRow: 0, tableCell: 0, field: 0, insRun: 0, delRun: 0 };
  const walk = (nodes: NodeSummary[]) => {
    for (const node of nodes) {
      counts[node.kind] = (counts[node.kind] ?? 0) + 1;
      if (node.kind === 'paragraph') {
        counts.field += node.fields.length;
        counts.insRun += node.revisions.filter((r) => r.startsWith('insert')).length;
        counts.delRun += node.revisions.filter((r) => r.startsWith('delete')).length;
      } else if (node.kind === 'table') {
        counts.tableRow += node.rows.length;
        for (const row of node.rows) {
          counts.tableCell += row.cells.length;
          for (const cell of row.cells) walk(cell.blocks);
        }
      } else if (node.kind === 'sdt') {
        walk(node.blocks);
      }
    }
  };
  for (const section of summary.sections) walk(section.body);
  return counts;
}

const XML_INVALID_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * Documented normalisations for DOCX comparisons. Apply to both sides before comparing.
 *
 * - Control characters that XML 1.0 forbids are removed by the writer.
 * - Bookmark names are sanitised (`-` becomes `_`) and REF instructions follow them.
 * - OOXML requires a paragraph after a table, at the end of a table cell, at the end of a content
 *   control and at the end of a section. The writer adds an empty paragraph there and the reader
 *   returns it, so empty paragraphs in those positions are ignored.
 */
export function normaliseForDocx(summary: StructureSummary): StructureSummary {
  return { sections: summary.sections.map((section) => ({ ...section, body: normaliseBody(section.body) })) };
}

function normaliseBody(nodes: NodeSummary[]): NodeSummary[] {
  const out: NodeSummary[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const last = index === nodes.length - 1;
    const afterTable = index > 0 && nodes[index - 1].kind === 'table';
    if (node.kind === 'paragraph') {
      const text = node.text.replace(XML_INVALID_CONTROL, '');
      const fields = node.fields.map((f) => f.replace(/^REF\(([^)]*)\)$/, (_m, name: string) => `REF(${name.replace(/-/g, '_')})`));
      const normalised: ParagraphSummary = { ...node, text, fields };
      const empty = text === '' && fields.length === 0 && node.breaks.length === 0 && node.revisions.length === 0;
      if (empty && (afterTable || last)) continue;
      out.push(normalised);
    } else if (node.kind === 'table') {
      out.push({
        ...node,
        rows: node.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({ ...cell, blocks: normaliseBody(cell.blocks) })),
        })),
      });
    } else if (node.kind === 'sdt') {
      out.push({ ...node, blocks: normaliseBody(node.blocks) });
    } else {
      out.push(node);
    }
  }
  return out;
}
