import type { Block } from '@aurthurm/beakblock-core';

export type BlockDiffLine = { path: string; kind: 'changed' | 'added' | 'removed'; summary: string };

function blockFingerprint(b: Block): string {
  const base = `${b.type}:${b.id}`;
  if (b.content?.length) {
    const text = b.content
      .filter((x): x is { type: 'text'; text: string } => x.type === 'text')
      .map((x) => x.text)
      .join('');
    return `${base}:${text.slice(0, 200)}`;
  }
  if (b.type === 'image') {
    const p = b.props as { src?: string; alt?: string };
    return `${base}:${p.src ?? ''}:${p.alt ?? ''}`;
  }
  return base;
}

function walkBlocks(blocks: Block[], prefix: string, out: Map<string, string>): void {
  blocks.forEach((b, i) => {
    const p = `${prefix}[${i}]`;
    out.set(b.id, `${p} ${blockFingerprint(b)}`);
    if (b.children?.length) walkBlocks(b.children, `${p}.children`, out);
  });
}

/**
 * Structural diff keyed by block id (stable across section editors before merge remap).
 */
export function diffBlockTrees(a: Block[], b: Block[], labelA = 'A', labelB = 'B'): BlockDiffLine[] {
  const mapA = new Map<string, string>();
  const mapB = new Map<string, string>();
  walkBlocks(a, 'root', mapA);
  walkBlocks(b, 'root', mapB);
  const lines: BlockDiffLine[] = [];
  for (const [id, fa] of mapA) {
    const fb = mapB.get(id);
    if (fb === undefined) lines.push({ path: id, kind: 'removed', summary: `Only in ${labelA}: ${fa}` });
    else if (fa !== fb) lines.push({ path: id, kind: 'changed', summary: `${labelA}: ${fa} | ${labelB}: ${fb}` });
  }
  for (const [id, fb] of mapB) {
    if (!mapA.has(id)) lines.push({ path: id, kind: 'added', summary: `Only in ${labelB}: ${fb}` });
  }
  return lines;
}
