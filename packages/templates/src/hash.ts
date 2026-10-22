/**
 * Content hashing (SHA-256 over canonical JSON) with Web Crypto.
 *
 * Works in Node 18+ and browsers. Hashes are lowercase hex.
 *
 * @module
 */

import { canonicalJson } from '@amusendame/beakblock-permissions';
import type { Block } from './types';

/** SHA-256 of bytes or UTF-8 text, as lowercase hex. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 of a value's canonical JSON (object keys sorted, `undefined` dropped).
 *
 * @example
 * ```typescript
 * const hash = await contentHash({ b: 1, a: 2 }); // same as contentHash({ a: 2, b: 1 })
 * ```
 */
export function contentHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

/** Props that the composer derives from presentation (numbering) and must not affect content hashes. */
const DERIVED_HEADING_PROPS = ['numbering', 'styleId'] as const;

/**
 * Hash of section content. Heading numbering and style ids are derived at composition
 * time, so they are excluded. Text, block structure and every other prop are included.
 */
export function sectionContentHash(blocks: readonly Block[]): Promise<string> {
  return contentHash(normaliseForHash(blocks));
}

function normaliseForHash(blocks: readonly Block[]): unknown {
  return blocks.map((block) => {
    const props = { ...(block.props ?? {}) } as Record<string, unknown>;
    if (block.type === 'heading') {
      for (const key of DERIVED_HEADING_PROPS) delete props[key];
    }
    const out: Record<string, unknown> = { type: block.type, props, content: block.content };
    if (block.children) out.children = normaliseForHash(block.children);
    return out;
  });
}
