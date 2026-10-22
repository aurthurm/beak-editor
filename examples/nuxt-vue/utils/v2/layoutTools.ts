/**
 * Turns editor blocks into a BeakDocument -> IR -> layout pipeline. Headers and footers are
 * not stored in the editor blocks, so they are carried over from the base document by section index.
 */
import type { Block } from '@amusendame/beakblock-core';
import { blocksToDocument, type BeakDocument } from '@amusendame/beakblock-schema';
import { documentToIR, type IRDocument } from '@amusendame/beakblock-ir';
import { createDomMeasurer, layoutDocument, renderPrintHTML, type LayoutResult } from '@amusendame/beakblock-layout';

export function documentFromBlocks(blocks: Block[], base?: BeakDocument | null): BeakDocument {
  const next = blocksToDocument(blocks);
  if (!base) return next;
  next.id = base.id;
  next.properties = base.properties;
  next.styles = base.styles;
  next.numbering = base.numbering;
  next.sections.forEach((section, index) => {
    const source = base.sections[index];
    if (!source) return;
    section.headers = source.headers;
    section.footers = source.footers;
    section.titlePage = source.titlePage;
    section.pageSetup = source.pageSetup;
  });
  return next;
}

export interface LaidOut {
  doc: BeakDocument;
  ir: IRDocument;
  layout: LayoutResult;
}

/** Runs the full pipeline. Requires a DOM (uses the DOM measurer), so call it on the client only. */
export function layoutFromBlocks(blocks: Block[], base?: BeakDocument | null): LaidOut {
  const doc = documentFromBlocks(blocks, base);
  const ir = documentToIR(doc);
  const layout = layoutDocument(ir, { measurer: createDomMeasurer() });
  return { doc, ir, layout };
}

/** Print HTML for a laid-out document, suitable for a sandboxed iframe or the print window. */
export function printHtmlFor(laid: LaidOut, title: string, extra: Record<string, unknown> = {}): string {
  return renderPrintHTML(laid.ir, laid.layout, { title, ...extra } as never);
}
