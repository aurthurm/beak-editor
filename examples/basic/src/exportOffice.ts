/**
 * App-level export helpers (Word via `docx`, PDF via print + Markdown HTML).
 * Not part of `@aurthurm/beakblock-core`.
 */

import { blocksToMarkdown, type Block, type InlineContent } from '@aurthurm/beakblock-core';
import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from 'docx';
import { marked } from 'marked';

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function inlinesToRuns(content: InlineContent[] | undefined): (TextRun | ExternalHyperlink)[] {
  if (!content?.length) return [new TextRun('')];
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const item of content) {
    if (item.type === 'text') {
      out.push(
        new TextRun({
          text: item.text,
          bold: Boolean(item.styles.bold),
          italics: Boolean(item.styles.italic),
          strike: Boolean(item.styles.strikethrough),
          underline: item.styles.underline ? { type: UnderlineType.SINGLE } : undefined,
          font: item.styles.code ? 'Consolas' : undefined,
        })
      );
    } else if (item.type === 'link') {
      const text = item.content.map((c) => c.text).join('') || item.href;
      out.push(
        new ExternalHyperlink({
          children: [new TextRun({ text, style: 'Hyperlink' })],
          link: item.href,
        })
      );
    } else if (item.type === 'hardBreak') {
      out.push(new TextRun({ break: 1 }));
    } else if (item.type === 'icon') {
      out.push(new TextRun({ text: item.symbol || item.icon }));
    }
  }
  return out.length ? out : [new TextRun('')];
}

function blocksToParagraphs(blocks: Block[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  const walk = (list: Block[]) => {
    for (const b of list) {
      switch (b.type) {
        case 'heading': {
          const idx = Math.min(6, Math.max(1, Number(b.props?.level) || 1)) - 1;
          paragraphs.push(
            new Paragraph({
              heading: HEADINGS[idx],
              children: inlinesToRuns(b.content),
            })
          );
          break;
        }
        case 'paragraph':
          paragraphs.push(new Paragraph({ children: inlinesToRuns(b.content) }));
          break;
        case 'blockquote':
        case 'callout':
          paragraphs.push(
            new Paragraph({
              indent: { left: 720 },
              children: inlinesToRuns(b.content),
            })
          );
          break;
        case 'codeBlock': {
          const text = (b.content || [])
            .filter((x): x is Extract<InlineContent, { type: 'text' }> => x.type === 'text')
            .map((x) => x.text)
            .join('');
          paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Consolas' })] }));
          break;
        }
        case 'divider':
          paragraphs.push(new Paragraph({ children: [new TextRun('---')] }));
          break;
        case 'bulletList':
        case 'orderedList':
        case 'checkList': {
          let n = 1;
          for (const li of b.children || []) {
            const prefix =
              b.type === 'orderedList'
                ? `${n++}. `
                : b.type === 'checkList'
                  ? `${(li.props as { checked?: boolean } | undefined)?.checked ? '[x] ' : '[ ] '}`
                  : '• ';
            paragraphs.push(
              new Paragraph({
                children: [new TextRun(prefix), ...inlinesToRuns(li.content)],
              })
            );
          }
          break;
        }
        case 'table': {
          for (const row of b.children || []) {
            if (row.type !== 'tableRow') continue;
            const cellTexts = (row.children || [])
              .filter((c) => c.type === 'tableCell' || c.type === 'tableHeader')
              .map((cell) =>
                (cell.children || [])
                  .map((inner) =>
                    inner.type === 'paragraph'
                      ? (inner.content || [])
                          .filter((x): x is Extract<InlineContent, { type: 'text' }> => x.type === 'text')
                          .map((x) => x.text)
                          .join('')
                      : ''
                  )
                  .join(' ')
              )
              .join(' | ');
            paragraphs.push(new Paragraph({ children: [new TextRun(cellTexts || ' ')] }));
          }
          break;
        }
        case 'columnList':
        case 'column':
          if (b.children?.length) walk(b.children);
          break;
        case 'image': {
          const alt = String(b.props?.alt || 'image');
          paragraphs.push(new Paragraph({ children: [new TextRun(`[Image: ${alt}]`)] }));
          break;
        }
        case 'embed': {
          const url = String(b.props?.url || '');
          paragraphs.push(new Paragraph({ children: [new TextRun(`[Embed: ${url}]`)] }));
          break;
        }
        case 'listItem':
        case 'checkListItem':
        case 'tableRow':
        case 'tableCell':
        case 'tableHeader':
          break;
        default:
          if (b.children?.length) walk(b.children);
          else if (b.content?.length) {
            paragraphs.push(new Paragraph({ children: inlinesToRuns(b.content) }));
          }
      }
    }
  };

  walk(blocks);
  return paragraphs;
}

/** Download the current document as a Word `.docx` file. */
export async function downloadBlocksAsDocx(blocks: Block[], filename = 'document.docx'): Promise<void> {
  const doc = new Document({
    sections: [{ children: blocksToParagraphs(blocks) }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open a print dialog with HTML rendered from Markdown (use “Save as PDF” in the browser).
 */
export function printDocumentAsPdf(blocks: Block[]): void {
  const md = blocksToMarkdown(blocks);
  const body = marked.parse(md, { async: false }) as string;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Print</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.5;}
pre,code{font-family:ui-monospace,monospace;}
table{border-collapse:collapse;width:100%;}
th,td{border:1px solid #ccc;padding:6px;text-align:left;}
</style></head><body>${body}</body></html>`);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}
