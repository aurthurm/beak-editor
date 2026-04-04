import type { Block } from '@aurthurm/beakblock-core';

function remapBlockTreeIds(blocks: Block[]): Block[] {
  const clone = JSON.parse(JSON.stringify(blocks)) as Block[];
  const walk = (list: Block[]) => {
    for (const b of list) {
      b.id = crypto.randomUUID();
      if (b.children?.length) walk(b.children);
    }
  };
  walk(clone);
  return clone;
}

export type ComplianceSectionSource = { title: string; blocks: Block[] };

/**
 * Builds one continuous document: optional H1, then for each section an H2 title
 * followed by that section's blocks (IDs remapped so the merged doc is valid).
 */
export function mergeComplianceSections(
  sections: ComplianceSectionSource[],
  options?: { documentTitle?: string; sectionHeadingLevel?: 1 | 2 | 3 }
): Block[] {
  const level = options?.sectionHeadingLevel ?? 2;
  const out: Block[] = [];

  if (options?.documentTitle) {
    out.push({
      id: crypto.randomUUID(),
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: options.documentTitle, styles: {} }],
    });
  }

  for (const sec of sections) {
    out.push({
      id: crypto.randomUUID(),
      type: 'heading',
      props: { level },
      content: [{ type: 'text', text: sec.title, styles: {} }],
    });
    out.push(...remapBlockTreeIds(sec.blocks));
  }

  return out;
}
