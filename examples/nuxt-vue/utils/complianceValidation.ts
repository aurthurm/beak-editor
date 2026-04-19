import type { Block, InlineContent } from '@amusendame/beakblock-core';
import type { CommentStore } from '@amusendame/beakblock-core';
import { isImageSrcAllowed } from './complianceMediaPolicy';

/** Minimum non-whitespace characters for a required text block to count as filled. */
const MIN_TEXT_CHARS = 8;

export type ComplianceValidationOptions = {
  /** When set, image blocks must load from one of these hosts (see complianceMediaPolicy). */
  imageHostAllowlist?: readonly string[];
};

function inlineTextLength(content: InlineContent[] | undefined): number {
  if (!content?.length) return 0;
  let n = 0;
  for (const item of content) {
    if (item.type === 'text') n += item.text.trim().length;
    else if (item.type === 'link') n += inlineTextLength(item.content);
  }
  return n;
}

function blockHasSubstance(block: Block, options?: ComplianceValidationOptions): boolean {
  switch (block.type) {
    case 'paragraph':
    case 'heading': {
      const len = inlineTextLength(block.content);
      return len >= MIN_TEXT_CHARS;
    }
    case 'image': {
      const src = (block.props as { src?: string }).src?.trim() ?? '';
      const alt = (block.props as { alt?: string }).alt?.trim() ?? '';
      const caption = (block.props as { caption?: string }).caption?.trim() ?? '';
      if (!src || !alt || !caption) return false;
      if (options?.imageHostAllowlist?.length && !isImageSrcAllowed(src, options.imageHostAllowlist)) {
        return false;
      }
      return true;
    }
    case 'codeBlock': {
      return inlineTextLength(block.content) >= MIN_TEXT_CHARS;
    }
    case 'divider':
      return false;
    default:
      if (block.children?.length) {
        return block.children.some((c) => blockHasSubstance(c, options));
      }
      if (block.content?.length) {
        return inlineTextLength(block.content) >= MIN_TEXT_CHARS;
      }
      return true;
  }
}

export function countUnresolvedCommentThreads(store: CommentStore): number {
  return store.getThreads().filter((t) => !t.deletedAt && !t.resolved).length;
}

/**
 * A required compliance section must contain at least one substantive block
 * (meaningful text, or image with src+alt+caption on allowlisted host when configured).
 */
export function validateComplianceSectionBlocks(
  required: boolean,
  blocks: Block[],
  options?: ComplianceValidationOptions
): {
  ok: boolean;
  issues: string[];
} {
  if (!required) {
    return { ok: true, issues: [] };
  }
  if (!blocks.length) {
    return { ok: false, issues: ['Section is empty.'] };
  }
  const any = blocks.some((b) => blockHasSubstance(b, options));
  if (!any) {
    const extra =
      options?.imageHostAllowlist?.length ?
        ' Images must use an allowlisted host, and include caption and alt text.'
      : '';
    return {
      ok: false,
      issues: [
        `Add at least ${MIN_TEXT_CHARS} characters of substantive text, or a compliant image with caption and alt text.${extra}`,
      ],
    };
  }
  return { ok: true, issues: [] };
}

export type SectionValidationResult = {
  sectionId: string;
  title: string;
  required: boolean;
  /** Outline level of the controlled heading (1–3). */
  headingLevel: 1 | 2 | 3;
  parentLockId?: string;
  ok: boolean;
  issues: string[];
  unresolvedComments: number;
  /** Pending track-change groups (sequential runs count as one group each). */
  pendingTrackGroups: number;
};
