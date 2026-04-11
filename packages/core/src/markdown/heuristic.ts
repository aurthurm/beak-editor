/**
 * Detect whether plain text is likely Markdown (for paste handling).
 *
 * @module
 */

/**
 * Returns true when `text` looks like Markdown worth parsing on paste.
 * Conservative: avoids treating normal sentences as Markdown.
 */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (t.includes('```')) return true;

  if (/^#{1,6}\s/m.test(text)) return true;

  if (/^(\s*)([-*+]|\d+\.)\s/m.test(text)) return true;

  if (/^(\s*)[-*+]\s+\[[ xX]\]/m.test(text)) return true;

  if (/^>\s/m.test(text)) return true;

  if (/^(\s*)([-*_]){3,}\s*$/m.test(text)) return true;

  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true;

  if (/!\[[^\]]*\]\([^)]+\)/.test(text)) return true;

  if (text.includes('\n') && text.split('\n').length >= 2) {
    if (/(\*\*|__).+(\*\*|__)/.test(text) || /(^|\s)`[^`\n]+`/.test(text)) return true;
    if (/^\|.+\|/m.test(text)) return true;
  }

  return false;
}
