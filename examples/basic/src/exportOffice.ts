/**
 * App-level export helpers (Word via `docx`, PDF via print + Markdown HTML).
 * Not part of `@amusendame/beakblock-core`.
 */

import { blocksToMarkdown, type Block, type InlineContent } from '@amusendame/beakblock-core';
import type {
  ExternalHyperlink as DocxExternalHyperlink,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
} from 'docx';

function inlinesToRuns(docx: typeof import('docx'), content: InlineContent[] | undefined): Array<DocxTextRun | DocxExternalHyperlink> {
  if (!content?.length) return [new docx.TextRun('')];

  const out: Array<DocxTextRun | DocxExternalHyperlink> = [];

  for (const item of content) {
    if (item.type === 'text') {
      out.push(
        new docx.TextRun({
          text: item.text,
          bold: Boolean(item.styles.bold),
          italics: Boolean(item.styles.italic),
          strike: Boolean(item.styles.strikethrough),
          underline: item.styles.underline ? { type: docx.UnderlineType.SINGLE } : undefined,
          font: item.styles.code ? 'Consolas' : undefined,
        })
      );
    } else if (item.type === 'link') {
      const text = item.content.map((c) => c.text).join('') || item.href;
      out.push(
        new docx.ExternalHyperlink({
          children: [new docx.TextRun({ text, style: 'Hyperlink' })],
          link: item.href,
        })
      );
    } else if (item.type === 'hardBreak') {
      out.push(new docx.TextRun({ break: 1 }));
    } else if (item.type === 'icon') {
      out.push(new docx.TextRun({ text: item.symbol || item.icon }));
    }
  }

  return out.length ? out : [new docx.TextRun('')];
}

function blocksToParagraphs(docx: typeof import('docx'), blocks: Block[]): DocxParagraph[] {
  const headings = [
    docx.HeadingLevel.HEADING_1,
    docx.HeadingLevel.HEADING_2,
    docx.HeadingLevel.HEADING_3,
    docx.HeadingLevel.HEADING_4,
    docx.HeadingLevel.HEADING_5,
    docx.HeadingLevel.HEADING_6,
  ] as const;

  const paragraphs: DocxParagraph[] = [];

  const walk = (list: Block[]) => {
    for (const b of list) {
      switch (b.type) {
        case 'heading': {
          const idx = Math.min(6, Math.max(1, Number(b.props?.level) || 1)) - 1;
          paragraphs.push(
            new docx.Paragraph({
              heading: headings[idx],
              children: inlinesToRuns(docx, b.content),
            })
          );
          break;
        }
        case 'paragraph':
          paragraphs.push(new docx.Paragraph({ children: inlinesToRuns(docx, b.content) }));
          break;
        case 'blockquote':
        case 'callout':
          paragraphs.push(
            new docx.Paragraph({
              indent: { left: 720 },
              children: inlinesToRuns(docx, b.content),
            })
          );
          break;
        case 'codeBlock': {
          const text = (b.content || [])
            .filter((x): x is Extract<InlineContent, { type: 'text' }> => x.type === 'text')
            .map((x) => x.text)
            .join('');
          paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun({ text, font: 'Consolas' })] }));
          break;
        }
        case 'divider':
          paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun('---')] }));
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
              new docx.Paragraph({
                children: [new docx.TextRun(prefix), ...inlinesToRuns(docx, li.content)],
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
            paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun(cellTexts || ' ')] }));
          }
          break;
        }
        case 'columnList':
        case 'column':
          if (b.children?.length) walk(b.children);
          break;
        case 'image': {
          const alt = String(b.props?.alt || 'image');
          paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun(`[Image: ${alt}]`)] }));
          break;
        }
        case 'embed': {
          const url = String(b.props?.url || '');
          paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun(`[Embed: ${url}]`)] }));
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
            paragraphs.push(new docx.Paragraph({ children: inlinesToRuns(docx, b.content) }));
          }
      }
    }
  };

  walk(blocks);
  return paragraphs;
}

/** Download the current document as a Word `.docx` file. */
export async function downloadBlocksAsDocx(blocks: Block[], filename = 'document.docx'): Promise<void> {
  const docx = await import('docx');
  const doc = new docx.Document({
    sections: [{ children: blocksToParagraphs(docx, blocks) }],
  });
  const blob = await docx.Packer.toBlob(doc);
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
export async function printDocumentAsPdf(blocks: Block[]): Promise<void> {
  const { marked } = await import('marked');
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
